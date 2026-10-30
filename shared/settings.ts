import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BRAND } from "./brand";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

function color(name: string, displayName: string, value: string) {
    return new formattingSettings.ColorPicker({ name, displayName, value: { value } });
}

/** "Brand colors" card. Every visual exposes this so a report can be re-skinned without a rebuild. */
export class BrandCard extends Card {
    primary = color("primary", "Primary", BRAND.green);
    secondary = color("secondary", "Secondary", BRAND.charcoal);
    neutral = color("neutral", "Neutral / gridlines", BRAND.mist);
    good = color("good", "Good / on track", BRAND.good);
    warning = color("warning", "Warning / at risk", BRAND.warning);
    bad = color("bad", "Bad / off track", BRAND.bad);

    name = "brand";
    displayName = "Brand colors";
    slices: Slice[] = [this.primary, this.secondary, this.neutral, this.good, this.warning, this.bad];
}

/** "Text" card shared by every visual. */
export class TextCard extends Card {
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayName: "Font size", value: 11
    });
    fontColor = color("fontColor", "Font color", BRAND.charcoal);
    showLabels = new formattingSettings.ToggleSwitch({ name: "showLabels", displayName: "Data labels", value: true });

    name = "text";
    displayName = "Text & labels";
    slices: Slice[] = [this.fontSize, this.fontColor, this.showLabels];
}

/** Font size from the Text card, clamped to a readable range. */
export function fontSize(card: TextCard): number {
    return Math.max(7, Math.min(28, card.fontSize.value || 11));
}
