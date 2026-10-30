// Builds every visual into dist/<Display-Name>.pbiviz.
//   node tools/build-all.mjs              build all
//   node tools/build-all.mjs bullet-chart build one (folder name)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const visuals = JSON.parse(fs.readFileSync(path.join(root, "tools/visuals.json"), "utf8"));
const version = JSON.parse(fs.readFileSync(path.join(root, "tools/version.json"), "utf8")).version;
const pbiviz = path.join(root, "node_modules/.bin/pbiviz");
const only = process.argv.slice(2);

const fill = { type: { fill: { solid: { color: true } } } };
// Format-pane objects every visual shares (must match shared/settings.ts).
const sharedObjects = {
    brand: {
        properties: { primary: fill, secondary: fill, neutral: fill, good: fill, warning: fill, bad: fill }
    },
    text: {
        properties: {
            fontSize: { type: { formatting: { fontSize: true } } },
            fontColor: fill,
            showLabels: { type: { bool: true } }
        }
    }
};
const sharedFlags = {
    supportsHighlight: false,
    supportsLandingPage: true,
    supportsEmptyDataView: true,
    supportsKeyboardFocus: true,
    supportsMultiVisualSelection: true,
    suppressDefaultTitle: false,
    tooltips: { supportedTypes: { default: true, canvas: true }, roles: ["tooltips"] },
    privileges: []
};

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
execFileSync("node", [path.join(root, "tools/scaffold.mjs")], { stdio: "inherit" });
execFileSync("node", [path.join(root, "tools/icons.mjs")], { stdio: "inherit" });

const failures = [];
for (const v of visuals) {
    if (only.length && !only.includes(v.dir)) continue;
    const dir = path.join(root, "visuals", v.dir);
    const capPath = path.join(dir, "capabilities.json");
    const cap = JSON.parse(fs.readFileSync(capPath, "utf8"));
    cap.objects = { ...cap.objects, ...sharedObjects };
    Object.assign(cap, sharedFlags);
    if (!cap.dataRoles.some(r => r.name === "tooltips")) {
        cap.dataRoles.push({ displayName: "Tooltips", name: "tooltips", kind: "Measure" });
    }
    fs.writeFileSync(capPath, JSON.stringify(cap, null, 2) + "\n");

    console.log(`\n=== ${v.displayName} ===`);
    try {
        // Lint first: pbiviz reports lint errors but still produces a package.
        execFileSync(path.join(root, "node_modules/.bin/eslint"), ["."], { cwd: dir, stdio: "inherit" });
        execFileSync(pbiviz, ["package"], { cwd: dir, stdio: "inherit" });
        const built = fs.readdirSync(path.join(dir, "dist")).find(f => f.endsWith(".pbiviz"));
        const out = `${v.displayName.replace(/[^A-Za-z0-9]+/g, "-").replace(/-+$/, "")}-${version}.pbiviz`;
        fs.copyFileSync(path.join(dir, "dist", built), path.join(root, "dist", out));
        console.log(`-> dist/${out}`);
    } catch (e) {
        failures.push(v.dir);
    }
}
if (failures.length) {
    console.error(`\nFAILED: ${failures.join(", ")}`);
    process.exit(1);
}
