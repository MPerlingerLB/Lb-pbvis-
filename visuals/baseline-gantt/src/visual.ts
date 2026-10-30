"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, renderLanding, toDate, toNumber, tableColumn, fitText } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

interface Task extends Selectable {
    kind: "task";
    group: string | null;
    name: string;
    pStart: Date; pEnd: Date;
    aStart: Date | null; aEnd: Date | null;
    forecast: boolean;          // aEnd was projected, not reported
    progress: number | null;    // 0..1
    slip: number | null;        // days, + = late
    extras: VisualTooltipDataItem[];
}
interface GroupRow { kind: "group"; name: string; start: Date; end: Date; slip: number | null; }
type Row = Task | GroupRow;

const DAY = 864e5;

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
            const table = dv?.table;
            if (!table || tableColumn(table, "task") < 0 || tableColumn(table, "start") < 0 || tableColumn(table, "end") < 0) {
                renderLanding(this.root, "LB Baseline Gantt", [
                    "Task, Planned start, Planned finish (required)",
                    "Actual / forecast start & finish (optional): bars turn amber/red when they finish later than planned",
                    "Group / phase and % complete (optional)",
                    "For date fields pick the field name in the well, not 'Date Hierarchy'"
                ], pal);
            } else {
                const tasks = this.buildTasks(table);
                if (!tasks.length) {
                    renderLanding(this.root, "No valid dates found", ["Check the date fields are set to the field itself rather than 'Date Hierarchy', and that start/finish are populated."], pal);
                } else {
                    this.render(tasks, table, options.viewport, pal);
                }
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private buildTasks(table: powerbi.DataViewTable): Task[] {
        const c = (role: string) => tableColumn(table, role);
        const [ig, it, is, ie, ias, iae, ip] = ["group", "task", "start", "end", "actualStart", "actualEnd", "progress"].map(c);
        const tips = table.columns.map((col, i) => col.roles?.["tooltips"] ? i : -1).filter(i => i >= 0);
        const today = new Date();
        const tasks: Task[] = [];
        table.rows.forEach((r, row) => {
            const pStart = toDate(r[is]), pEnd = toDate(r[ie]);
            if (!pStart || !pEnd) return;
            const aStart = ias >= 0 ? toDate(r[ias]) : null;
            let aEnd = iae >= 0 ? toDate(r[iae]) : null;
            let progress = ip >= 0 ? toNumber(r[ip]) : null;
            if (progress !== null && progress > 1) progress /= 100;
            let forecast = false;
            if (aStart && !aEnd && (progress ?? 0) < 1) {
                // Started but no finish reported: project the planned duration forward, never earlier than today.
                aEnd = new Date(Math.max(+aStart + (+pEnd - +pStart), +today));
                forecast = true;
            }
            tasks.push({
                kind: "task",
                group: ig >= 0 ? formatValue(r[ig], table.columns[ig]) : null,
                name: formatValue(r[it], table.columns[it]),
                pStart, pEnd, aStart, aEnd, forecast, progress,
                slip: aEnd ? Math.round((+aEnd - +pEnd) / DAY) : null,
                selectionId: this.kit.selectionIdForRow(table, row),
                extras: tips.map(i => ({ displayName: table.columns[i].displayName, value: formatValue(r[i], table.columns[i]) }))
            });
        });
        return tasks;
    }

    private render(tasks: Task[], table: powerbi.DataViewTable, vp: powerbi.IViewport, pal: Palette): void {
        const s = this.settings.gantt;
        const fs = fontSize(this.settings.text);
        const showLabels = this.settings.text.showLabels.value;
        const rowH = Math.max(16, s.rowHeight.value);
        const labelW = Math.min(Math.max(60, s.labelWidth.value), vp.width * 0.45);
        const slipW = s.showSlip.value ? fs * 3.5 : 8;
        const headerH = fs * 2 + 10;
        const plotW = Math.max(40, vp.width - labelW - slipW - 14);

        // Rows: optional group header followed by its tasks (order of first appearance).
        const rows: Row[] = [];
        const hasGroups = tasks.some(t => t.group !== null);
        if (hasGroups) {
            const groups = Array.from(new Set(tasks.map(t => t.group)));
            for (const gName of groups) {
                const gt = tasks.filter(t => t.group === gName);
                const slips = gt.map(t => t.slip).filter((v): v is number => v !== null);
                rows.push({ kind: "group", name: gName, start: d3.min(gt, t => t.aStart ?? t.pStart), end: d3.max(gt, t => t.aEnd ?? t.pEnd), slip: slips.length ? d3.max(slips) : null });
                rows.push(...gt);
            }
        } else rows.push(...tasks);

        const allDates = tasks.flatMap(t => [t.pStart, t.pEnd, t.aStart, t.aEnd]).filter((d): d is Date => !!d);
        const today = new Date();
        let [d0, d1] = d3.extent(allDates) as [Date, Date];
        const pad = Math.max(2 * DAY, (+d1 - +d0) * 0.02);
        d0 = new Date(+d0 - pad); d1 = new Date(+d1 + pad);
        const x = d3.scaleUtc().domain([d0, d1]).range([0, plotW]);
        const slipColor = (slip: number | null) => slip === null ? pal.secondary : slip <= 0 ? pal.good : slip <= s.slipWarnDays.value ? pal.warning : pal.bad;

        d3.select(this.root).selectAll("*").remove();
        const wrap = d3.select(this.root).append("div").style("width", `${vp.width}px`).style("height", `${vp.height}px`).style("display", "flex").style("flex-direction", "column");
        const header = wrap.append("svg").attr("width", vp.width).attr("height", headerH).style("flex", "none");
        const body = wrap.append("div").style("flex", "1").style("overflow-y", "auto").style("overflow-x", "hidden");
        const bodyH = rows.length * rowH + 4;
        const svg = body.append("svg").attr("width", vp.width - 2).attr("height", bodyH);

        // Time axis: months (or weeks for short ranges) + year/quarter labels.
        const spanDays = (+d1 - +d0) / DAY;
        const ticks = spanDays > 900 ? x.ticks(d3.utcMonth.every(3)) : spanDays > 120 ? x.ticks(d3.utcMonth.every(1)) : x.ticks(d3.utcWeek.every(1));
        const tickFmt = spanDays > 120 ? d3.utcFormat("%b") : d3.utcFormat("%b %-d");
        const hg = header.append("g").attr("transform", `translate(${labelW},0)`);
        const minGap = textWidth("May", fs) + 6;
        let lastX = -Infinity, lastYear = -1;
        ticks.forEach(t => {
            const tx = x(t);
            if (tx - lastX < minGap) return;
            lastX = tx;
            hg.append("text").attr("x", tx + 3).attr("y", headerH - 6).attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`).text(tickFmt(t));
            if (t.getUTCFullYear() !== lastYear) {
                lastYear = t.getUTCFullYear();
                hg.append("text").attr("x", tx + 3).attr("y", fs + 2).attr("fill", pal.text).style("font-size", `${fs}px`).style("font-weight", 600).text(String(lastYear));
            }
        });
        header.append("line").attr("x1", 0).attr("x2", vp.width).attr("y1", headerH - 0.5).attr("y2", headerH - 0.5).attr("stroke", pal.neutral);
        header.append("text").attr("x", 4).attr("y", headerH - 6).attr("fill", pal.text).style("font-size", `${fs}px`).style("font-weight", 600)
            .text(table.columns[tableColumn(table, "task")].displayName);

        const plot = svg.append("g").attr("transform", `translate(${labelW},0)`);
        plot.selectAll("line.grid").data(ticks).enter().append("line").attr("class", "grid")
            .attr("x1", t => x(t)).attr("x2", t => x(t)).attr("y1", 0).attr("y2", bodyH)
            .attr("stroke", pal.neutral).attr("stroke-opacity", pal.highContrast ? 1 : 0.6);

        const rowSel = svg.selectAll<SVGGElement, Row>("g.row").data(rows).enter().append("g").attr("class", "row")
            .attr("transform", (_, i) => `translate(0,${i * rowH})`);
        rowSel.filter((_, i) => i % 2 === 1).append("rect").attr("width", vp.width).attr("height", rowH)
            .attr("fill", pal.highContrast ? "none" : pal.neutral).attr("fill-opacity", 0.18);

        rowSel.append("text").attr("x", r => r.kind === "group" || !hasGroups ? 4 : 16).attr("y", rowH / 2).attr("dy", "0.35em")
            .attr("fill", pal.text).style("font-size", `${fs}px`).style("font-weight", r => r.kind === "group" ? 600 : 400)
            .text(r => fitText(r.name, labelW - (r.kind === "group" ? 8 : 20), fs))
            .append("title").text(r => r.name);

        const groups = rowSel.filter(r => r.kind === "group") as unknown as d3.Selection<SVGGElement, GroupRow, SVGSVGElement, unknown>;
        if (s.showGroupSummary.value) {
            groups.append("path").attr("transform", `translate(${labelW},0)`).attr("d", g => {
                const a = x(g.start), b = x(g.end), y0 = rowH * 0.38, y1 = rowH * 0.62;
                return `M${a},${y1 + 3}L${a},${y0}L${b},${y0}L${b},${y1 + 3}L${b - 4},${y1}L${a + 4},${y1}Z`;
            }).attr("fill", pal.highContrast ? pal.text : pal.secondary);
        }

        const taskSel = rowSel.filter(r => r.kind === "task") as unknown as d3.Selection<SVGGElement, Task, SVGSVGElement, unknown>;
        const bars = taskSel.append("g").attr("transform", `translate(${labelW},0)`);
        const hasActuals = tasks.some(t => t.aStart);
        const pY = hasActuals ? rowH * 0.18 : rowH * 0.25, pH = hasActuals ? rowH * 0.26 : rowH * 0.5;
        const aY = rowH * 0.46, aH = rowH * 0.36;
        const isMilestone = (t: Task) => +t.pEnd === +t.pStart;
        // Planned (baseline) bar
        bars.filter(t => !isMilestone(t)).append("rect").attr("x", t => x(t.pStart)).attr("y", pY)
            .attr("width", t => Math.max(2, x(t.pEnd) - x(t.pStart))).attr("height", pH).attr("rx", 2)
            .attr("fill", pal.highContrast ? "none" : hasActuals ? pal.neutral : pal.primary).attr("fill-opacity", hasActuals ? 1 : 0.35)
            .attr("stroke", pal.highContrast ? pal.text : hasActuals ? "none" : pal.primary);
        bars.filter(t => isMilestone(t)).append("path")
            .attr("d", t => { const cx = x(t.pStart), cy = rowH / 2, k = rowH * 0.3; return `M${cx},${cy - k}L${cx + k},${cy}L${cx},${cy + k}L${cx - k},${cy}Z`; })
            .attr("fill", t => pal.highContrast ? pal.text : slipColor(t.slip));
        // Progress fill on the planned bar when there are no actuals
        bars.filter(t => !hasActuals && !isMilestone(t) && (t.progress ?? 0) > 0).append("rect")
            .attr("x", t => x(t.pStart)).attr("y", pY).attr("height", pH).attr("rx", 2)
            .attr("width", t => Math.max(0, (x(t.pEnd) - x(t.pStart)) * Math.min(1, t.progress)))
            .attr("fill", pal.highContrast ? pal.text : pal.primary);
        // Actual / forecast bar, coloured by slip; progress shown as the solid part.
        const act = bars.filter(t => !!t.aStart && !!t.aEnd && !isMilestone(t));
        act.append("rect").attr("x", t => x(t.aStart)).attr("y", aY)
            .attr("width", t => Math.max(2, x(t.aEnd) - x(t.aStart))).attr("height", aH).attr("rx", 2)
            .attr("fill", t => pal.highContrast ? "none" : slipColor(t.slip)).attr("fill-opacity", t => t.forecast || (t.progress ?? 1) < 1 ? 0.35 : 1)
            .attr("stroke", t => pal.highContrast ? pal.text : t.forecast ? slipColor(t.slip) : "none")
            .attr("stroke-dasharray", t => t.forecast ? "3 2" : null);
        act.filter(t => t.progress !== null && t.progress < 1 && t.progress > 0).append("rect")
            .attr("x", t => x(t.aStart)).attr("y", aY).attr("height", aH).attr("rx", 2)
            .attr("width", t => Math.max(0, (x(t.aEnd) - x(t.aStart)) * t.progress))
            .attr("fill", t => pal.highContrast ? pal.text : slipColor(t.slip));
        if (showLabels) {
            bars.filter(t => t.progress !== null && t.progress < 1 && rowH >= 22).append("text")
                .attr("x", t => x(t.aEnd ?? t.pEnd) + 4).attr("y", hasActuals ? aY + aH / 2 : rowH / 2).attr("dy", "0.35em")
                .attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 2)}px`).text(t => `${Math.round(t.progress * 100)}%`);
        }
        if (s.showSlip.value) {
            const slipLabel = (v: number | null) => v === null ? "" : v === 0 ? "on time" : `${v > 0 ? "+" : ""}${v}d`;
            rowSel.filter(r => r.slip !== null).append("text").attr("x", vp.width - 10).attr("y", rowH / 2).attr("dy", "0.35em")
                .attr("text-anchor", "end").style("font-size", `${Math.max(7, fs - 1)}px`).style("font-weight", 600)
                .attr("fill", r => pal.highContrast ? pal.text : r.slip <= 0 ? pal.good : slipColor(r.slip))
                .text(r => slipLabel(r.slip));
        }
        if (s.showToday.value && today >= d0 && today <= d1) {
            const tx = labelW + x(today);
            svg.append("line").attr("x1", tx).attr("x2", tx).attr("y1", 0).attr("y2", bodyH).attr("stroke", pal.bad).attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");
            header.append("text").attr("x", tx).attr("y", headerH - fs - 6).attr("text-anchor", "middle").attr("fill", pal.bad)
                .style("font-size", `${Math.max(7, fs - 2)}px`).style("font-weight", 600).text("Today");
        }

        const fmt = d3.utcFormat("%b %-d, %Y");
        this.kit.bindTooltip(taskSel, t => [
            { displayName: "Task", value: t.name },
            ...(t.group ? [{ displayName: "Group", value: t.group }] : []),
            { displayName: "Planned", value: `${fmt(t.pStart)} – ${fmt(t.pEnd)}` },
            ...(t.aStart ? [{ displayName: t.forecast ? "Actual start / forecast finish" : "Actual", value: `${fmt(t.aStart)} – ${t.aEnd ? fmt(t.aEnd) : "?"}` }] : []),
            ...(t.slip !== null ? [{ displayName: "Slip", value: `${t.slip > 0 ? "+" : ""}${t.slip} days` }] : []),
            ...(t.progress !== null ? [{ displayName: "% complete", value: `${Math.round(t.progress * 100)}%` }] : []),
            ...t.extras
        ], t => t.selectionId);
        this.kit.bindSelection(svg, taskSel, (sel: ISelectionId[]) => taskSel.attr("opacity", t => Kit.opacity(t, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}

function textWidth(t: string, fs: number): number { return t.length * fs * 0.55; }
