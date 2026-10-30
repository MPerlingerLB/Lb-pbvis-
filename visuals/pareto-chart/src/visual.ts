"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, formatCompact, renderLanding, fitText, toNumber, valueByRole, tooltipExtras } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

interface Bar extends Selectable {
    label: string;
    value: number;
    cumPct: number;
    sharePct: number;
    vital: boolean;
    count: number;   // >1 for the grouped "All others" bar
    extras: VisualTooltipDataItem[];
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
            const category = dv?.categorical?.categories?.[0];
            const valueCol = valueByRole(dv?.categorical?.values, "value");
            if (!category || !valueCol) {
                renderLanding(this.root, "LB Pareto Chart", [
                    "Category (required): e.g. Callback root cause, Client, Defect type",
                    "Value (required): e.g. Number of callbacks, Revenue, Hours",
                    "Bars are sorted largest first; the line shows the running % of the total"
                ], pal);
            } else {
                this.render(this.buildBars(dv, category, valueCol), options.viewport, pal, valueCol.source);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private buildBars(dv: powerbi.DataView, category: powerbi.DataViewCategoryColumn, valueCol: powerbi.DataViewValueColumn): Bar[] {
        const s = this.settings.pareto;
        const items = category.values.map((c, i) => ({ i, label: formatValue(c, category.source), value: toNumber(valueCol.values[i]) ?? 0 }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
        const total = d3.sum(items, d => d.value) || 1;
        const maxBars = Math.max(2, Math.round(s.maxBars.value));
        const head = items.slice(0, items.length > maxBars ? maxBars - 1 : maxBars);
        const tail = items.slice(head.length);
        const bars: Bar[] = head.map(d => ({
            label: d.label, value: d.value, cumPct: 0, sharePct: d.value / total, vital: false, count: 1,
            selectionId: this.kit.selectionIdForCategory(category, d.i), extras: tooltipExtras(dv.categorical, d.i)
        }));
        if (tail.length) {
            bars.push({ label: `All others (${tail.length})`, value: d3.sum(tail, d => d.value), cumPct: 0, sharePct: d3.sum(tail, d => d.value) / total, vital: false, count: tail.length, extras: [] });
        }
        let run = 0, prev = 0;
        const thr = s.threshold.value / 100;
        for (const b of bars) {
            run += b.value;
            b.cumPct = run / total;
            b.vital = prev < thr && b.count === 1; // bars that get you to the cut-off are the "vital few"
            prev = b.cumPct;
        }
        return bars;
    }

    private render(bars: Bar[], vp: powerbi.IViewport, pal: Palette, meta: powerbi.DataViewMetadataColumn): void {
        const s = this.settings.pareto;
        const fs = fontSize(this.settings.text);
        const showLabels = this.settings.text.showLabels.value;
        d3.select(this.root).selectAll("*").remove();
        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        if (!bars.length) return;

        const longest = d3.max(bars, b => b.label.length) ?? 0;
        const m = { top: fs + 10, right: fs * 3.5, bottom: fs * 2 + 8, left: fs * 4 };
        let w = vp.width - m.left - m.right;
        const rotate = longest * fs * 0.55 > w / bars.length;
        if (rotate) m.bottom = Math.min(vp.height * 0.35, Math.min(longest, 18) * fs * 0.45 + 12);
        w = vp.width - m.left - m.right;
        const h = Math.max(20, vp.height - m.top - m.bottom);
        const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
        const x = d3.scaleBand<number>().domain(bars.map((_, i) => i)).range([0, w]).padding(0.2);
        const y = d3.scaleLinear().domain([0, (d3.max(bars, b => b.value) ?? 1) * 1.05]).nice().range([h, 0]);
        const yPct = d3.scaleLinear().domain([0, 1]).range([h, 0]);
        const lineColor = pal.highContrast ? pal.text : s.lineColor.value.value || pal.secondary;
        const axisStyle = (a: d3.Selection<SVGGElement, unknown, null, undefined>) => {
            a.selectAll("text").attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`);
            a.selectAll("line,path").attr("stroke", pal.highContrast ? pal.text : pal.neutral);
        };

        g.append("g").call(d3.axisLeft(y).ticks(Math.max(2, Math.floor(h / 40))).tickSize(-w).tickFormat(t => formatCompact(+t, meta)))
            .call(axisStyle).call(a => a.select(".domain").remove()).call(a => a.selectAll(".tick line").attr("stroke-opacity", 0.6));
        g.append("g").attr("transform", `translate(${w},0)`)
            .call(d3.axisRight(yPct).ticks(5).tickFormat(d3.format(".0%"))).call(axisStyle);
        const xa = g.append("g").attr("transform", `translate(0,${h})`)
            .call(d3.axisBottom(x).tickFormat(i => fitText(bars[i].label, rotate ? m.bottom * 1.6 : x.step(), fs))).call(axisStyle);
        if (rotate) xa.selectAll("text").attr("transform", "rotate(-40)").attr("text-anchor", "end").attr("dx", "-0.4em").attr("dy", "0.6em");

        const marks = g.selectAll<SVGRectElement, Bar>("rect.bar").data(bars).enter().append("rect").attr("class", "bar")
            .attr("x", (_, i) => x(i)).attr("width", x.bandwidth())
            .attr("y", b => y(b.value)).attr("height", b => h - y(b.value))
            .attr("fill", b => pal.highContrast ? "none" : (!s.highlightVitalFew.value || b.vital) ? pal.primary : pal.neutral)
            .attr("stroke", pal.highContrast ? pal.text : "none");

        if (showLabels && x.bandwidth() > fs * 2) {
            g.selectAll("text.val").data(bars).enter().append("text").attr("class", "val")
                .attr("x", (_, i) => x(i) + x.bandwidth() / 2).attr("y", b => y(b.value) - 4).attr("text-anchor", "middle")
                .attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`).text(b => formatCompact(b.value, meta));
        }
        if (s.showThreshold.value) {
            const ty = yPct(s.threshold.value / 100);
            g.append("line").attr("x1", 0).attr("x2", w).attr("y1", ty).attr("y2", ty)
                .attr("stroke", pal.bad).attr("stroke-dasharray", "5 4").attr("stroke-width", 1.2);
            g.append("text").attr("x", w - 4).attr("y", ty - 4).attr("text-anchor", "end").attr("fill", pal.bad)
                .style("font-size", `${Math.max(7, fs - 1)}px`).text(`${s.threshold.value}%`);
        }
        const line = d3.line<Bar>().x((_, i) => x(i) + x.bandwidth() / 2).y(b => yPct(b.cumPct));
        g.append("path").datum(bars).attr("d", line).attr("fill", "none").attr("stroke", lineColor).attr("stroke-width", 2);
        g.selectAll("circle.cum").data(bars).enter().append("circle").attr("class", "cum")
            .attr("cx", (_, i) => x(i) + x.bandwidth() / 2).attr("cy", b => yPct(b.cumPct)).attr("r", 3.5)
            .attr("fill", pal.highContrast ? pal.background : "#fff").attr("stroke", lineColor).attr("stroke-width", 2);
        const vitalCount = bars.filter(b => b.vital).length;
        svg.append("text").attr("x", m.left).attr("y", fs).attr("fill", pal.text).style("font-size", `${fs}px`)
            .text(`${vitalCount} of ${d3.sum(bars, b => b.count)} categories make up ${d3.format(".0%")(bars[vitalCount - 1]?.cumPct ?? 0)} of the total`);

        this.kit.bindTooltip(marks, b => [
            { displayName: "Category", value: b.label },
            { displayName: meta.displayName, value: formatValue(b.value, meta) },
            { displayName: "Share of total", value: d3.format(".1%")(b.sharePct) },
            { displayName: "Cumulative", value: d3.format(".1%")(b.cumPct) },
            ...b.extras
        ], b => b.selectionId);
        this.kit.bindSelection(svg, marks, (sel: ISelectionId[]) => marks.attr("opacity", b => Kit.opacity(b, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
