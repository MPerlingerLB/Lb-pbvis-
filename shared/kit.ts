/*
 * Small helpers shared by all Lerch Bates visuals: number formatting, tooltips,
 * selection / cross-filtering, context menu, landing page and high-contrast colours.
 */
import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { BrandCard } from "./settings";

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import PrimitiveValue = powerbi.PrimitiveValue;

export interface Palette {
    primary: string;
    secondary: string;
    neutral: string;
    good: string;
    warning: string;
    bad: string;
    text: string;
    background: string;
    /** True when Windows high-contrast mode is on: draw with outlines, foreground/background only. */
    highContrast: boolean;
}

/** Anything bound to a mark that can be selected / cross-filtered. */
export interface Selectable {
    selectionId?: ISelectionId;
}

export class Kit {
    readonly host: IVisualHost;
    readonly selection: ISelectionManager;
    private onSelectionChange: () => void = () => undefined;

    constructor(host: IVisualHost) {
        this.host = host;
        this.selection = host.createSelectionManager();
        this.selection.registerOnSelectCallback(() => this.onSelectionChange());
    }

    /** Resolve brand colours, swapping in system colours when high contrast is active. */
    palette(brand: BrandCard, fontColor: string): Palette {
        const cp = this.host.colorPalette;
        if (cp.isHighContrast) {
            const fg = cp.foreground.value, bg = cp.background.value;
            return { primary: fg, secondary: fg, neutral: fg, good: fg, warning: fg, bad: fg, text: fg, background: bg, highContrast: true };
        }
        return {
            primary: brand.primary.value.value,
            secondary: brand.secondary.value.value,
            neutral: brand.neutral.value.value,
            good: brand.good.value.value,
            warning: brand.warning.value.value,
            bad: brand.bad.value.value,
            text: fontColor,
            background: "transparent",
            highContrast: false
        };
    }

    /** Colour for the n-th series, taken from the report theme so it follows the LB theme JSON. */
    seriesColor(key: string): string {
        const cp = this.host.colorPalette;
        return cp.isHighContrast ? cp.foreground.value : cp.getColor(key).value;
    }

    selectionIdForCategory(category: DataViewCategoryColumn, index: number): ISelectionId {
        return this.host.createSelectionIdBuilder().withCategory(category, index).createSelectionId();
    }

    selectionIdForRow(table: powerbi.DataViewTable, row: number): ISelectionId {
        return this.host.createSelectionIdBuilder().withTable(table, row).createSelectionId();
    }

    /**
     * Wire click / keyboard / context-menu selection onto marks.
     * `restyle` is called whenever the selection changes so the visual can dim unselected marks.
     */
    bindSelection<T extends Selectable>(
        background: d3.Selection<Element, unknown, null, undefined>,
        marks: d3.Selection<d3.BaseType, T, d3.BaseType, unknown>,
        restyle: (selected: ISelectionId[]) => void
    ): void {
        this.onSelectionChange = () => restyle(this.selection.getSelectionIds() as ISelectionId[]);
        const select = (event: MouseEvent | KeyboardEvent, d: T) => {
            if (!d.selectionId || !this.host.hostCapabilities.allowInteractions) return;
            const multi = event.ctrlKey || event.metaKey || event.shiftKey;
            this.selection.select(d.selectionId, multi).then(ids => restyle(ids as ISelectionId[]));
            event.stopPropagation();
        };
        marks
            .attr("tabindex", 0)
            .attr("focusable", true)
            .style("cursor", "pointer")
            .on("click", select)
            .on("keydown", (event: KeyboardEvent, d: T) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(event, d); }
            })
            .on("contextmenu", (event: MouseEvent, d: T) => {
                this.selection.showContextMenu(d.selectionId ?? {}, { x: event.clientX, y: event.clientY });
                event.preventDefault();
                event.stopPropagation();
            });
        background.on("click", () => this.selection.clear().then(() => restyle([])))
            .on("contextmenu", (event: MouseEvent) => {
                this.selection.showContextMenu({}, { x: event.clientX, y: event.clientY });
                event.preventDefault();
            });
        restyle(this.selection.getSelectionIds() as ISelectionId[]);
    }

    /** Opacity helper for restyle callbacks: full when nothing is selected or this mark is selected. */
    static opacity(d: Selectable, selected: ISelectionId[]): number {
        if (!selected.length) return 1;
        return selected.some(s => d.selectionId && s.equals(d.selectionId)) ? 1 : 0.3;
    }

    /** Show Power BI's native tooltip for marks. */
    bindTooltip<T>(
        marks: d3.Selection<d3.BaseType, T, d3.BaseType, unknown>,
        items: (d: T) => VisualTooltipDataItem[],
        identity?: (d: T) => ISelectionId | undefined
    ): void {
        const svc = this.host.tooltipService;
        if (!svc.enabled()) return;
        const args = (event: MouseEvent, d: T) => {
            const id = identity ? identity(d) : undefined;
            return { coordinates: [event.clientX, event.clientY], isTouchEvent: false, dataItems: items(d), identities: id ? [id] : [] };
        };
        marks
            .on("mouseover.tt", (e: MouseEvent, d: T) => svc.show(args(e, d)))
            .on("mousemove.tt", (e: MouseEvent, d: T) => svc.move(args(e, d)))
            .on("mouseout.tt", () => svc.hide({ immediately: false, isTouchEvent: false }));
    }
}

/** Extra tooltip rows from fields dropped in the "Tooltips" well (categorical mappings). */
export function tooltipExtras(cat: powerbi.DataViewCategorical | undefined, index: number): VisualTooltipDataItem[] {
    const out: VisualTooltipDataItem[] = [];
    const values = cat?.values;
    if (!values) return out;
    for (let i = 0; i < values.length; i++) {
        if (values[i].source.roles?.["tooltips"]) out.push({ displayName: values[i].source.displayName, value: formatValue(values[i].values[index], values[i].source) });
    }
    return out;
}

/** Format a value with the column's model format string (e.g. currency, %, dates). */
export function formatValue(value: PrimitiveValue | Date | null | undefined, column?: DataViewMetadataColumn, precision?: number): string {
    if (value === null || value === undefined) return "(blank)";
    // Dates without a model format string would otherwise print with a midnight time stamp.
    if (value instanceof Date && !column?.format) return d3.timeFormat("%b %-d, %Y")(value);
    const fmt = valueFormatter.create({ format: column?.format, value: typeof value === "number" ? value : undefined, precision });
    return fmt.format(value);
}

/**
 * Compact number formatting for axis ticks and labels: 3 significant digits with K / M / B,
 * keeping a currency symbol or % from the column's format string.
 */
export function formatCompact(value: number, column?: DataViewMetadataColumn): string {
    const fmt = column?.format ?? "";
    if (fmt.includes("%")) return valueFormatter.create({ format: fmt }).format(value);
    const currency = (fmt.match(/[$€£¥]/) ?? [""])[0];
    const abs = Math.abs(value);
    const [div, unit] = abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : abs >= 1e3 ? [1e3, "K"] : [1, ""];
    const scaled = abs / div;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const text = (+scaled.toFixed(digits)).toString();
    return `${value < 0 ? "-" : ""}${currency}${text}${unit}`;
}

/** Coerce a data value to a JS Date (Power BI sends Date objects, but strings / numbers occur). */
export function toDate(v: PrimitiveValue | Date | null | undefined): Date | null {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === "number") {
        // Year-only values usually mean the field is still set to "Date Hierarchy".
        if (v > 1000 && v < 3000) return null;
        return new Date(v);
    }
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d;
}

export function toNumber(v: PrimitiveValue | null | undefined): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return isFinite(n) ? n : null;
}

/** Find a category column or measure column by data-role name. */
export function categoryByRole(categories: DataViewCategoryColumn[] | undefined, role: string): DataViewCategoryColumn | undefined {
    return categories?.find(c => c.source.roles?.[role]);
}

export function valueByRole(values: powerbi.DataViewValueColumns | undefined, role: string): DataViewValueColumn | undefined {
    if (!values) return undefined;
    for (let i = 0; i < values.length; i++) {
        if (values[i].source.roles?.[role]) return values[i];
    }
    return undefined;
}

/** Index of a table column by data-role name (for table data-view mappings). */
export function tableColumn(table: powerbi.DataViewTable, role: string): number {
    return table.columns.findIndex(c => c.roles?.[role]);
}

/**
 * Landing page shown when required fields are missing. Explains which fields to drop in,
 * which matters for first-time Power BI users.
 */
export function renderLanding(root: HTMLElement, title: string, lines: string[], palette?: Palette): void {
    const sel = d3.select(root);
    sel.selectAll("*").remove();
    const box = sel.append("div").attr("class", "lb-landing")
        .style("color", palette?.text ?? "#2D2926");
    box.append("div").attr("class", "lb-landing-bar").style("background", palette?.primary ?? "#78BE20");
    box.append("div").attr("class", "lb-landing-title").text(title);
    const ul = box.append("ul");
    lines.forEach(l => ul.append("li").text(l));
}

/** Truncate text to a pixel width using an off-screen measure. */
export function fitText(text: string, maxWidth: number, fontSizePx: number): string {
    const approx = fontSizePx * 0.55;
    if (text.length * approx <= maxWidth) return text;
    const n = Math.max(1, Math.floor(maxWidth / approx) - 1);
    return text.slice(0, n) + "…";
}

export function textWidth(text: string, fontSizePx: number): number {
    return text.length * fontSizePx * 0.55;
}
