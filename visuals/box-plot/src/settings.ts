import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;
import IEnumMember = powerbi.IEnumMember;

const whiskerItems: IEnumMember[] = [{ value: "iqr", displayName: "1.5 × IQR (Tukey)" }, { value: "minmax", displayName: "Min / max" }];
const sortItems: IEnumMember[] = [{ value: "data", displayName: "Data order" }, { value: "name", displayName: "Name" }, { value: "median", displayName: "Median (high to low)" }];

class BoxCard extends Card {
    whiskers = new formattingSettings.ItemDropdown({ name: "whiskers", displayName: "Whiskers", items: whiskerItems, value: whiskerItems[0] });
    sortBy = new formattingSettings.ItemDropdown({ name: "sortBy", displayName: "Sort boxes by", items: sortItems, value: sortItems[0] });
    showMean = new formattingSettings.ToggleSwitch({ name: "showMean", displayName: "Show mean (×)", value: true });
    showPoints = new formattingSettings.ToggleSwitch({ name: "showPoints", displayName: "Show all points", value: false });

    name = "box";
    displayName = "Box plot";
    slices: Slice[] = [this.whiskers, this.sortBy, this.showMean, this.showPoints];
}

export class Settings extends formattingSettings.Model {
    box = new BoxCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.box, this.brand, this.text];
}
