import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class VarianceCard extends Card {
    higherIsBetter = new formattingSettings.ToggleSwitch({ name: "higherIsBetter", displayName: "Higher is better (off for costs)", value: true });
    showAbsolute = new formattingSettings.ToggleSwitch({ name: "showAbsolute", displayName: "Show variance (Δ) bars", value: true });
    showPercent = new formattingSettings.ToggleSwitch({ name: "showPercent", displayName: "Show variance % pins", value: true });
    showTotal = new formattingSettings.ToggleSwitch({ name: "showTotal", displayName: "Show total column", value: true });
    actualLabel = new formattingSettings.TextInput({ name: "actualLabel", displayName: "Actual label", value: "AC", placeholder: "AC" });
    planLabel = new formattingSettings.TextInput({ name: "planLabel", displayName: "Comparison label", value: "PL", placeholder: "PL or PY" });

    name = "variance";
    displayName = "Variance";
    slices: Slice[] = [this.higherIsBetter, this.showAbsolute, this.showPercent, this.showTotal, this.actualLabel, this.planLabel];
}

export class Settings extends formattingSettings.Model {
    variance = new VarianceCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.variance, this.brand, this.text];
}
