"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, renderLanding, toNumber, valueByRole, categoryByRole, tooltipExtras } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

type Rag = "bad" | "warning" | "good" | "none";
interface Tile extends Selectable {
    name: string;
    subtitle: string | null;
    statusText: string;
    rag: Rag;
    metric: string | null;
    extras: VisualTooltipDataItem[];
}

const RANK: Record<Rag, number> = { bad: 0, warning: 1, none: 2, good: 3 };
const RAG_LABEL: Record<Rag, string> = { bad: "Off track", warning: "At risk", good: "On track", none: "No status" };

/** Map common status wording (RAG, traffic-light, project-health phrases) to a RAG tone. */
export function ragOf(text: string | null): Rag {
    if (!text) return "none";
    const s = text.trim().toLowerCase();
    if (/^(r|red)$|off.?track|critical|late|behind|over|blocked|fail|high risk/.test(s)) return "bad";
    if (/^(a|y|amber|yellow)$|at.?risk|watch|caution|delay|medium|warn/.test(s)) return "warning";
    if (/^(g|green)$|on.?track|ok|good|complete|done|healthy|low risk|pass/.test(s)) return "good";
    return "none";
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
            const item = categoryByRole(dv?.categorical?.categories, "item");
            if (!item) {
                renderLanding(this.root, "LB Portfolio Status Grid", [
                    "Item (required): one tile per project, building or contract",
                    "Status (text) such as Red / Amber / Green or On track / At risk — or a numeric Score with thresholds",
                    "Subtitle (optional): e.g. Project manager; Key metric (optional): e.g. % budget used"
                ], pal);
            } else {
                this.render(this.buildTiles(dv, item), options.viewport, pal, valueByRole(dv.categorical.values, "metric")?.source);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private buildTiles(dv: powerbi.DataView, item: powerbi.DataViewCategoryColumn): Tile[] {
        const s = this.settings.status;
        const cat = dv.categorical;
        const status = categoryByRole(cat.categories, "status"), subtitle = categoryByRole(cat.categories, "subtitle");
        const score = valueByRole(cat.values, "score"), metric = valueByRole(cat.values, "metric");
        const tiles: Tile[] = item.values.map((v, i) => {
            let rag: Rag = "none", statusText = "";
            if (status && status.values[i] !== null) {
                statusText = formatValue(status.values[i], status.source);
                rag = ragOf(statusText);
            } else if (score) {
                const sc = toNumber(score.values[i]);
                if (sc !== null) {
                    const better = (a: number, b: number) => s.higherScoreIsBetter.value ? a >= b : a <= b;
                    rag = better(sc, s.goodAt.value) ? "good" : better(sc, s.warnAt.value) ? "warning" : "bad";
                    statusText = `${RAG_LABEL[rag]} (${formatValue(sc, score.source)})`;
                }
            }
            return {
                name: formatValue(v, item.source),
                subtitle: subtitle ? formatValue(subtitle.values[i], subtitle.source) : null,
                statusText: statusText || RAG_LABEL[rag], rag,
                metric: metric ? formatValue(metric.values[i], metric.source) : null,
                selectionId: this.kit.selectionIdForCategory(item, i),
                extras: tooltipExtras(cat, i)
            };
        });
        if (s.sortWorstFirst.value) tiles.sort((a, b) => RANK[a.rag] - RANK[b.rag] || a.name.localeCompare(b.name));
        return tiles;
    }

    private render(tiles: Tile[], vp: powerbi.IViewport, pal: Palette, metricMeta?: powerbi.DataViewMetadataColumn): void {
        const s = this.settings.status;
        const fs = fontSize(this.settings.text);
        const color = (r: Rag) => r === "good" ? pal.good : r === "warning" ? pal.warning : r === "bad" ? pal.bad : pal.neutral;
        const root = d3.select(this.root);
        root.selectAll("*").remove();
        const wrap = root.append("div").attr("class", "lb-grid-wrap")
            .style("width", `${vp.width}px`).style("height", `${vp.height}px`).style("color", pal.text).style("font-size", `${fs}px`);

        if (s.showSummary.value) {
            const counts = (["bad", "warning", "good", "none"] as Rag[]).map(r => ({ r, n: tiles.filter(t => t.rag === r).length })).filter(c => c.n);
            const bar = wrap.append("div").attr("class", "lb-grid-summary");
            counts.forEach(c => {
                const chip = bar.append("span").attr("class", "lb-chip");
                chip.append("span").attr("class", "lb-dot").style("background", pal.highContrast ? "none" : color(c.r)).style("border-color", pal.highContrast ? pal.text : color(c.r));
                chip.append("span").text(`${c.n} ${RAG_LABEL[c.r]}`);
            });
        }
        const grid = wrap.append("div").attr("class", "lb-grid")
            .style("grid-template-columns", `repeat(auto-fill, minmax(${Math.max(100, s.tileWidth.value)}px, 1fr))`);
        const tileSel = grid.selectAll<HTMLDivElement, Tile>("div.lb-tile").data(tiles).enter().append("div").attr("class", "lb-tile")
            .attr("role", "button").attr("aria-label", t => `${t.name}: ${t.statusText}`)
            .style("border-color", pal.highContrast ? pal.text : pal.neutral)
            .style("border-left-color", t => pal.highContrast ? pal.text : color(t.rag))
            .style("background", pal.highContrast ? pal.background : "#fff");
        const head = tileSel.append("div").attr("class", "lb-tile-head");
        head.append("div").attr("class", "lb-tile-name").attr("title", t => t.name).text(t => t.name);
        tileSel.filter(t => !!t.subtitle).append("div").attr("class", "lb-tile-sub").text(t => t.subtitle);
        const foot = tileSel.append("div").attr("class", "lb-tile-foot");
        foot.append("span").attr("class", "lb-pill")
            .style("background", t => pal.highContrast ? "none" : color(t.rag))
            .style("color", t => pal.highContrast ? pal.text : t.rag === "warning" || t.rag === "none" ? "#2D2926" : "#fff")
            .style("border", pal.highContrast ? `1px solid ${pal.text}` : "none")
            .text(t => t.statusText);
        foot.filter(t => t.metric !== null).append("span").attr("class", "lb-metric")
            .each((t, i, els) => {
                const el = d3.select(els[i]);
                el.append("span").attr("class", "lb-metric-label").text(`${metricMeta?.displayName ?? ""} `);
                el.append("strong").text(t.metric);
            });

        this.kit.bindTooltip(tileSel, t => [
            { displayName: "Item", value: t.name },
            ...(t.subtitle ? [{ displayName: "Subtitle", value: t.subtitle }] : []),
            { displayName: "Status", value: t.statusText },
            ...(t.metric !== null ? [{ displayName: metricMeta?.displayName ?? "Metric", value: t.metric }] : []),
            ...t.extras
        ], t => t.selectionId);
        this.kit.bindSelection(wrap, tileSel, (sel: ISelectionId[]) => tileSel.style("opacity", t => String(Kit.opacity(t, sel))));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
