"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, sankeyJustify, sankeyLeft, sankeyRight, sankeyCenter, SankeyNode, SankeyLink } from "d3-sankey";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { Settings } from "./settings";
import { Kit, Palette, Selectable, formatValue, formatCompact, renderLanding, toNumber, valueByRole, categoryByRole, tooltipExtras, textWidth } from "./shared/kit";
import { fontSize } from "./shared/settings";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

interface NodeExtra { name: string; color?: string; }
interface LinkExtra extends Selectable { extras: VisualTooltipDataItem[]; }
type Node = SankeyNode<NodeExtra, LinkExtra>;
type Link = SankeyLink<NodeExtra, LinkExtra>;

const aligns = { justify: sankeyJustify, left: sankeyLeft, right: sankeyRight, center: sankeyCenter };

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
            const src = categoryByRole(cats, "source"), dst = categoryByRole(cats, "target");
            const weight = valueByRole(dv?.categorical?.values, "weight");
            if (!src || !dst || !weight) {
                renderLanding(this.root, "LB Sankey Flow", [
                    "Source (required): where the flow starts, e.g. Lead source",
                    "Destination (required): where it goes, e.g. Proposal outcome",
                    "Weight (required): e.g. Number of proposals, Hours, $",
                    "Multi-stage flows: add rows where a destination is also a source (A→B, B→C)"
                ], pal);
            } else {
                this.render(dv, src, dst, weight, options.viewport, pal);
            }
            events.renderingFinished(options);
        } catch (e) {
            events.renderingFailed(options, String(e));
            throw e;
        }
    }

    private render(dv: powerbi.DataView, src: powerbi.DataViewCategoryColumn, dst: powerbi.DataViewCategoryColumn, weight: powerbi.DataViewValueColumn, vp: powerbi.IViewport, pal: Palette): void {
        const s = this.settings.sankey;
        const fs = fontSize(this.settings.text);
        const showLabels = this.settings.text.showLabels.value;
        d3.select(this.root).selectAll("*").remove();

        const nodeIndex = new Map<string, number>();
        const nodes: NodeExtra[] = [];
        const idx = (name: string) => {
            if (!nodeIndex.has(name)) { nodeIndex.set(name, nodes.length); nodes.push({ name }); }
            return nodeIndex.get(name);
        };
        const links: { source: number; target: number; value: number; selectionId: ISelectionId; extras: VisualTooltipDataItem[] }[] = [];
        src.values.forEach((sv, i) => {
            const v = toNumber(weight.values[i]);
            const a = formatValue(sv, src.source), b = formatValue(dst.values[i], dst.source);
            if (!v || v <= 0 || a === b) return;
            links.push({
                source: idx(a), target: idx(b), value: v,
                selectionId: this.kit.host.createSelectionIdBuilder().withCategory(src, i).withCategory(dst, i).createSelectionId(),
                extras: tooltipExtras(dv.categorical, i)
            });
        });
        nodes.forEach(n => { n.color = this.kit.seriesColor(n.name); });
        const svg = d3.select(this.root).append("svg").attr("width", vp.width).attr("height", vp.height);
        if (!links.length) return;

        // Reserve room for labels of the first (pure source) and last (pure destination) columns.
        const isSource = new Set(links.map(l => l.source)), isTarget = new Set(links.map(l => l.target));
        const padFor = (pick: (i: number) => boolean) => showLabels
            ? Math.min(vp.width * 0.25, d3.max(nodes.filter((_, i) => pick(i)), n => textWidth(n.name, fs)) ?? 0) + 12 : 4;
        const leftPad = padFor(i => !isTarget.has(i)), rightPad = padFor(i => !isSource.has(i));
        const layout = sankey<NodeExtra, LinkExtra>()
            .nodeWidth(Math.max(4, s.nodeWidth.value))
            .nodePadding(Math.max(2, s.nodePadding.value))
            .nodeAlign(aligns[s.align.value.value as keyof typeof aligns] ?? sankeyJustify)
            .extent([[leftPad, 6], [Math.max(leftPad + 40, vp.width - rightPad), Math.max(40, vp.height - 6)]]);
        let graph: { nodes: Node[]; links: Link[] };
        try {
            graph = layout({ nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) });
        } catch (e) {
            renderLanding(this.root, "This data contains a loop", [
                "A Sankey can't show circular flows (A→B and B→A). Filter or rename one side so flows only move forward.",
                String(e)
            ], pal);
            return;
        }

        const op = Math.max(5, Math.min(100, s.linkOpacity.value)) / 100;
        const mode = s.linkColor.value.value;
        const linkColor = (l: Link) => pal.highContrast ? pal.text : mode === "neutral" ? pal.neutral
            : ((mode === "target" ? l.target : l.source) as Node).color;
        const linkSel = svg.append("g").attr("fill", "none").selectAll<SVGPathElement, Link>("path").data(graph.links).enter().append("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", linkColor).attr("stroke-opacity", pal.highContrast ? 0.6 : op)
            .attr("stroke-width", l => Math.max(1, l.width));
        const nodeSel = svg.append("g").selectAll<SVGRectElement, Node>("rect").data(graph.nodes).enter().append("rect")
            .attr("x", n => n.x0).attr("y", n => n.y0).attr("width", n => n.x1 - n.x0).attr("height", n => Math.max(1, n.y1 - n.y0))
            .attr("fill", n => pal.highContrast ? pal.background : n.color).attr("stroke", pal.highContrast ? pal.text : "none");
        if (showLabels) {
            svg.append("g").selectAll("text").data(graph.nodes).enter().append("text")
                .attr("x", n => n.x0 < vp.width / 2 ? n.x0 - 6 : n.x1 + 6)
                .attr("y", n => (n.y0 + n.y1) / 2).attr("dy", "0.35em")
                .attr("text-anchor", n => n.x0 < vp.width / 2 ? "end" : "start")
                .attr("fill", pal.text).style("font-size", `${fs}px`)
                .attr("stroke", pal.highContrast ? pal.background : "#fff").attr("stroke-width", 3).attr("stroke-opacity", 0.8)
                .attr("paint-order", "stroke").attr("stroke-linejoin", "round")
                .each((n, i, els) => {
                    const t = d3.select(els[i]);
                    t.append("tspan").text(n.name);
                    if (n.y1 - n.y0 > fs * 2.2) t.append("tspan").attr("x", t.attr("x")).attr("dy", "1.2em").style("font-weight", 600).text(formatCompact(n.value ?? 0, weight.source));
                    else t.append("tspan").style("font-weight", 600).text(` ${formatCompact(n.value ?? 0, weight.source)}`);
                });
        }

        const nm = (n: unknown) => (n as Node).name;
        this.kit.bindTooltip(linkSel, l => [
            { displayName: src.source.displayName, value: nm(l.source) },
            { displayName: dst.source.displayName, value: nm(l.target) },
            { displayName: weight.source.displayName, value: formatValue(l.value, weight.source) },
            { displayName: `% of ${nm(l.source)}`, value: d3.format(".1%")(l.value / ((l.source as Node).value || 1)) },
            ...l.extras
        ], l => l.selectionId);
        this.kit.bindTooltip(nodeSel, n => [
            { displayName: "Node", value: n.name },
            { displayName: "Inflow", value: formatValue(d3.sum(n.targetLinks ?? [], l => l.value), weight.source) },
            { displayName: "Outflow", value: formatValue(d3.sum(n.sourceLinks ?? [], l => l.value), weight.source) }
        ]);
        nodeSel.on("mouseover.hl", (_, n) => linkSel.attr("stroke-opacity", l => l.source === n || l.target === n ? Math.min(1, op + 0.35) : op * 0.4))
            .on("mouseout.hl", () => linkSel.attr("stroke-opacity", pal.highContrast ? 0.6 : op));
        this.kit.bindSelection(svg, linkSel, (sel: ISelectionId[]) => linkSel.attr("opacity", l => Kit.opacity(l, sel)));
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.fmtService.buildFormattingModel(this.settings);
    }
}
