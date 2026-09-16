#!/usr/bin/env node
// Renders an Archify architecture source to a standalone SVG the README can embed.
// Usage: node scripts/archify-svg.mjs <archify checkout>/archify <source.archify.json> <out.svg>
// Archify delivers HTML with the stylesheet in the page head; this inlines it into the SVG inside CDATA.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [archifyDir, source, out] = process.argv.slice(2);
if (!archifyDir || !source || !out) {
  console.error("usage: archify-svg.mjs <archify dir> <source.archify.json> <out.svg>");
  process.exit(2);
}
const html = join(mkdtempSync(join(tmpdir(), "archify-")), "out.html");
const receipt = JSON.parse(execFileSync("node", ["bin/archify.mjs", "deliver", "architecture", source, html, "--quality", "showcase", "--json"], { cwd: archifyDir, encoding: "utf8" }));
if (!receipt.ok) {
  console.error(receipt.error ?? "archify deliver failed");
  process.exit(1);
}
const page = readFileSync(html, "utf8");
const css = [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n").replace(/\]\]>/g, "]]]]><![CDATA[>");
let svg = /<svg\b[\s\S]*?<\/svg>/.exec(page)[0];
if (!/xmlns=/.test(svg.slice(0, 300))) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
svg = svg.replace(/^(<svg\b[^>]*>)/, (m) => `${m}\n<style><![CDATA[\n${css}\n]]></style>`);
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
