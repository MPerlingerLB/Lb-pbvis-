import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;

class StatusCard extends Card {
    sortWorstFirst = new formattingSettings.ToggleSwitch({ name: "sortWorstFirst", displayName: "Sort worst first", value: true });
    showSummary = new formattingSettings.ToggleSwitch({ name: "showSummary", displayName: "Summary bar (counts by status)", value: true });
    tileWidth = new formattingSettings.NumUpDown({ name: "tileWidth", displayName: "Minimum tile width (px)", value: 190 });
    higherScoreIsBetter = new formattingSettings.ToggleSwitch({ name: "higherScoreIsBetter", displayName: "Score: higher is better", value: true });
    goodAt = new formattingSettings.NumUpDown({ name: "goodAt", displayName: "Score: green at or beyond", value: 80 });
    warnAt = new formattingSettings.NumUpDown({ name: "warnAt", displayName: "Score: amber at or beyond", value: 60 });

    name = "status";
    displayName = "Status";
    slices: Slice[] = [this.sortWorstFirst, this.showSummary, this.tileWidth, this.higherScoreIsBetter, this.goodAt, this.warnAt];
}

export class Settings extends formattingSettings.Model {
    status = new StatusCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.status, this.brand, this.text];
}
