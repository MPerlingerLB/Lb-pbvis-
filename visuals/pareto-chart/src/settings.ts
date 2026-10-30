import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class ParetoCard extends Card {
    threshold = new formattingSettings.NumUpDown({ name: "threshold", displayName: "Cut-off (cumulative %)", value: 80 });
    showThreshold = new formattingSettings.ToggleSwitch({ name: "showThreshold", displayName: "Show cut-off line", value: true });
    highlightVitalFew = new formattingSettings.ToggleSwitch({ name: "highlightVitalFew", displayName: "Highlight the vital few", value: true });
    maxBars = new formattingSettings.NumUpDown({ name: "maxBars", displayName: "Max bars (rest grouped as 'All others')", value: 15 });
    lineColor = new formattingSettings.ColorPicker({ name: "lineColor", displayName: "Cumulative line color (blank = Secondary)", value: { value: "" } });

    name = "pareto";
    displayName = "Pareto";
    slices: Slice[] = [this.threshold, this.showThreshold, this.highlightVitalFew, this.maxBars, this.lineColor];
}

export class Settings extends formattingSettings.Model {
    pareto = new ParetoCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.pareto, this.brand, this.text];
}
