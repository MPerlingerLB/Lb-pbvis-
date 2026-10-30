// Renders the 20x20 format-pane icons (assets/icon.png) from inline SVG using the pre-installed Playwright.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const visuals = JSON.parse(fs.readFileSync(path.join(root, "tools/visuals.json"), "utf8"));
const missing = visuals.filter(v => !fs.existsSync(path.join(root, "visuals", v.dir, "assets/icon.png")));
if (!missing.length) process.exit(0);

const G = "#78BE20", C = "#2D2926", M = "#B9BEC2";
const glyphs = {
    bullet: `<rect x="1" y="6" width="18" height="8" fill="${M}"/><rect x="1" y="6" width="12" height="8" fill="#9AA0A6"/><rect x="1" y="8.5" width="10" height="3" fill="${G}"/><rect x="14" y="5" width="1.6" height="10" fill="${C}"/>`,
    calendar: [0,1,2,3].map(r => [0,1,2,3].map(c => `<rect x="${1+c*4.75}" y="${1+r*4.75}" width="4" height="4" fill="${G}" opacity="${[.25,.6,1,.4,.8,.3,.5,1,.2,.9,.6,.35,.7,.45,1,.55][r*4+c]}"/>`).join("")).join(""),
    pareto: `<rect x="1" y="5" width="4" height="14" fill="${G}"/><rect x="6" y="10" width="4" height="9" fill="${G}"/><rect x="11" y="14" width="3.5" height="5" fill="${M}"/><rect x="15.5" y="16" width="3.5" height="3" fill="${M}"/><polyline points="3,9 8,4.5 12.75,2.5 17.25,1.5" fill="none" stroke="${C}" stroke-width="1.5"/>`,
    control: `<line x1="0" y1="3" x2="20" y2="3" stroke="#C8102E" stroke-dasharray="2 1.5"/><line x1="0" y1="17" x2="20" y2="17" stroke="#C8102E" stroke-dasharray="2 1.5"/><line x1="0" y1="10" x2="20" y2="10" stroke="${M}"/><polyline points="1,11 4,8 7,12 10,9 13,11 16,6 19,2" fill="none" stroke="${C}" stroke-width="1.4"/><circle cx="19" cy="2" r="1.8" fill="#C8102E"/>`,
    box: `<line x1="6" y1="2" x2="6" y2="18" stroke="${C}"/><rect x="3" y="6" width="6" height="8" fill="${G}" stroke="${C}"/><line x1="3" y1="10" x2="9" y2="10" stroke="${C}" stroke-width="1.5"/><line x1="14" y1="4" x2="14" y2="16" stroke="${C}"/><rect x="11" y="7" width="6" height="6" fill="${M}" stroke="${C}"/><line x1="11" y1="9" x2="17" y2="9" stroke="${C}" stroke-width="1.5"/>`,
    sankey: `<rect x="1" y="2" width="3" height="7" fill="${C}"/><rect x="1" y="11" width="3" height="7" fill="${C}"/><rect x="16" y="2" width="3" height="10" fill="${C}"/><rect x="16" y="14" width="3" height="4" fill="${C}"/><path d="M4 5.5 C10 5.5 10 7 16 7" stroke="${G}" stroke-width="7" fill="none" opacity=".8"/><path d="M4 14.5 C10 14.5 10 16 16 16" stroke="${M}" stroke-width="4" fill="none"/><path d="M4 12 C10 12 10 10 16 10" stroke="${G}" stroke-width="3" fill="none" opacity=".6"/>`,
    gantt: `<rect x="2" y="2" width="9" height="3" fill="${M}"/><rect x="2" y="5" width="10" height="2" fill="${G}"/><rect x="6" y="9" width="8" height="3" fill="${M}"/><rect x="7" y="12" width="10" height="2" fill="#C8102E"/><rect x="11" y="15.5" width="7" height="3" fill="${G}"/><line x1="13" y1="0" x2="13" y2="20" stroke="${C}" stroke-dasharray="1.5 1"/>`,
    timeline: `<line x1="1" y1="6" x2="19" y2="6" stroke="${M}"/><line x1="1" y1="14" x2="19" y2="14" stroke="${M}"/><path d="M5 3 L8 6 L5 9 L2 6Z" fill="${G}"/><path d="M14 3 L17 6 L14 9 L11 6Z" fill="${C}"/><path d="M9 11 L12 14 L9 17 L6 14Z" fill="#F2A900"/><path d="M17 11 L20 14 L17 17 L14 14Z" fill="${G}"/>`,
    variance: `<rect x="2" y="3" width="3" height="4" fill="${G}"/><rect x="8" y="7" width="3" height="3" fill="#C8102E"/><rect x="14" y="2" width="3" height="5" fill="${G}"/><line x1="0" y1="7" x2="20" y2="7" stroke="${C}"/><rect x="1.5" y="10" width="4" height="9" fill="${C}"/><rect x="7.5" y="12" width="4" height="7" fill="${C}"/><rect x="13.5" y="9" width="4" height="10" fill="${C}"/>`,
    grid: `<rect x="1" y="1" width="8" height="8" rx="1.5" fill="${G}"/><rect x="11" y="1" width="8" height="8" rx="1.5" fill="#F2A900"/><rect x="1" y="11" width="8" height="8" rx="1.5" fill="${G}"/><rect x="11" y="11" width="8" height="8" rx="1.5" fill="#C8102E"/>`
};

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 20, height: 20 } });
for (const v of missing) {
    await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${glyphs[v.glyph]}</svg></body></html>`);
    const out = path.join(root, "visuals", v.dir, "assets/icon.png");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: 20, height: 20 } });
    console.log(`icon -> ${path.relative(root, out)}`);
}
await browser.close();
