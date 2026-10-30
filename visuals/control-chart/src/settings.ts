import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class SpcCard extends Card {
    baselinePoints = new formattingSettings.NumUpDown({ name: "baselinePoints", displayName: "Points used for limits (0 = all)", value: 0 });
    ruleOutside = new formattingSettings.ToggleSwitch({ name: "ruleOutside", displayName: "Flag points outside limits", value: true });
    ruleRun = new formattingSettings.ToggleSwitch({ name: "ruleRun", displayName: "Flag runs on one side of the mean", value: true });
    runLength = new formattingSettings.NumUpDown({ name: "runLength", displayName: "Run length", value: 8 });
    ruleTwoOfThree = new formattingSettings.ToggleSwitch({ name: "ruleTwoOfThree", displayName: "Flag 2 of 3 beyond 2 sigma", value: false });
    showZones = new formattingSettings.ToggleSwitch({ name: "showZones", displayName: "Shade sigma zones", value: true });
    floorAtZero = new formattingSettings.ToggleSwitch({ name: "floorAtZero", displayName: "Lower limit can't go below zero", value: true });
    lineColor = new formattingSettings.ColorPicker({ name: "lineColor", displayName: "Line color (blank = Secondary)", value: { value: "" } });

    name = "spc";
    displayName = "Control chart";
    slices: Slice[] = [this.baselinePoints, this.ruleOutside, this.ruleRun, this.runLength, this.ruleTwoOfThree, this.showZones, this.floorAtZero, this.lineColor];
}

export class Settings extends formattingSettings.Model {
    spc = new SpcCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.spc, this.brand, this.text];
}
