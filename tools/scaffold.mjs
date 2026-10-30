// Creates (or refreshes) the boilerplate for every visual listed in tools/visuals.json.
// Source files (src/visual.ts, src/settings.ts, capabilities.json) are never overwritten.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const visuals = JSON.parse(fs.readFileSync(path.join(root, "tools/visuals.json"), "utf8"));
const version = JSON.parse(fs.readFileSync(path.join(root, "tools/version.json"), "utf8")).version;

const write = (file, content, overwrite = true) => {
    if (!overwrite && fs.existsSync(file)) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n");
};

for (const v of visuals) {
    const dir = path.join(root, "visuals", v.dir);
    write(path.join(dir, "package.json"), {
        name: `lb-${v.dir}`, private: true, version, description: v.description, license: "MIT",
        scripts: { start: "pbiviz start", package: "pbiviz package", lint: "npx eslint ." }
    });
    write(path.join(dir, "pbiviz.json"), {
        visual: {
            name: v.name, displayName: v.displayName, guid: v.guid, visualClassName: "Visual",
            version, description: v.description,
            supportUrl: "https://github.com/mperlingerlb/lb-pbvis-", gitHubUrl: "https://github.com/mperlingerlb/lb-pbvis-"
        },
        apiVersion: "5.11.1",
        author: { name: "Lerch Bates", email: "matthew.perlinger@lerchbates.com" },
        assets: { icon: "assets/icon.png" },
        externalJS: null, style: "style/visual.less", capabilities: "capabilities.json",
        dependencies: null, stringResources: [], version
    });
    write(path.join(dir, "tsconfig.json"), {
        compilerOptions: {
            allowJs: false, emitDecoratorMetadata: true, experimentalDecorators: true, target: "es2022",
            sourceMap: true, outDir: "./.tmp/build/", moduleResolution: "node", declaration: true,
            strict: false, noImplicitAny: true, lib: ["es2022", "dom"]
        },
        files: ["./src/visual.ts"]
    });
    write(path.join(dir, "eslint.config.mjs"),
`import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
    powerbiVisualsConfigs.configs.recommended,
    { ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**"] },
];
`);
    // Visuals share the root node_modules (pbiviz insists on finding packages next to pbiviz.json).
    const nm = path.join(dir, "node_modules");
    if (!fs.existsSync(nm)) fs.symlinkSync(path.join("..", "..", "node_modules"), nm, "dir");
    // shared/ is copied (not imported across folders) because pbiviz's webpack uses symlinks:false,
    // which would otherwise bundle two copies of the formatting-model library and break the Format pane.
    fs.rmSync(path.join(dir, "src/shared"), { recursive: true, force: true });
    fs.cpSync(path.join(root, "shared"), path.join(dir, "src/shared"), { recursive: true });
    write(path.join(dir, "style/visual.less"), `@import "../src/shared/common.less";\n`, false);
}
console.log(`Scaffolded ${visuals.length} visuals (v${version}).`);
