"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, renderLanding, toDate, tableColumn, fitText, textWidth } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

type Tone = "good" | "warning" | "bad" | "planned" | "other";
interface Milestone extends Selectable {
    lane: string;
    label: string;
    date: Date;
    status: string | null;
    tone: Tone;
    level: number;   // label row within the lane, assigned to avoid overlaps
    extras: VisualTooltipDataItem[];
}

/** Map free-text status values onto RAG tones so common wording works without configuration. */
export function toneOf(status: string | null): Tone {
    if (!status) return "planned";
    const s = status.toLowerCase();
    if (/(complete|done|closed|achieved|met|green|on track|finished)/.test(s)) return "good";
    if (/(late|overdue|missed|red|blocked|off track|critical|behind)/.test(s)) return "bad";
    if (/(risk|amber|yellow|delay|watch|caution|slip)/.test(s)) return "warning";
    if (/(plan|scheduled|upcoming|not started|future|open|pending|forecast)/.test(s)) return "planned";
    return "other";
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
            const table = dv?.table;
            if (!table || tableColumn(table, "label") < 0 || tableColumn(table, "date") < 0) {
                renderLanding(this.root, "LB Milestone Timeline", [
                    "Milestone and Date (required)",
                    "Swimlane (optional): one row per project, building or workstream",
                    "Status (optional): words like Complete, At risk, Late, Planned are coloured automatically",
                    "For the date field pick the field name in the well, not 'Date Hierarchy'"
                ], pal);
            } else {
                this.render(table, options.viewport, pal);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private render(table: powerbi.DataViewTable, vp: powerbi.IViewport, pal: Palette): void {
        const s = this.settings.timeline;
        const fs = fontSize(this.settings.text);
        const [il, ilab, id, ist] = ["lane", "label", "date", "status"].map(r => tableColumn(table, r));
        const tips = table.columns.map((c, i) => c.roles?.["tooltips"] ? i : -1).filter(i => i >= 0);
        const items: Milestone[] = [];
        table.rows.forEach((r, row) => {
            const date = toDate(r[id]);
            if (!date) return;
            const status = ist >= 0 && r[ist] !== null ? formatValue(r[ist], table.columns[ist]) : null;
            items.push({
                lane: il >= 0 ? formatValue(r[il], table.columns[il]) : "",
                label: formatValue(r[ilab], table.columns[ilab]), date, status, tone: toneOf(status), level: 0,
                selectionId: this.kit.selectionIdForRow(table, row),
                extras: tips.map(i => ({ displayName: table.columns[i].displayName, value: formatValue(r[i], table.columns[i]) }))
            });
        });
        d3.select(this.root).selectAll("*").remove();
        if (!items.length) {
            renderLanding(this.root, "No valid dates found", ["Set the Date field to the field itself rather than 'Date Hierarchy'."], pal);
            return;
        }
        const lanes = Array.from(new Set(items.map(m => m.lane)));
        const hasLanes = lanes.length > 1 || lanes[0] !== "";
        const legendH = s.showLegend.value && items.some(m => m.status) ? fs + 12 : 0;
        const axisH = fs + 12;
        const labelW = hasLanes ? Math.min(s.laneLabelWidth.value, vp.width * 0.35) : 0;
        const plotW = Math.max(40, vp.width - labelW - 24);
        let [d0, d1] = d3.extent(items, m => m.date) as [Date, Date];
        const pad = Math.max(7 * 864e5, (+d1 - +d0) * 0.06);
        d0 = new Date(+d0 - pad); d1 = new Date(+d1 + pad);
        const x = d3.scaleUtc().domain([d0, d1]).range([12, plotW - 12]);
        const ms = Math.max(6, s.markerSize.value);
        const fmtShort = d3.utcFormat("%b %-d");

        // Assign each label to the lowest level where it doesn't collide with an earlier label in the same lane.
        const lineH = fs * 2.3;
        const levelsPerLane = new Map<string, number>();
        for (const lane of lanes) {
            const ends: number[] = [];
            items.filter(m => m.lane === lane).sort((a, b) => +a.date - +b.date).forEach(m => {
                const w = Math.max(textWidth(m.label, fs), textWidth(fmtShort(m.date), fs - 1)) + 8;
                const left = x(m.date) - w / 2;
                let lvl = ends.findIndex(e => e < left);
                if (lvl < 0) { lvl = ends.length; ends.push(0); }
                ends[lvl] = left + w;
                m.level = lvl;
            });
            levelsPerLane.set(lane, Math.max(1, ends.length));
        }
        const totalLevels = d3.sum(lanes, l => levelsPerLane.get(l) + 0.9);
        const avail = vp.height - legendH - axisH;
        const unit = Math.max(lineH, avail / Math.max(1, totalLevels));
        const showText = unit >= fs * 2;

        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        const toneColor = (t: Tone, status: string | null) => pal.highContrast ? pal.text
            : t === "good" ? pal.good : t === "bad" ? pal.bad : t === "warning" ? pal.warning : t === "planned" ? pal.primary : this.kit.seriesColor(status ?? "other");

        if (legendH) {
            const statuses = Array.from(new Set(items.map(m => m.status).filter((v): v is string => !!v)));
            let lx = labelW;
            statuses.forEach(st => {
                const g = svg.append("g").attr("transform", `translate(${lx},${fs / 2 + 4})`);
                g.append("path").attr("d", diamond(0, 0, fs * 0.45)).attr("stroke", toneColor(toneOf(st), st)).attr("stroke-width", 1.5)
                    .attr("fill", toneOf(st) === "planned" && !pal.highContrast ? "#fff" : toneColor(toneOf(st), st));
                g.append("text").attr("x", fs * 0.7).attr("dy", "0.35em").attr("fill", pal.text).style("font-size", `${fs}px`).text(st);
                lx += textWidth(st, fs) + fs * 2.2;
            });
        }
        const plot = svg.append("g").attr("transform", `translate(${labelW},${legendH})`);
        const ticks = x.ticks(Math.max(2, Math.floor(plotW / 80)));
        plot.selectAll("line.grid").data(ticks).enter().append("line").attr("class", "grid")
            .attr("x1", t => x(t)).attr("x2", t => x(t)).attr("y1", 0).attr("y2", avail)
            .attr("stroke", pal.neutral).attr("stroke-opacity", pal.highContrast ? 1 : 0.5);
        plot.append("g").attr("transform", `translate(0,${avail})`)
            .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d => d3.utcFormat(+d1 - +d0 > 400 * 864e5 ? "%b %Y" : "%b %-d")(d as Date)))
            .call(a => a.selectAll("text").attr("fill", pal.text).style("font-size", `${Math.max(7, fs - 1)}px`))
            .call(a => a.selectAll("line,path").attr("stroke", pal.highContrast ? pal.text : pal.neutral));

        let y = 0;
        const laneY = new Map<string, number>();
        lanes.forEach((lane, li) => {
            const h = (levelsPerLane.get(lane) + 0.9) * unit;
            laneY.set(lane, y);
            if (li % 2 === 1 && !pal.highContrast) plot.insert("rect", ":first-child").attr("x", -labelW).attr("y", y).attr("width", vp.width).attr("height", h).attr("fill", pal.neutral).attr("fill-opacity", 0.2);
            const axisY = y + unit * 0.45;
            plot.append("line").attr("x1", 0).attr("x2", plotW).attr("y1", axisY).attr("y2", axisY).attr("stroke", pal.highContrast ? pal.text : pal.neutral).attr("stroke-width", 2);
            if (hasLanes) {
                svg.append("text").attr("x", 4).attr("y", legendH + axisY).attr("dy", "0.35em").attr("fill", pal.text)
                    .style("font-size", `${fs}px`).style("font-weight", 600).text(fitText(lane, labelW - 8, fs)).append("title").text(lane);
            }
            y += h;
        });

        const marks = plot.selectAll<SVGGElement, Milestone>("g.ms").data(items).enter().append("g").attr("class", "ms")
            .attr("transform", m => `translate(${x(m.date)},${laneY.get(m.lane) + unit * 0.45})`);
        marks.append("line").attr("y1", 0).attr("y2", m => ms / 2 + m.level * unit + 2).attr("stroke", pal.highContrast ? pal.text : pal.neutral);
        marks.append("path").attr("d", diamond(0, 0, ms / 2))
            .attr("fill", m => m.tone === "planned" && !pal.highContrast ? "#fff" : toneColor(m.tone, m.status))
            .attr("stroke", m => toneColor(m.tone, m.status)).attr("stroke-width", 2);
        if (showText) {
            const t = marks.append("text").attr("text-anchor", "middle").attr("fill", pal.text).style("font-size", `${fs}px`)
                .attr("y", m => ms / 2 + m.level * unit + fs + 2);
            t.append("tspan").attr("x", 0).style("font-weight", 600).text(m => m.label);
            t.append("tspan").attr("x", 0).attr("dy", "1.1em").style("font-size", `${Math.max(7, fs - 1)}px`).attr("fill", pal.highContrast ? pal.text : "#5B6770").text(m => fmtShort(m.date));
        }
        const today = new Date();
        if (s.showToday.value && today >= d0 && today <= d1) {
            plot.append("line").attr("x1", x(today)).attr("x2", x(today)).attr("y1", 0).attr("y2", avail).attr("stroke", pal.bad).attr("stroke-dasharray", "4 3").attr("stroke-width", 1.5);
            plot.append("text").attr("x", x(today) + 3).attr("y", avail - 4).attr("fill", pal.bad).style("font-size", `${Math.max(7, fs - 2)}px`).style("font-weight", 600).text("Today");
        }

        const fmtLong = d3.utcFormat("%a %b %-d, %Y");
        this.kit.bindTooltip(marks, m => [
            { displayName: "Milestone", value: m.label },
            ...(hasLanes ? [{ displayName: table.columns[il].displayName, value: m.lane }] : []),
            { displayName: "Date", value: fmtLong(m.date) },
            ...(m.status ? [{ displayName: "Status", value: m.status }] : []),
            ...m.extras
        ], m => m.selectionId);
        this.kit.bindSelection(svg, marks, (sel: ISelectionId[]) => marks.attr("opacity", m => Kit.opacity(m, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}

function diamond(cx: number, cy: number, r: number): string {
    return `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`;
}
