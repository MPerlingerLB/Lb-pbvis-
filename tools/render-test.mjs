// Renders every built visual in headless Chromium with a mock Power BI host and sample data,
// saves screenshots to docs/img/, and fails if a visual throws, renders nothing, or ignores clicks/tooltips.
//   node tools/render-test.mjs [folder ...]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fixtures, toDataView } from "./fixtures.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const visuals = JSON.parse(fs.readFileSync(path.join(root, "tools/visuals.json"), "utf8"));
const only = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const imgDir = path.join(root, "docs/img");
fs.mkdirSync(imgDir, { recursive: true });
const browser = await chromium.launch();
const failures = [];

for (const v of visuals) {
    if (only.length && !only.includes(v.dir)) continue;
    const fx = fixtures[v.dir];
    if (!fx) { console.log(`skip ${v.dir}: no fixture`); continue; }
    const drop = path.join(root, "visuals", v.dir, ".tmp/drop");
    const page = await browser.newPage({ viewport: { width: fx.width ?? 760, height: fx.height ?? 420 } });
    await page.goto("file://" + path.join(root, "tools/harness.html"));
    await page.addStyleTag({ path: path.join(drop, "visual.css") });
    await page.addScriptTag({ path: path.join(drop, "visual.js") });

    const scenarios = [
        { name: "", dataView: toDataView(fx), hc: false },
        { name: "-empty", dataView: { metadata: { columns: [] } }, hc: false },
        { name: "-highcontrast", dataView: toDataView(fx), hc: true }
    ];
    for (const sc of scenarios) {
        const result = await page.evaluate(({ guid, dataView, hc, w, h }) => {
            const host = document.getElementById("host");
            host.innerHTML = ""; host.style.width = w + "px"; host.style.height = h + "px";
            host.style.background = hc ? "#000" : "#fff";
            __calls.errors = []; __calls.tooltip = 0; __calls.select = 0; window.__rendered = 0;
            const el = document.createElement("div"); el.style.width = w + "px"; el.style.height = h + "px"; host.appendChild(el);
            try {
                const vis = powerbi.visuals.plugins[guid].create({ element: el, host: makeHost({ highContrast: hc }) });
                vis.update({ dataViews: [dataView], viewport: { width: w, height: h }, type: 2 });
                vis.getFormattingModel && vis.getFormattingModel();
                // Resize to small to catch layout exceptions.
                vis.update({ dataViews: [dataView], viewport: { width: 220, height: 140 }, type: 4 });
                vis.update({ dataViews: [dataView], viewport: { width: w, height: h }, type: 4 });
            } catch (e) { __calls.errors.push(String(e && e.stack || e)); }
            const marks = el.querySelectorAll("[tabindex]");
            if (marks.length) {
                const m = marks[0];
                const r = m.getBoundingClientRect();
                m.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: r.x + 1, clientY: r.y + 1 }));
                m.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            }
            return { errors: __calls.errors, rendered: window.__rendered, marks: marks.length, nodes: el.querySelectorAll("*").length, tooltip: __calls.tooltip, select: __calls.select };
        }, { guid: v.guid, dataView: sc.dataView, hc: sc.hc, w: fx.width ?? 760, h: fx.height ?? 420 });
        await page.waitForTimeout(50);
        if (!sc.name) {
            // Reset selection dimming before the screenshot.
            await page.evaluate(({ guid, dataView, w, h }) => {
                const host = document.getElementById("host"); host.innerHTML = "";
                const el = document.createElement("div"); el.style.width = w + "px"; el.style.height = h + "px"; host.appendChild(el);
                powerbi.visuals.plugins[guid].create({ element: el, host: makeHost({}) }).update({ dataViews: [dataView], viewport: { width: w, height: h }, type: 2 });
            }, { guid: v.guid, dataView: sc.dataView, w: fx.width ?? 760, h: fx.height ?? 420 });
        }
        const shot = path.join(sc.name ? path.join(root, ".tmp") : imgDir, `${v.dir}${sc.name}.png`);
        fs.mkdirSync(path.dirname(shot), { recursive: true });
        await page.locator("#host").screenshot({ path: shot });
        const problems = [];
        if (result.errors.length) problems.push("errors: " + result.errors.join(" | "));
        if (result.rendered < 1) problems.push("renderingFinished never called");
        if (!sc.name.includes("empty")) {
            if (result.nodes < 5) problems.push("rendered almost nothing");
            if (fx.interactive !== false && !result.marks) problems.push("no focusable marks");
            if (fx.interactive !== false && result.marks && (!result.tooltip || !result.select)) problems.push(`tooltip=${result.tooltip} select=${result.select}`);
        }
        console.log(`${problems.length ? "FAIL" : "ok  "} ${v.dir}${sc.name || " (sample)"}  nodes=${result.nodes} marks=${result.marks}${problems.length ? "\n     " + problems.join("\n     ") : ""}`);
        if (problems.length) failures.push(v.dir + sc.name);
    }
    await page.close();
}
await browser.close();
if (failures.length) { console.error(`\n${failures.length} failing scenario(s)`); process.exit(1); }
