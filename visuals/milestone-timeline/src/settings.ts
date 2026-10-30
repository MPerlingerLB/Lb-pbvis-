import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class TimelineCard extends Card {
    showToday = new formattingSettings.ToggleSwitch({ name: "showToday", displayName: "Today line", value: true });
    showLegend = new formattingSettings.ToggleSwitch({ name: "showLegend", displayName: "Status legend", value: true });
    laneLabelWidth = new formattingSettings.NumUpDown({ name: "laneLabelWidth", displayName: "Swimlane label width (px)", value: 120 });
    markerSize = new formattingSettings.NumUpDown({ name: "markerSize", displayName: "Marker size (px)", value: 12 });

    name = "timeline";
    displayName = "Timeline";
    slices: Slice[] = [this.showToday, this.showLegend, this.laneLabelWidth, this.markerSize];
}

export class Settings extends formattingSettings.Model {
    timeline = new TimelineCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.timeline, this.brand, this.text];
}
