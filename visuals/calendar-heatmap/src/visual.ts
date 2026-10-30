"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, formatCompact, renderLanding, toDate, toNumber, valueByRole, tooltipExtras } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

interface Cell extends Selectable {
    date: Date;
    value: number | null;
    week: number;   // column index from the first displayed week
    dow: number;    // row index 0..6
    extras: VisualTooltipDataItem[];
}

const DAY = 864e5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
            const dateCol = cat?.categories?.[0];
            const valueCol = valueByRole(cat?.values, "value");
            if (!dateCol || !valueCol) {
                renderLanding(this.root, "LB Calendar Heatmap", [
                    "Date (required): a date column; in the field well pick the field name, not 'Date Hierarchy'",
                    "Value (required): e.g. Service calls, Hours logged, Site visits",
                    "Click a day to filter the rest of the report to that date"
                ], pal);
            } else {
                this.render(dv, dateCol, valueCol, options.viewport, pal);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private render(dv: powerbi.DataView, dateCol: powerbi.DataViewCategoryColumn, valueCol: powerbi.DataViewValueColumn, vp: powerbi.IViewport, pal: Palette): void {
        const s = this.settings.calendar;
        const fs = fontSize(this.settings.text);
        const weekStart = s.weekStartsMonday.value ? 1 : 0;
        const raw: { date: Date; value: number | null; i: number }[] = [];
        dateCol.values.forEach((v, i) => {
            const d = toDate(v as powerbi.PrimitiveValue);
            if (d) raw.push({ date: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), value: toNumber(valueCol.values[i]), i });
        });
        d3.select(this.root).selectAll("*").remove();
        if (!raw.length) {
            renderLanding(this.root, "Date field not recognised", [
                "Open the field well, click the arrow next to the date field and choose the field name instead of 'Date Hierarchy'."
            ], pal);
            return;
        }
        raw.sort((a, b) => +a.date - +b.date);
        const first = raw[0].date, last = raw[raw.length - 1].date;
        const firstWeekStart = new Date(+first - ((first.getUTCDay() - weekStart + 7) % 7) * DAY);
        const cells: Cell[] = raw.map(r => ({
            date: r.date,
            value: s.zeroIsEmpty.value && r.value === 0 ? null : r.value,
            week: Math.floor((+r.date - +firstWeekStart) / (7 * DAY)),
            dow: (r.date.getUTCDay() - weekStart + 7) % 7,
            selectionId: this.kit.selectionIdForCategory(dateCol, r.i),
            extras: tooltipExtras(dv.categorical, r.i)
        }));
        const totalWeeks = Math.floor((+last - +firstWeekStart) / (7 * DAY)) + 1;

        // Wrap into strips so long ranges stay readable: choose the strip length that maximises cell size.
        const leftW = fs * 3.2, legendH = s.showLegend.value ? fs + 14 : 0, monthH = fs + 6;
        let best = { strips: 1, cell: 0 };
        for (let strips = 1; strips <= Math.min(6, totalWeeks); strips++) {
            const perStrip = Math.ceil(totalWeeks / strips);
            const cw = (vp.width - leftW - 4) / perStrip;
            const ch = (vp.height - legendH - strips * (monthH + 6)) / (strips * 7);
            const cell = Math.min(cw, ch);
            if (cell > best.cell) best = { strips, cell };
        }
        const perStrip = Math.ceil(totalWeeks / best.strips);
        const cell = Math.max(4, Math.min(best.cell, 40));
        const gap = Math.min(s.cellGap.value, cell / 4);
        const stripH = monthH + cell * 7 + 6;

        const vals = cells.map(c => c.value).filter((v): v is number => v !== null);
        const [lo, hi] = d3.extent(vals);
        const high = s.highColor.value.value || pal.primary;
        const color = d3.scaleLinear<string>().domain([lo ?? 0, hi ?? 1]).range([s.lowColor.value.value, high]).interpolate(d3.interpolateLab);

        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        const days = s.weekStartsMonday.value ? ["Mon", "", "Wed", "", "Fri", "", ""] : ["", "Mon", "", "Wed", "", "Fri", ""];
        for (let st = 0; st < best.strips; st++) {
            const g = svg.append("g").attr("transform", `translate(${leftW},${st * stripH + monthH})`);
            if (cell >= 9) {
                days.forEach((d, i) => g.append("text").attr("x", -6).attr("y", i * cell + cell / 2).attr("dy", "0.35em")
                    .attr("text-anchor", "end").attr("fill", pal.text).style("font-size", `${Math.min(fs, cell)}px`).text(d));
            }
            // Month labels at the first week containing the 1st of a month
            for (let w = 0; w < perStrip; w++) {
                const weekIdx = st * perStrip + w;
                if (weekIdx >= totalWeeks) break;
                const ws = new Date(+firstWeekStart + weekIdx * 7 * DAY);
                for (let k = 0; k < 7; k++) {
                    const d = new Date(+ws + k * DAY);
                    if (d.getUTCDate() === 1 || weekIdx === 0 && k === 0) {
                        if (weekIdx === 0 && k === 0 && d.getUTCMonth() !== first.getUTCMonth()) continue;
                        const label = d.getUTCMonth() === 0 || weekIdx === 0 || w === 0 ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : MONTHS[d.getUTCMonth()];
                        g.append("text").attr("x", w * cell).attr("y", -5).attr("fill", pal.text)
                            .style("font-size", `${fs}px`).text(label);
                        break;
                    }
                }
            }
        }
        const marks = svg.selectAll<SVGRectElement, Cell>("rect.day").data(cells).enter().append("rect").attr("class", "day")
            .attr("x", c => leftW + (c.week % perStrip) * cell + gap / 2)
            .attr("y", c => Math.floor(c.week / perStrip) * stripH + monthH + c.dow * cell + gap / 2)
            .attr("width", cell - gap).attr("height", cell - gap)
            .attr("rx", Math.min(3, cell / 5))
            .attr("fill", c => pal.highContrast ? (c.value === null ? "none" : pal.text) : c.value === null ? pal.neutral : color(c.value))
            .attr("fill-opacity", c => pal.highContrast && c.value !== null && hi !== lo ? 0.2 + 0.8 * (c.value - (lo ?? 0)) / ((hi ?? 1) - (lo ?? 0)) : 1)
            .attr("stroke", pal.highContrast ? pal.text : "none");

        if (s.showLegend.value && vals.length) {
            const lw = Math.min(160, vp.width / 3), lx = vp.width - lw - 50, ly = vp.height - legendH + 4;
            const id = "lbcal-grad";
            const grad = svg.append("defs").append("linearGradient").attr("id", id);
            grad.append("stop").attr("offset", "0%").attr("stop-color", s.lowColor.value.value);
            grad.append("stop").attr("offset", "100%").attr("stop-color", high);
            svg.append("text").attr("x", lx - 6).attr("y", ly + 5).attr("dy", "0.35em").attr("text-anchor", "end")
                .attr("fill", pal.text).style("font-size", `${fs}px`).text(formatCompact(lo ?? 0, valueCol.source));
            svg.append("rect").attr("x", lx).attr("y", ly).attr("width", lw).attr("height", 10).attr("rx", 2)
                .attr("fill", pal.highContrast ? pal.text : `url(#${id})`);
            svg.append("text").attr("x", lx + lw + 6).attr("y", ly + 5).attr("dy", "0.35em")
                .attr("fill", pal.text).style("font-size", `${fs}px`).text(formatCompact(hi ?? 0, valueCol.source));
        }

        const dateFmt = d3.utcFormat("%a %b %-d, %Y");
        this.kit.bindTooltip(marks, c => [
            { displayName: "Date", value: dateFmt(c.date) },
            { displayName: valueCol.source.displayName, value: formatValue(c.value, valueCol.source) },
            ...c.extras
        ], c => c.selectionId);
        this.kit.bindSelection(svg, marks, (sel: ISelectionId[]) => marks.attr("opacity", c => Kit.opacity(c, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
