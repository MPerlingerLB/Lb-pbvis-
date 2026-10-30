import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class CalendarCard extends Card {
    weekStartsMonday = new formattingSettings.ToggleSwitch({ name: "weekStartsMonday", displayName: "Week starts Monday", value: false });
    lowColor = new formattingSettings.ColorPicker({ name: "lowColor", displayName: "Low value color", value: { value: "#EEF6E4" } });
    highColor = new formattingSettings.ColorPicker({ name: "highColor", displayName: "High value color (blank = Primary)", value: { value: "" } });
    zeroIsEmpty = new formattingSettings.ToggleSwitch({ name: "zeroIsEmpty", displayName: "Show zero as empty", value: false });
    showLegend = new formattingSettings.ToggleSwitch({ name: "showLegend", displayName: "Legend", value: true });
    cellGap = new formattingSettings.NumUpDown({ name: "cellGap", displayName: "Cell gap (px)", value: 2 });

    name = "calendar";
    displayName = "Calendar";
    slices: Slice[] = [this.weekStartsMonday, this.lowColor, this.highColor, this.zeroIsEmpty, this.showLegend, this.cellGap];
}

export class Settings extends formattingSettings.Model {
    calendar = new CalendarCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.calendar, this.brand, this.text];
}
