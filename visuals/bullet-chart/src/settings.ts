import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class BulletCard extends Card {
    higherIsBetter = new formattingSettings.ToggleSwitch({ name: "higherIsBetter", displayName: "Higher is better", value: true });
    colorByPerformance = new formattingSettings.ToggleSwitch({ name: "colorByPerformance", displayName: "Color actual bar by performance", value: true });
    poorPct = new formattingSettings.NumUpDown({ name: "poorPct", displayName: "Poor band ends at (% of target)", value: 70 });
    satisfactoryPct = new formattingSettings.NumUpDown({ name: "satisfactoryPct", displayName: "Satisfactory band ends at (% of target)", value: 90 });
    maxPct = new formattingSettings.NumUpDown({ name: "maxPct", displayName: "Axis maximum (% of target)", value: 120 });
    sharedScale = new formattingSettings.ToggleSwitch({ name: "sharedScale", displayName: "Same scale for every row", value: true });
    labelWidth = new formattingSettings.NumUpDown({ name: "labelWidth", displayName: "Category label width (px)", value: 120 });

    name = "bullet";
    displayName = "Bullet";
    slices: Slice[] = [this.higherIsBetter, this.colorByPerformance, this.poorPct, this.satisfactoryPct, this.maxPct, this.sharedScale, this.labelWidth];
}

export class Settings extends formattingSettings.Model {
    bullet = new BulletCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.bullet, this.brand, this.text];
}
