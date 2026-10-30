/*
 * Lerch Bates brand defaults shared by every visual.
 *
 * IMPORTANT: the hex values below are PLACEHOLDERS. Public sources confirm the
 * 2022 identity is built around "LB Bright Green", but no official hex value
 * was available when these visuals were built. Replace the values here (and in
 * theme/LerchBates.theme.json) with the codes from the LB brand guide, then
 * rebuild with `npm run build`. Every colour can also be overridden per visual
 * in the Power BI Format pane without rebuilding.
 */
export const BRAND = {
    green: "#78BE20",      // LB Bright Green (placeholder hex)
    charcoal: "#2D2926",   // primary text / dark fills
    slate: "#5B6770",      // secondary text, axes
    mist: "#D9DCDE",       // gridlines, empty cells, plan outlines
    teal: "#00857C",
    blue: "#0072CE",
    good: "#4C9A2A",       // darker green so "good" stays readable on white
    warning: "#F2A900",
    bad: "#C8102E",
    background: "#FFFFFF"
};

export const FONT_FAMILY = "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
