"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, formatCompact, renderLanding, fitText, toNumber, valueByRole } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import ISelectionId = powerbi.visuals.ISelectionId;

interface Row extends Selectable {
    label: string;
    actual: number;
    target: number | null;
    band1: number;
    band2: number;
    max: number;
    status: "good" | "warning" | "bad" | "none";
    tooltipExtras: { name: string; value: string }[];
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
            const cat = dv?.categorical;
            const actualCol = valueByRole(cat?.values, "actual");
            if (!actualCol) {
                renderLanding(this.root, "LB Bullet Chart", [
                    "Actual (required): the value you measure, e.g. Utilization %",
                    "Target: the goal you compare against",
                    "Category (optional): one bullet per office, region or KPI",
                    "Band limits (optional): otherwise bands are % of target (Format pane > Bullet)"
                ], pal);
                events.renderingFinished(options);
                return;
            }
            const rows = this.buildRows(dv, pal);
            this.render(rows, options.viewport, pal, actualCol.source, valueByRole(cat.values, "target")?.source);
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private buildRows(dv: powerbi.DataView, pal: Palette): Row[] {
        const cat = dv.categorical;
        const s = this.settings.bullet;
        const category = cat.categories?.[0];
        const cols = {
            actual: valueByRole(cat.values, "actual"),
            target: valueByRole(cat.values, "target"),
            band1: valueByRole(cat.values, "band1"),
            band2: valueByRole(cat.values, "band2"),
            max: valueByRole(cat.values, "bandMax")
        };
        const tooltipCols: powerbi.DataViewValueColumn[] = [];
        for (let i = 0; i < (cat.values?.length ?? 0); i++) if (cat.values[i].source.roles?.["tooltips"]) tooltipCols.push(cat.values[i]);
        const n = category ? category.values.length : 1;
        const rows: Row[] = [];
        for (let i = 0; i < n; i++) {
            const actual = toNumber(cols.actual.values[i]);
            if (actual === null) continue;
            const target = cols.target ? toNumber(cols.target.values[i]) : null;
            const ref = target ?? actual;
            const b1 = (cols.band1 && toNumber(cols.band1.values[i])) ?? ref * s.poorPct.value / 100;
            const b2 = (cols.band2 && toNumber(cols.band2.values[i])) ?? ref * s.satisfactoryPct.value / 100;
            const mx = (cols.max && toNumber(cols.max.values[i])) ?? Math.max(ref * s.maxPct.value / 100, actual, target ?? 0, b2);
            let status: Row["status"] = "none";
            if (target !== null) {
                if (s.higherIsBetter.value) status = actual >= target ? "good" : actual >= b1 ? "warning" : "bad";
                else status = actual <= target ? "good" : actual <= b2 ? "warning" : "bad";
            }
            rows.push({
                label: category ? formatValue(category.values[i], category.source) : cols.actual.source.displayName,
                actual, target, band1: Math.min(b1, b2), band2: Math.max(b1, b2), max: Math.max(mx, 0),
                status,
                selectionId: category ? this.kit.selectionIdForCategory(category, i) : undefined,
                tooltipExtras: tooltipCols.map(c => ({ name: c.source.displayName, value: formatValue(c.values[i], c.source) }))
            });
        }
        void pal;
        return rows;
    }

    private render(rows: Row[], vp: powerbi.IViewport, pal: Palette, actualMeta: DataViewMetadataColumn, targetMeta?: DataViewMetadataColumn): void {
        const s = this.settings.bullet;
        const fs = fontSize(this.settings.text);
        const showLabels = this.settings.text.showLabels.value;
        d3.select(this.root).selectAll("*").remove();
        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        if (!rows.length) return;

        const hasCategory = rows.length > 1 || rows[0].selectionId !== undefined;
        const labelW = hasCategory ? Math.min(s.labelWidth.value, vp.width * 0.4) : 0;
        const valueW = showLabels ? Math.min(fs * 6, vp.width * 0.2) : 0;
        const axisH = fs + 6;
        const rowH = Math.max(18, Math.min(64, (vp.height - (s.sharedScale.value ? axisH : 0)) / rows.length));
        const plotW = Math.max(20, vp.width - labelW - valueW - 12);
        const globalMax = d3.max(rows, r => r.max) ?? 1;
        const statusColor = (st: Row["status"]) => st === "good" ? pal.good : st === "warning" ? pal.warning : st === "bad" ? pal.bad : pal.secondary;

        const g = svg.selectAll<SVGGElement, Row>("g.row").data(rows).enter().append("g")
            .attr("class", "row")
            .attr("transform", (_, i) => `translate(0,${i * rowH})`);

        g.each((r, i, nodes) => {
            const row = d3.select(nodes[i]);
            const x = d3.scaleLinear().domain([0, s.sharedScale.value ? globalMax : r.max || 1]).range([0, plotW]);
            const barH = rowH * 0.62, top = (rowH - barH) / 2;
            const plot = row.append("g").attr("transform", `translate(${labelW},0)`);
            // Qualitative bands: darkest = worst (higher-is-better) or best (lower-is-better)
            const bands = [
                { from: 0, to: r.band1, o: s.higherIsBetter.value ? 1 : 0.45 },
                { from: r.band1, to: r.band2, o: 0.7 },
                { from: r.band2, to: x.domain()[1], o: s.higherIsBetter.value ? 0.45 : 1 }
            ];
            plot.selectAll("rect.band").data(bands).enter().append("rect").attr("class", "band")
                .attr("x", b => x(Math.max(0, b.from))).attr("y", top)
                .attr("width", b => Math.max(0, x(Math.min(b.to, x.domain()[1])) - x(Math.max(0, b.from))))
                .attr("height", barH)
                .attr("fill", pal.highContrast ? "none" : pal.neutral).attr("fill-opacity", b => b.o)
                .attr("stroke", pal.highContrast ? pal.text : "none");
            plot.append("rect").attr("class", "actual")
                .attr("x", 0).attr("y", top + barH * 0.33)
                .attr("width", Math.max(0, Math.min(x(r.actual), plotW))).attr("height", barH * 0.34)
                .attr("fill", s.colorByPerformance.value ? statusColor(r.status) : pal.secondary);
            if (r.target !== null) {
                plot.append("line").attr("class", "target")
                    .attr("x1", x(r.target)).attr("x2", x(r.target))
                    .attr("y1", top + barH * 0.1).attr("y2", top + barH * 0.9)
                    .attr("stroke", pal.secondary).attr("stroke-width", 2.5);
            }
            if (hasCategory) {
                row.append("text").attr("x", labelW - 8).attr("y", rowH / 2).attr("dy", "0.35em")
                    .attr("text-anchor", "end").attr("fill", pal.text).style("font-size", `${fs}px`)
                    .text(fitText(r.label, labelW - 10, fs)).append("title").text(r.label);
            }
            if (showLabels) {
                row.append("text").attr("x", labelW + plotW + 8).attr("y", rowH / 2).attr("dy", "0.35em")
                    .attr("fill", pal.text).style("font-size", `${fs}px`).style("font-weight", 600)
                    .text(formatCompact(r.actual, actualMeta));
            }
            if (!s.sharedScale.value && rowH >= 40) {
                const ticks = x.ticks(Math.max(2, Math.floor(plotW / 70)));
                plot.selectAll("text.tick").data(ticks).enter().append("text").attr("class", "tick")
                    .attr("x", t => x(t)).attr("y", top + barH + fs * 0.9).attr("text-anchor", "middle")
                    .attr("fill", pal.highContrast ? pal.text : "#5B6770").style("font-size", `${Math.max(7, fs - 2)}px`)
                    .text(t => formatCompact(t, actualMeta));
            }
            void i;
        });

        if (s.sharedScale.value) {
            const x = d3.scaleLinear().domain([0, globalMax]).range([0, plotW]);
            svg.append("g").attr("transform", `translate(${labelW},${rows.length * rowH})`)
                .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(plotW / 80))).tickFormat(t => formatCompact(+t, actualMeta)))
                .call(a => a.selectAll("text").attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`))
                .call(a => a.selectAll("line,path").attr("stroke", pal.neutral));
        }

        this.kit.bindTooltip(g, r => [
            { displayName: "Category", value: r.label },
            { displayName: actualMeta.displayName, value: formatValue(r.actual, actualMeta) },
            ...(r.target !== null ? [
                { displayName: targetMeta?.displayName ?? "Target", value: formatValue(r.target, targetMeta ?? actualMeta) },
                { displayName: "% of target", value: r.target ? `${(r.actual / r.target * 100).toFixed(1)}%` : "n/a" },
                { displayName: "Variance", value: formatValue(r.actual - r.target, actualMeta) }
            ] : []),
            ...r.tooltipExtras.map(t => ({ displayName: t.name, value: t.value }))
        ], r => r.selectionId);
        this.kit.bindSelection(svg, g, (sel: ISelectionId[]) => g.attr("opacity", r => Kit.opacity(r, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
