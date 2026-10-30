// Writes samples/*.csv from tools/fixtures.mjs so users can try each visual without their own data.
import fs from "node:fs";
import path from "node:path";
import { fixtures } from "./fixtures.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
fs.mkdirSync(path.join(root, "samples"), { recursive: true });
const cell = v => v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10)
    : typeof v === "string" && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v);
for (const fx of Object.values(fixtures)) {
    const lines = [fx.columns.map(cell).join(","), ...fx.rows.map(r => r.map(cell).join(","))];
    fs.writeFileSync(path.join(root, "samples", fx.file), lines.join("\r\n") + "\r\n");
    console.log(`samples/${fx.file}`);
}
