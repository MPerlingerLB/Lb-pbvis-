"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, formatCompact, renderLanding, toNumber, valueByRole, tooltipExtras, fitText, textWidth } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

interface Point extends Selectable {
    label: string;
    value: number;
    signal: string[];   // which rules this point breaks
    extras: VisualTooltipDataItem[];
}

interface Limits { mean: number; ucl: number; lcl: number; sigma: number; }

/** XmR (individuals / moving range) limits: mean ± 2.66 × average moving range. */
export function xmrLimits(values: number[], floorAtZero: boolean): Limits {
    const mean = d3.mean(values) ?? 0;
    const mrs = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    const mrBar = d3.mean(mrs) ?? 0;
    const sigma = mrBar / 1.128;
    let lcl = mean - 2.66 * mrBar;
    if (floorAtZero) lcl = Math.max(0, lcl);
    return { mean, ucl: mean + 2.66 * mrBar, lcl, sigma };
}

export class Visual implements IVisual {
    private root: HTMLElement;
    private kit: Kit;
    private fmtService = new FormattingSettingsService();
    private settings: Settings;

    constructor(options: VisualConstructorOptions) {
        this.root = options.element;
        this.root.classList.add("lb-root");
        this.kit = new Kit(options.host);
    }

    public update(options: VisualUpdateOptions): void {
        const events = this.kit.host.eventService;
        events.renderingStarted(options);
        try {
            const dv = options.dataViews?.[0];
            this.settings = this.fmtService.populateFormattingSettingsModel(Settings, dv);
            const pal = this.kit.palette(this.settings.brand, this.settings.text.fontColor.value.value);
            const axis = dv?.categorical?.categories?.[0];
            const valueCol = valueByRole(dv?.categorical?.values, "value");
            if (!axis || !valueCol) {
                renderLanding(this.root, "LB Control Chart (XmR)", [
                    "Axis (required): time period or sequence, e.g. Week, Month, Inspection #",
                    "Value (required): one number per period, e.g. Avg report turnaround (days)",
                    "Limits are mean ± 2.66 × average moving range; red points are signals worth investigating"
                ], pal);
            } else {
                this.render(dv, axis, valueCol, options.viewport, pal);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private render(dv: powerbi.DataView, axis: powerbi.DataViewCategoryColumn, valueCol: powerbi.DataViewValueColumn, vp: powerbi.IViewport, pal: Palette): void {
        const s = this.settings.spc;
        const fs = fontSize(this.settings.text);
        d3.select(this.root).selectAll("*").remove();
        const pts: Point[] = [];
        axis.values.forEach((a, i) => {
            const v = toNumber(valueCol.values[i]);
            if (v === null) return;
            pts.push({ label: formatValue(a, axis.source), value: v, signal: [], selectionId: this.kit.selectionIdForCategory(axis, i), extras: tooltipExtras(dv.categorical, i) });
        });
        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        if (pts.length < 3) {
            renderLanding(this.root, "Not enough data", ["A control chart needs at least 3 periods with values."], pal);
            return;
        }
        const n = s.baselinePoints.value > 1 ? Math.min(pts.length, Math.round(s.baselinePoints.value)) : pts.length;
        const L = xmrLimits(pts.slice(0, n).map(p => p.value), s.floorAtZero.value);

        // Signal detection
        if (s.ruleOutside.value) pts.forEach(p => { if (p.value > L.ucl || p.value < L.lcl) p.signal.push("Outside control limits"); });
        const runLen = Math.max(5, Math.round(s.runLength.value));
        if (s.ruleRun.value) {
            let start = 0;
            for (let i = 1; i <= pts.length; i++) {
                const side = (k: number) => Math.sign(pts[k].value - L.mean);
                if (i === pts.length || side(i) !== side(start) || side(i) === 0) {
                    if (i - start >= runLen && side(start) !== 0) for (let k = start; k < i; k++) pts[k].signal.push(`Run of ${i - start} on one side of the mean`);
                    start = i;
                }
            }
        }
        if (s.ruleTwoOfThree.value && L.sigma > 0) {
            for (let i = 2; i < pts.length; i++) {
                for (const dir of [1, -1]) {
                    const win = [i - 2, i - 1, i].filter(k => dir * (pts[k].value - L.mean) > 2 * L.sigma);
                    if (win.length >= 2) win.forEach(k => { if (!pts[k].signal.includes("2 of 3 beyond 2 sigma")) pts[k].signal.push("2 of 3 beyond 2 sigma"); });
                }
            }
        }

        const labelW = fs * 7;
        const m = { top: fs + 12, right: labelW, bottom: fs * 2 + 10, left: fs * 4 };
        const w = Math.max(20, vp.width - m.left - m.right), h = Math.max(20, vp.height - m.top - m.bottom);
        const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
        const x = d3.scalePoint<number>().domain(pts.map((_, i) => i)).range([0, w]).padding(0.3);
        const [vmin, vmax] = d3.extent([...pts.map(p => p.value), L.ucl, L.lcl]) as [number, number];
        const pad = (vmax - vmin) * 0.08 || 1;
        const y = d3.scaleLinear().domain([vmin - pad, vmax + pad]).nice().range([h, 0]);
        const axisStyle = (a: d3.Selection<SVGGElement, unknown, null, undefined>) => {
            a.selectAll("text").attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`);
            a.selectAll("line,path").attr("stroke", pal.highContrast ? pal.text : pal.neutral);
        };

        if (s.showZones.value && !pal.highContrast && L.sigma > 0) {
            const zone = (from: number, to: number, o: number) => g.append("rect").attr("x", 0).attr("width", w)
                .attr("y", y(Math.min(to, y.domain()[1]))).attr("height", Math.max(0, y(Math.max(from, y.domain()[0])) - y(Math.min(to, y.domain()[1]))))
                .attr("fill", pal.neutral).attr("fill-opacity", o);
            zone(L.mean + 2 * L.sigma, L.ucl, 0.55); zone(L.lcl, L.mean - 2 * L.sigma, 0.55);
            zone(L.mean + L.sigma, L.mean + 2 * L.sigma, 0.3); zone(L.mean - 2 * L.sigma, L.mean - L.sigma, 0.3);
        }
        g.append("g").call(d3.axisLeft(y).ticks(Math.max(2, Math.floor(h / 40))).tickFormat(t => formatCompact(+t, valueCol.source))).call(axisStyle);
        const labelPx = Math.min(fs * 9, textWidth(pts.reduce((a, p) => p.label.length > a.length ? p.label : a, ""), fs)) + fs;
        const every = Math.max(1, Math.ceil(labelPx / (x.step() || 1)));
        g.append("g").attr("transform", `translate(0,${h})`)
            .call(d3.axisBottom(x).tickValues(x.domain().filter(i => i % every === 0)).tickFormat(i => fitText(pts[i].label, x.step() * every - 4, fs)))
            .call(axisStyle);

        const refLine = (v: number, label: string, color: string, dash: string) => {
            g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", color).attr("stroke-width", 1.3).attr("stroke-dasharray", dash);
            g.append("text").attr("x", w + 6).attr("y", y(v)).attr("dy", "0.35em").attr("fill", color).style("font-size", `${Math.max(7, fs - 1)}px`)
                .text(`${label} ${formatValue(v, valueCol.source, 2)}`);
        };
        refLine(L.ucl, "UCL", pal.bad, "6 4");
        refLine(L.mean, "Mean", pal.highContrast ? pal.text : pal.secondary, "");
        refLine(L.lcl, "LCL", pal.bad, "6 4");
        if (n < pts.length) {
            g.append("line").attr("x1", (x(n - 1) + x(n)) / 2).attr("x2", (x(n - 1) + x(n)) / 2).attr("y1", 0).attr("y2", h)
                .attr("stroke", pal.text).attr("stroke-dasharray", "2 3");
            g.append("text").attr("x", (x(n - 1) + x(n)) / 2 + 4).attr("y", 10).attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 2)}px`).text("limits frozen");
        }
        const lineColor = pal.highContrast ? pal.text : s.lineColor.value.value || pal.secondary;
        g.append("path").datum(pts).attr("fill", "none").attr("stroke", lineColor).attr("stroke-width", 1.6)
            .attr("d", d3.line<Point>().x((_, i) => x(i)).y(p => y(p.value)));
        const marks = g.selectAll<SVGCircleElement, Point>("circle.pt").data(pts).enter().append("circle").attr("class", "pt")
            .attr("cx", (_, i) => x(i)).attr("cy", p => y(p.value))
            .attr("r", p => p.signal.length ? 5 : 3.5)
            .attr("fill", p => pal.highContrast ? (p.signal.length ? pal.text : pal.background) : p.signal.some(r => r.startsWith("Outside")) ? pal.bad : p.signal.length ? pal.warning : lineColor)
            .attr("stroke", pal.highContrast ? pal.text : "#fff").attr("stroke-width", 1);

        const signals = pts.filter(p => p.signal.length).length;
        svg.append("text").attr("x", m.left).attr("y", fs).attr("fill", pal.text).style("font-size", `${fs}px`)
            .text(signals ? `${signals} point${signals > 1 ? "s" : ""} signal a special cause` : "Process is in statistical control");

        this.kit.bindTooltip(marks, p => [
            { displayName: axis.source.displayName, value: p.label },
            { displayName: valueCol.source.displayName, value: formatValue(p.value, valueCol.source) },
            { displayName: "Mean / UCL / LCL", value: [L.mean, L.ucl, L.lcl].map(v => formatValue(v, valueCol.source, 2)).join(" / ") },
            ...(p.signal.length ? [{ displayName: "Signal", value: p.signal.join("; ") }] : []),
            ...p.extras
        ], p => p.selectionId);
        this.kit.bindSelection(svg, marks, (sel: ISelectionId[]) => marks.attr("opacity", p => Kit.opacity(p, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
