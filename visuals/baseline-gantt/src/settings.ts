import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class GanttCard extends Card {
    showToday = new formattingSettings.ToggleSwitch({ name: "showToday", displayName: "Today line", value: true });
    showSlip = new formattingSettings.ToggleSwitch({ name: "showSlip", displayName: "Show slip (days late / early)", value: true });
    slipWarnDays = new formattingSettings.NumUpDown({ name: "slipWarnDays", displayName: "Amber up to (days late)", value: 7 });
    showGroupSummary = new formattingSettings.ToggleSwitch({ name: "showGroupSummary", displayName: "Group summary bars", value: true });
    rowHeight = new formattingSettings.NumUpDown({ name: "rowHeight", displayName: "Row height (px)", value: 30 });
    labelWidth = new formattingSettings.NumUpDown({ name: "labelWidth", displayName: "Task label width (px)", value: 170 });

    name = "gantt";
    displayName = "Gantt";
    slices: Slice[] = [this.showToday, this.showSlip, this.slipWarnDays, this.showGroupSummary, this.rowHeight, this.labelWidth];
}

export class Settings extends formattingSettings.Model {
    gantt = new GanttCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.gantt, this.brand, this.text];
}
