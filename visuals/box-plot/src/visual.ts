"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, formatCompact, renderLanding, toNumber, valueByRole, categoryByRole, fitText } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;

interface Box extends Selectable {
    label: string;
    values: number[];
    q1: number; median: number; q3: number;
    lo: number; hi: number;       // whisker ends
    mean: number;
    outliers: number[];
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
            const cats = dv?.categorical?.categories;
            const category = categoryByRole(cats, "category");
            const sample = categoryByRole(cats, "sample");
            const valueCol = valueByRole(dv?.categorical?.values, "value");
            if (!category || !sample || !valueCol) {
                renderLanding(this.root, "LB Box & Whisker", [
                    "Category (required): one box per value, e.g. Office or Service line",
                    "Sample (required): the individual record, e.g. Project ID or Ticket #",
                    "Value (required): e.g. Duration (weeks), Cost, Response time",
                    "Without a Sample field Power BI would sum everything into one number per category"
                ], pal);
            } else {
                this.render(this.buildBoxes(category, valueCol), options.viewport, pal, valueCol.source, category.source.displayName);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private buildBoxes(category: powerbi.DataViewCategoryColumn, valueCol: powerbi.DataViewValueColumn): Box[] {
        const s = this.settings.box;
        const groups = new Map<string, { first: number; values: number[] }>();
        category.values.forEach((c, i) => {
            const v = toNumber(valueCol.values[i]);
            if (v === null) return;
            const key = formatValue(c, category.source);
            if (!groups.has(key)) groups.set(key, { first: i, values: [] });
            groups.get(key).values.push(v);
        });
        const boxes: Box[] = [];
        groups.forEach((g, label) => {
            const v = g.values.sort(d3.ascending);
            const q1 = d3.quantileSorted(v, 0.25), median = d3.quantileSorted(v, 0.5), q3 = d3.quantileSorted(v, 0.75);
            let lo = v[0], hi = v[v.length - 1];
            if (s.whiskers.value.value === "iqr") {
                const iqr = q3 - q1;
                lo = v.find(x => x >= q1 - 1.5 * iqr) ?? lo;
                hi = [...v].reverse().find(x => x <= q3 + 1.5 * iqr) ?? hi;
            }
            boxes.push({
                label, values: v, q1, median, q3, lo, hi, mean: d3.mean(v),
                outliers: v.filter(x => x < lo || x > hi),
                selectionId: this.kit.selectionIdForCategory(category, g.first)
            });
        });
        const sort = s.sortBy.value.value;
        if (sort === "name") boxes.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
        if (sort === "median") boxes.sort((a, b) => b.median - a.median);
        return boxes;
    }

    private render(boxes: Box[], vp: powerbi.IViewport, pal: Palette, meta: powerbi.DataViewMetadataColumn, catName: string): void {
        const s = this.settings.box;
        const fs = fontSize(this.settings.text);
        const showLabels = this.settings.text.showLabels.value;
        d3.select(this.root).selectAll("*").remove();
        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        if (!boxes.length) return;
        const m = { top: fs + 8, right: showLabels ? fs * 4 : 12, bottom: fs * 2 + 8, left: fs * 4 };
        const w = Math.max(20, vp.width - m.left - m.right), h = Math.max(20, vp.height - m.top - m.bottom);
        const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
        const x = d3.scaleBand<number>().domain(boxes.map((_, i) => i)).range([0, w]).padding(0.35);
        const all = boxes.flatMap(b => b.values);
        const [mn, mx] = d3.extent(all) as [number, number];
        const pad = (mx - mn) * 0.05 || 1;
        const y = d3.scaleLinear().domain([mn - pad, mx + pad]).nice().range([h, 0]);
        const axisStyle = (a: d3.Selection<SVGGElement, unknown, null, undefined>) => {
            a.selectAll("text").attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`);
            a.selectAll("line,path").attr("stroke", pal.highContrast ? pal.text : pal.neutral);
        };
        g.append("g").call(d3.axisLeft(y).ticks(Math.max(2, Math.floor(h / 40))).tickSize(-w).tickFormat(t => formatCompact(+t, meta)))
            .call(axisStyle).call(a => a.select(".domain").remove()).call(a => a.selectAll(".tick line").attr("stroke-opacity", 0.5));
        g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(i => fitText(boxes[i].label, x.step(), fs))).call(axisStyle);

        const bw = Math.min(x.bandwidth(), 90);
        const marks = g.selectAll<SVGGElement, Box>("g.box").data(boxes).enter().append("g").attr("class", "box")
            .attr("transform", (_, i) => `translate(${x(i) + x.bandwidth() / 2},0)`);
        const stroke = pal.highContrast ? pal.text : pal.secondary;
        marks.append("line").attr("y1", b => y(b.lo)).attr("y2", b => y(b.hi)).attr("stroke", stroke);
        marks.append("line").attr("x1", -bw / 4).attr("x2", bw / 4).attr("y1", b => y(b.lo)).attr("y2", b => y(b.lo)).attr("stroke", stroke);
        marks.append("line").attr("x1", -bw / 4).attr("x2", bw / 4).attr("y1", b => y(b.hi)).attr("y2", b => y(b.hi)).attr("stroke", stroke);
        marks.append("rect").attr("x", -bw / 2).attr("width", bw)
            .attr("y", b => y(b.q3)).attr("height", b => Math.max(1, y(b.q1) - y(b.q3)))
            .attr("fill", pal.highContrast ? "none" : pal.primary).attr("fill-opacity", 0.85).attr("stroke", stroke).attr("rx", 2);
        marks.append("line").attr("x1", -bw / 2).attr("x2", bw / 2).attr("y1", b => y(b.median)).attr("y2", b => y(b.median))
            .attr("stroke", stroke).attr("stroke-width", 2.5);
        if (s.showMean.value) {
            const k = Math.max(3, bw / 12);
            marks.append("path").attr("d", b => `M${-k},${y(b.mean) - k}L${k},${y(b.mean) + k}M${-k},${y(b.mean) + k}L${k},${y(b.mean) - k}`)
                .attr("stroke", pal.highContrast ? pal.text : "#fff").attr("stroke-width", 2);
        }
        const jitter = (i: number) => ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
        marks.each((b, i, nodes) => {
            const sel = d3.select(nodes[i]);
            const pts = s.showPoints.value ? b.values : b.outliers;
            sel.selectAll("circle").data(pts).enter().append("circle")
                .attr("cx", (_, k) => s.showPoints.value ? jitter(k) * bw * 0.8 : 0).attr("cy", v => y(v)).attr("r", 2.6)
                .attr("fill", v => v < b.lo || v > b.hi ? pal.bad : pal.secondary).attr("fill-opacity", 0.75)
                .attr("stroke", pal.highContrast ? pal.text : "none");
            if (showLabels) {
                sel.append("text").attr("x", bw / 2 + 4).attr("y", y(b.median)).attr("dy", "0.35em").attr("fill", pal.text)
                    .style("font-size", `${Math.max(7, fs - 1)}px`).text(formatCompact(b.median, meta));
            }
        });

        this.kit.bindTooltip(marks, b => [
            { displayName: catName, value: b.label },
            { displayName: "Records", value: String(b.values.length) },
            { displayName: "Median", value: formatValue(b.median, meta, 2) },
            { displayName: "Mean", value: formatValue(b.mean, meta, 2) },
            { displayName: "Q1 – Q3", value: `${formatValue(b.q1, meta, 2)} – ${formatValue(b.q3, meta, 2)}` },
            { displayName: "Whiskers", value: `${formatValue(b.lo, meta, 2)} – ${formatValue(b.hi, meta, 2)}` },
            { displayName: "Outliers", value: String(b.outliers.length) }
        ], b => b.selectionId);
        this.kit.bindSelection(svg, marks, (sel: ISelectionId[]) => marks.attr("opacity", b => Kit.opacity(b, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
