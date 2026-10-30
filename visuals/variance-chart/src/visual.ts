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

interface Item extends Selectable {
    label: string;
    actual: number;
    plan: number;
    delta: number;
    pct: number | null;
    total: boolean;
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
            const actual = valueByRole(dv?.categorical?.values, "actual");
            const plan = valueByRole(dv?.categorical?.values, "plan");
            if (!category || !actual || !plan) {
                renderLanding(this.root, "LB Plan vs Actual Variance", [
                    "Category (required): e.g. Month, Office, Service line",
                    "Actual (required) and Plan / budget / prior year (required)",
                    "Turn off 'Higher is better' in Format > Variance for cost measures so overspend shows red"
                ], pal);
            } else {
                const items: Item[] = [];
                category.values.forEach((c, i) => {
                    const a = toNumber(actual.values[i]), p = toNumber(plan.values[i]);
                    if (a === null || p === null) return;
                    items.push({ label: formatValue(c, category.source), actual: a, plan: p, delta: a - p, pct: p ? (a - p) / Math.abs(p) : null, total: false, selectionId: this.kit.selectionIdForCategory(category, i), extras: tooltipExtras(dv.categorical, i) });
                });
                if (this.settings.variance.showTotal.value && items.length > 1) {
                    const a = d3.sum(items, d => d.actual), p = d3.sum(items, d => d.plan);
                    items.push({ label: "Total", actual: a, plan: p, delta: a - p, pct: p ? (a - p) / Math.abs(p) : null, total: true, extras: [] });
                }
                this.render(items, options.viewport, pal, actual.source, plan.source);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private render(items: Item[], vp: powerbi.IViewport, pal: Palette, aMeta: powerbi.DataViewMetadataColumn, pMeta: powerbi.DataViewMetadataColumn): void {
        const s = this.settings.variance;
        const fs = fontSize(this.settings.text);
        const showLabels = this.settings.text.showLabels.value;
        d3.select(this.root).selectAll("*").remove();
        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        if (!items.length) return;

        const good = (v: number) => (s.higherIsBetter.value ? v >= 0 : v <= 0);
        const vColor = (v: number) => pal.highContrast ? pal.text : good(v) ? pal.good : pal.bad;
        const m = { top: 4, right: fs * 3, bottom: fs + 10, left: fs * 3 };
        const w = Math.max(40, vp.width - m.left - m.right);
        const H = Math.max(60, vp.height - m.top - m.bottom);
        // Panel heights: % pins / Δ bars / main columns
        const parts = [s.showPercent.value ? 0.24 : 0, s.showAbsolute.value ? 0.24 : 0, 0.52];
        const totalPart = d3.sum(parts);
        const [hPct, hAbs, hMain] = parts.map(p => H * p / totalPart);
        const x = d3.scaleBand<number>().domain(items.map((_, i) => i)).range([0, w]).paddingInner(0.3).paddingOuter(0.15);
        const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
        const lblFs = Math.max(7, fs - 1);
        const panelTitle = (y: number, text: string) => g.append("text").attr("x", -m.left + 2).attr("y", y + lblFs).attr("fill", pal.text)
            .style("font-size", `${lblFs}px`).style("font-weight", 600).text(text);
        const sep = (i: number) => items[i].total;
        const canLabel = x.bandwidth() > fs * 2.6;

        // 1) Variance % pins
        let y0 = 0;
        if (hPct) {
            const maxP = d3.max(items, d => Math.abs(d.pct ?? 0)) || 0.01;
            const yp = d3.scaleLinear().domain([-maxP, maxP]).range([y0 + hPct - fs * 1.2, y0 + fs * 1.2]);
            g.append("line").attr("x1", 0).attr("x2", w).attr("y1", yp(0)).attr("y2", yp(0)).attr("stroke", pal.text);
            const pins = g.selectAll("g.pin").data(items.filter(d => d.pct !== null)).enter().append("g").attr("class", "pin")
                .attr("transform", d => `translate(${x(items.indexOf(d)) + x.bandwidth() / 2},0)`);
            pins.append("line").attr("y1", yp(0)).attr("y2", d => yp(d.pct)).attr("stroke", d => vColor(d.delta)).attr("stroke-width", 2.5);
            pins.append("rect").attr("x", -4).attr("width", 8).attr("y", d => yp(d.pct) - 4).attr("height", 8).attr("fill", d => vColor(d.delta));
            if (showLabels && canLabel) {
                pins.append("text").attr("text-anchor", "middle").attr("y", d => yp(d.pct) + (d.pct >= 0 ? -8 : 15))
                    .attr("fill", pal.text).style("font-size", `${lblFs}px`).text(d => `${d.pct >= 0 ? "+" : ""}${(d.pct * 100).toFixed(1)}`);
            }
            panelTitle(y0, `Δ${s.planLabel.value}%`);
            y0 += hPct;
        }
        // 2) Absolute variance bars
        if (hAbs) {
            const maxA = d3.max(items.filter(d => !d.total), d => Math.abs(d.delta)) || 1;
            const ya = d3.scaleLinear().domain([-maxA, maxA]).range([y0 + hAbs - fs * 1.2, y0 + fs * 1.2]).clamp(true);
            g.append("line").attr("x1", 0).attr("x2", w).attr("y1", ya(0)).attr("y2", ya(0)).attr("stroke", pal.text);
            const bars = g.selectAll("g.dbar").data(items).enter().append("g").attr("class", "dbar");
            bars.append("rect").attr("x", (_, i) => x(i)).attr("width", x.bandwidth())
                .attr("y", d => Math.min(ya(0), ya(d.delta))).attr("height", d => Math.abs(ya(d.delta) - ya(0)))
                .attr("fill", d => pal.highContrast ? "none" : vColor(d.delta)).attr("stroke", pal.highContrast ? pal.text : "none")
                .attr("fill-opacity", d => d.total ? 0.6 : 1);
            // Axis-break mark on bars that exceed the scale (typically the total) so they don't read as equal.
            bars.filter(d => Math.abs(d.delta) > maxA).append("path")
                .attr("d", d => {
                    const i = items.indexOf(d), yb = (ya(0) + ya(d.delta)) / 2, x0 = x(i) - 2, x1 = x(i) + x.bandwidth() + 2;
                    return `M${x0},${yb + 2}L${x1},${yb - 4}M${x0},${yb + 6}L${x1},${yb}`;
                })
                .attr("stroke", pal.highContrast ? pal.background : "#fff").attr("stroke-width", 2);
            if (showLabels && canLabel) {
                bars.append("text").attr("x", (_, i) => x(i) + x.bandwidth() / 2).attr("text-anchor", "middle")
                    .attr("y", d => d.delta >= 0 ? ya(d.delta) - 4 : ya(d.delta) + lblFs + 2)
                    .attr("fill", pal.text).style("font-size", `${lblFs}px`)
                    .text(d => `${d.delta >= 0 ? "+" : ""}${formatCompact(d.delta, aMeta)}`);
            }
            panelTitle(y0, `Δ${s.planLabel.value}`);
            y0 += hAbs;
        }
        // 3) Actual (solid) over plan (outlined, offset) — IBCS notation.
        // The total is shown as text rather than a bar: on the monthly scale it would dwarf everything else.
        const cols = items.filter(d => !d.total);
        const maxV = d3.max(cols, d => Math.max(d.actual, d.plan)) || 1;
        const top = y0 + fs * 2.6;
        const ym = d3.scaleLinear().domain([0, maxV]).range([y0 + hMain, top]);
        const off = x.bandwidth() * 0.18;
        const main = g.selectAll<SVGGElement, Item>("g.col").data(items).enter().append("g").attr("class", "col");
        const colSel = main.filter(d => !d.total);
        colSel.append("rect").attr("x", d => x(items.indexOf(d)) + off).attr("width", x.bandwidth() - off)
            .attr("y", d => ym(Math.max(0, d.plan))).attr("height", d => Math.max(0, ym(0) - ym(Math.max(0, d.plan))))
            .attr("fill", pal.highContrast ? pal.background : "#fff").attr("stroke", pal.highContrast ? pal.text : pal.secondary).attr("stroke-width", 1.2);
        colSel.append("rect").attr("x", d => x(items.indexOf(d))).attr("width", x.bandwidth() - off)
            .attr("y", d => ym(Math.max(0, d.actual))).attr("height", d => Math.max(0, ym(0) - ym(Math.max(0, d.actual))))
            .attr("fill", pal.highContrast ? pal.text : pal.secondary);
        if (showLabels && canLabel) {
            colSel.append("text").attr("x", d => x(items.indexOf(d)) + (x.bandwidth() - off) / 2).attr("text-anchor", "middle")
                .attr("y", d => ym(Math.max(d.actual, d.plan)) - 4)
                .attr("fill", pal.text).style("font-size", `${lblFs}px`)
                .text(d => formatCompact(d.actual, aMeta));
        }
        const totalSel = main.filter(d => d.total).append("text").attr("text-anchor", "middle")
            .attr("x", d => x(items.indexOf(d)) + x.bandwidth() / 2).attr("y", (y0 + hMain + top) / 2)
            .attr("fill", pal.text).style("font-size", `${fs}px`);
        totalSel.append("tspan").attr("x", d => x(items.indexOf(d)) + x.bandwidth() / 2).style("font-weight", 700).text(d => `${s.actualLabel.value} ${formatCompact(d.actual, aMeta)}`);
        totalSel.append("tspan").attr("x", d => x(items.indexOf(d)) + x.bandwidth() / 2).attr("dy", "1.3em").text(d => `${s.planLabel.value} ${formatCompact(d.plan, pMeta)}`);
        g.append("line").attr("x1", 0).attr("x2", w).attr("y1", ym(0)).attr("y2", ym(0)).attr("stroke", pal.text);
        items.forEach((d, i) => {
            if (sep(i)) g.append("line").attr("x1", x(i) - x.step() * 0.15).attr("x2", x(i) - x.step() * 0.15).attr("y1", 0).attr("y2", ym(0) + fs).attr("stroke", pal.neutral).attr("stroke-dasharray", "3 3");
            g.append("text").attr("x", x(i) + x.bandwidth() / 2).attr("y", ym(0) + fs + 4).attr("text-anchor", "middle").attr("fill", pal.text)
                .style("font-size", `${lblFs}px`).style("font-weight", d.total ? 700 : 400).text(fitText(d.label, x.step(), lblFs));
        });
        // Legend (top-left of the main panel)
        const lg = g.append("g").attr("transform", `translate(0,${y0 + 4})`);
        lg.append("rect").attr("width", fs).attr("height", fs * 0.8).attr("fill", pal.highContrast ? pal.text : pal.secondary);
        lg.append("text").attr("x", fs + 4).attr("y", fs * 0.7).attr("fill", pal.text).style("font-size", `${lblFs}px`).text(s.actualLabel.value);
        const lx = fs + 12 + textWidth(s.actualLabel.value, lblFs);
        lg.append("rect").attr("x", lx).attr("width", fs).attr("height", fs * 0.8).attr("fill", "none").attr("stroke", pal.highContrast ? pal.text : pal.secondary);
        lg.append("text").attr("x", lx + fs + 4).attr("y", fs * 0.7).attr("fill", pal.text).style("font-size", `${lblFs}px`).text(s.planLabel.value);

        // Interaction: an invisible full-height hit area per category.
        const hits = g.selectAll<SVGRectElement, Item>("rect.hit").data(items).enter().append("rect").attr("class", "hit")
            .attr("x", (_, i) => x(i) - x.step() * 0.15).attr("width", x.step()).attr("y", 0).attr("height", ym(0))
            .attr("fill", "transparent");
        this.kit.bindTooltip(hits, d => [
            { displayName: "Category", value: d.label },
            { displayName: aMeta.displayName, value: formatValue(d.actual, aMeta) },
            { displayName: pMeta.displayName, value: formatValue(d.plan, pMeta) },
            { displayName: "Variance", value: `${d.delta >= 0 ? "+" : ""}${formatValue(d.delta, aMeta)}` },
            { displayName: "Variance %", value: d.pct === null ? "n/a" : `${d.pct >= 0 ? "+" : ""}${(d.pct * 100).toFixed(1)}%` },
            ...d.extras
        ], d => d.selectionId);
        const all = g.selectAll<SVGGElement, Item>("g.col, g.dbar, g.pin");
        this.kit.bindSelection(svg, hits, (sel: ISelectionId[]) => all.attr("opacity", d => Kit.opacity(d, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
