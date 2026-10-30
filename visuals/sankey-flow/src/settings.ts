import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BrandCard, TextCard } from "./shared/settings";

import Card = formattingSettings.SimpleCard;
import Slice = formattingSettings.Slice;
import IEnumMember = powerbi.IEnumMember;

const alignItems: IEnumMember[] = [{ value: "justify", displayName: "Justify" }, { value: "left", displayName: "Left" }, { value: "right", displayName: "Right" }, { value: "center", displayName: "Center" }];
const linkItems: IEnumMember[] = [{ value: "source", displayName: "By source" }, { value: "target", displayName: "By destination" }, { value: "neutral", displayName: "Neutral" }];

class SankeyCard extends Card {
    align = new formattingSettings.ItemDropdown({ name: "align", displayName: "Node alignment", items: alignItems, value: alignItems[0] });
    linkColor = new formattingSettings.ItemDropdown({ name: "linkColor", displayName: "Link color", items: linkItems, value: linkItems[0] });
    nodeWidth = new formattingSettings.NumUpDown({ name: "nodeWidth", displayName: "Node width (px)", value: 14 });
    nodePadding = new formattingSettings.NumUpDown({ name: "nodePadding", displayName: "Node spacing (px)", value: 14 });
    linkOpacity = new formattingSettings.NumUpDown({ name: "linkOpacity", displayName: "Link opacity (%)", value: 40 });

    name = "sankey";
    displayName = "Sankey";
    slices: Slice[] = [this.align, this.linkColor, this.nodeWidth, this.nodePadding, this.linkOpacity];
}

export class Settings extends formattingSettings.Model {
    sankey = new SankeyCard();
    brand = new BrandCard();
    text = new TextCard();
    cards = [this.sankey, this.brand, this.text];
}
