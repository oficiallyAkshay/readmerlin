#!/usr/bin/env node
// Draws a hero SVG from its spec. A hero takes the shape of the product's own verb, so there is more than one layout:
//   "fan"          many scattered things gathered into one: sources, what gets handled fanning out, the one deliverable
//   "before-after" one thing made better: the page the reader has, the page they wanted, the differences called out
//   "pages"        one repo feeding several pages, each for a different reader: a typographic headline beside tiles of tiers
// Usage: node skills/readmerlin/scripts/hero-svg.mjs <name>.hero.json > <name>.svg
// No dependencies, so the installed skill carries it. test/hero.test.ts rebuilds every committed hero and fails when one has drifted from its spec.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// One glyph per name, drawn inside a square box of the given size. Add a glyph here before using a new icon name.
const ICONS = {
  folder: [28, '<path d="M2,8 h9 l3,4 h12 v16 h-24 z"/><path d="M2,12 h24"/>'],
  sparkles: [28, '<path d="M14,2 l2.5,7.5 L24,12 l-7.5,2.5 L14,22 l-2.5,-7.5 L4,12 l7.5,-2.5 z"/><path d="M24,20 l1,3 3,1 -3,1 -1,3 -1,-3 -3,-1 3,-1 z"/>'],
  mail: [28, '<rect x="0" y="4" width="28" height="19" rx="3"/><path d="M0,7 L14,17 L28,7"/>'],
  calendar: [28, '<rect x="1" y="4" width="26" height="22" rx="3"/><path d="M1,11 h26"/><path d="M8,1 v6"/><path d="M20,1 v6"/><path d="M8,17 h2"/><path d="M13,17 h2"/><path d="M18,17 h2"/>'],
  target: [20, '<circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="4"/><circle cx="10" cy="10" r="1"/>'],
  "badge-check": [20, '<path d="M10,1 l2.5,2 3,-0.5 1,3 2.5,1.5 -1,3 1,3 -2.5,1.5 -1,3 -3,-0.5 -2.5,2 -2.5,-2 -3,0.5 -1,-3 -2.5,-1.5 1,-3 -1,-3 2.5,-1.5 1,-3 3,0.5 z"/><path d="M6.5,10 l2.5,2.5 4.5,-5"/>'],
  image: [20, '<rect x="1" y="2" width="18" height="16" rx="2"/><circle cx="6" cy="7" r="1.5"/><path d="M1,15 l5,-5 4,4 3,-3 6,6"/>'],
  terminal: [20, '<rect x="1" y="2" width="18" height="16" rx="2"/><path d="M5,7 l4,3 -4,3"/><path d="M10,13 h5"/>'],
  shield: [20, '<path d="M10,1 l8,3 v6 c0,5 -4,8 -8,9 c-4,-1 -8,-4 -8,-9 v-6 z"/><path d="M6.5,10 l2.5,2.5 4.5,-5"/>'],
  link: [20, '<path d="M8,12 a3,3 0 0 1 0,-4 l3,-3 a3,3 0 0 1 4,4 l-1,1"/><path d="M12,8 a3,3 0 0 1 0,4 l-3,3 a3,3 0 0 1 -4,-4 l1,-1"/>'],
  scissors: [20, '<circle cx="5" cy="5" r="3"/><circle cx="5" cy="15" r="3"/><path d="M7.5,7 L19,17"/><path d="M7.5,13 L19,3"/>'],
  car: [20, '<path d="M2,12 l3,-6 h10 l3,6 h1 v6 h-2 a2,2 0 0 1 -4,0 h-6 a2,2 0 0 1 -4,0 h-2 v-6 z"/><path d="M4,12 h12"/>'],
  utensils: [20, '<path d="M5,1 v7 a2,2 0 0 0 4,0 v-7"/><path d="M7,8 v11"/><path d="M14,1 c-2,0 -3,3 -3,6 v3 h3 v9"/>'],
  plane: [20, '<path d="M2,12 l6,-1 5,-8 h2 l-2,8 5,0 2,-2 h1 l-1,4 1,4 h-1 l-2,-2 -5,0 2,8 h-2 l-5,-8 -6,-1 z"/>'],
  bed: [20, '<path d="M1,17 v-8 h18 v8"/><path d="M1,13 h18"/><path d="M3,9 v-3 h5 v3"/><path d="M1,17 v2"/><path d="M19,17 v2"/>'],
  train: [20, '<rect x="3" y="1" width="14" height="14" rx="3"/><path d="M3,9 h14"/><circle cx="7" cy="12" r="1"/><circle cx="13" cy="12" r="1"/><path d="M5,15 l-2,4"/><path d="M15,15 l2,4"/>'],
  wifi: [20, '<path d="M1,7 a13,13 0 0 1 18,0"/><path d="M4,10.5 a9,9 0 0 1 12,0"/><path d="M7,14 a5,5 0 0 1 6,0"/><circle cx="10" cy="17" r="1"/>'],
  more: [20, '<circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/>'],
};

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function glyph(name, x, y, size, extra = "") {
  const icon = ICONS[name];
  if (!icon) throw new Error(`Unknown icon "${name}". Known: ${Object.keys(ICONS).join(", ")}.`);
  const scale = +(size / icon[0]).toFixed(3);
  return `<g class="glyph" transform="translate(${x},${y})${scale === 1 ? "" : ` scale(${scale})`}"${extra}>${icon[1]}</g>`;
}

// The page the reader wanted. "document" is a README-like page, "table" is a summary with a total.
function page(kind, x, y, heading) {
  const out = [];
  out.push(`<rect class="sheet back2" x="${x + 28}" y="${y + 28}" width="212" height="274" rx="10"/>`);
  out.push(`<rect class="sheet back1" x="${x + 14}" y="${y + 14}" width="212" height="274" rx="10"/>`);
  out.push(`<rect class="sheet front" x="${x}" y="${y}" width="212" height="274" rx="10"/>`);
  if (kind === "table") {
    out.push(`<text class="title" x="${x + 22}" y="${y + 42}" font-size="20">${esc(heading)}</text>`);
    [96, 72, 110, 84, 100].forEach((w, i) => {
      const ry = y + 66 + i * 30;
      out.push(`<rect class="bar" x="${x + 22}" y="${ry}" width="${w}" height="8" rx="4"/><rect class="bar" x="${x + 150}" y="${ry}" width="${i % 2 ? 32 : 40}" height="8" rx="4"/>`);
    });
    out.push(`<path class="rule" d="M${x + 22},${y + 214} h168"/>`);
    out.push(`<rect class="pill" x="${x + 22}" y="${y + 230}" width="64" height="10" rx="5"/><rect class="pill" x="${x + 142}" y="${y + 230}" width="48" height="10" rx="5"/>`);
    return out;
  }
  out.push(`<text class="title" x="${x + 106}" y="${y + 40}" font-size="20" text-anchor="middle">${esc(heading)}</text>`);
  out.push(`<rect class="bar" x="${x + 56}" y="${y + 56}" width="100" height="8" rx="4"/>`);
  for (const dx of [34, 84, 134]) out.push(`<rect class="pill" x="${x + dx}" y="${y + 78}" width="38" height="10" rx="5"/>`);
  out.push(`<rect class="card" x="${x + 22}" y="${y + 104}" width="168" height="62" rx="8"/>`);
  out.push(`<path class="flow" d="M${x + 40},${y + 135} C ${x + 70},${y + 135} ${x + 90},${y + 118} ${x + 110},${y + 118}" marker-end="url(#arrow)"/>`);
  out.push(`<path class="flow" d="M${x + 40},${y + 135} C ${x + 70},${y + 135} ${x + 90},${y + 152} ${x + 110},${y + 152}" marker-end="url(#arrow)"/>`);
  out.push(`<circle class="dot" cx="${x + 38}" cy="${y + 135}" r="4"/>`);
  [120, 96, 132, 84].forEach((w, i) => out.push(`<rect class="bar" x="${x + 22}" y="${y + 186 + i * 20}" width="${w}" height="8" rx="4"/>`));
  out.push(`<g class="glyph ok" transform="translate(${x + 150},${y + 232}) scale(1.2)"><circle cx="10" cy="10" r="8"/><path d="M6.5,10 l2.5,2.5 4.5,-5"/></g>`);
  return out;
}

function head(o, spec, height) {
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${height}" width="1200" height="${height}" role="img" aria-labelledby="hero-title">`);
  o.push(`  <title id="hero-title">${esc(spec.title)}</title>`);
  o.push("  <defs>");
  o.push('    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#d97706"/></marker>');
  o.push('    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>');
  o.push("    <style>");
  o.push("      .card { fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; }");
  o.push("      .more { stroke-dasharray: 4 4; }");
  o.push("      .glyph { fill: none; stroke: #475569; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }");
  o.push("      .ok { stroke: #16a34a; }");
  o.push(`      .title { font-family: ${FONT}; fill: #0f172a; font-weight: 600; }`);
  o.push(`      .muted { font-family: ${FONT}; fill: #64748b; font-weight: 500; }`);
  o.push(`      .wrong { font-family: ${FONT}; fill: #b91c1c; font-weight: 600; }`);
  o.push("      .flow { fill: none; stroke: #d97706; stroke-width: 2; }");
  o.push("      .dot { fill: #d97706; }");
  o.push("      .bar { fill: #cbd5e1; }");
  o.push("      .pill { fill: #334155; }");
  o.push("      .code { fill: #1e293b; } .codeline { fill: #64748b; }");
  o.push("      .stale { fill: none; stroke: #dc2626; stroke-width: 2; stroke-dasharray: 3 3; } .dead { fill: #93c5fd; }");
  o.push("      .mark { fill: #dc2626; } .lead { stroke: #dc2626; stroke-width: 2; } .good { fill: #16a34a; } .goodlead { stroke: #16a34a; stroke-width: 2; }");
  o.push("      .fold { stroke: #dc2626; stroke-width: 2; stroke-dasharray: 6 5; }");
  o.push("      .rule { stroke: #94a3b8; stroke-width: 2; }");
  o.push("      .sheet { stroke: #94a3b8; stroke-width: 2; }");
  o.push("      .front { fill: #ffffff; stroke: #64748b; } .back1 { fill: #f4f7fa; } .back2 { fill: #eef2f7; }");
  o.push("      @media (prefers-color-scheme: dark) {");
  o.push("        .card { fill: #1e293b; stroke: #64748b; } .glyph { stroke: #cbd5e1; } .ok { stroke: #4ade80; }");
  o.push("        .title { fill: #f1f5f9; } .muted { fill: #94a3b8; } .wrong { fill: #fca5a5; } .bar { fill: #475569; } .pill { fill: #cbd5e1; } .rule { stroke: #64748b; }");
  o.push("        .code { fill: #020617; } .codeline { fill: #475569; } .dead { fill: #3b82f6; } .stale, .lead, .fold { stroke: #f87171; } .mark { fill: #f87171; } .good { fill: #4ade80; } .goodlead { stroke: #4ade80; }");
  o.push("        .sheet { stroke: #64748b; } .front { fill: #0f172a; stroke: #94a3b8; } .back1 { fill: #172033; } .back2 { fill: #1e293b; }");
  o.push("      }");
  o.push("    </style>");
  o.push("  </defs>");
}

// One thing made better. Left: the page the reader has, long, its faults marked in their words. Right: the short page they wanted, its parts named.
function renderBeforeAfter(spec) {
  const o = [];
  const H = 490;
  head(o, spec, H);
  const bars = (x, y, widths, cls = "bar", h = 8, step = 14) => widths.map((w, i) => `<rect class="${cls}" x="${x}" y="${y + i * step}" width="${w}" height="${h}" rx="${h / 2}"/>`).join("");
  const codeBlock = (x, y) => `<rect class="code" x="${x}" y="${y}" width="220" height="58" rx="6"/>${bars(x + 12, y + 12, [120, 168, 96], "codeline", 6, 14)}`;

  // Before: a long page that fades out, because nobody reaches the end of it.
  const bx = 216;
  const by = 20;
  o.push('  <mask id="long"><rect x="0" y="0" width="1200" height="430" fill="url(#fade)"/></mask>');
  o.push('  <g mask="url(#long)">');
  o.push(`    <rect class="sheet front" x="${bx}" y="${by}" width="260" height="410" rx="10"/>`);
  o.push(`    <rect class="pill" x="${bx + 20}" y="${by + 24}" width="120" height="12" rx="6"/>`);
  o.push(`    ${bars(bx + 20, by + 50, [220, 200, 180])}`);
  o.push(`    ${codeBlock(bx + 20, by + 104)}`);
  o.push(`    ${bars(bx + 20, by + 178, [210, 220, 150])}`);
  o.push(`    <rect class="pill" x="${bx + 20}" y="${by + 226}" width="44" height="10" rx="5"/><rect class="pill" x="${bx + 72}" y="${by + 226}" width="44" height="10" rx="5"/><rect class="stale" x="${bx + 124}" y="${by + 224}" width="52" height="14" rx="7"/>`);
  o.push(`    ${bars(bx + 20, by + 254, [200])}<rect class="dead" x="${bx + 20}" y="${by + 268}" width="96" height="8" rx="4"/>${bars(bx + 124, by + 268, [90])}`);
  o.push(`    ${codeBlock(bx + 20, by + 292)}`);
  o.push(`    ${bars(bx + 20, by + 366, [220, 190, 205])}`);
  o.push("  </g>");
  const anchors = { fold: by + 96, code: by + 133, badge: by + 231, link: by + 272 };
  o.push(`  <path class="fold" d="M${bx - 10},${anchors.fold} h280"/>`);
  const usedBefore = new Set();
  for (const p of spec.before.problems) {
    const y = anchors[p.at];
    if (y === undefined) throw new Error(`Unknown place "${p.at}" on the before page. Known: ${Object.keys(anchors).join(", ")}.`);
    if (usedBefore.has(p.at)) throw new Error(`Two problems at "${p.at}" on the before page. Each place holds one label.`);
    usedBefore.add(p.at);
    o.push(`  <circle class="mark" cx="${bx - 10}" cy="${y}" r="4"/><path class="lead" d="M${bx - 10},${y} h-12"/>`);
    o.push(`  <text class="wrong" x="${bx - 28}" y="${y + 5}" font-size="15" text-anchor="end">${esc(p.label)}</text>`);
  }
  o.push(`  <text class="title" x="${bx + 130}" y="462" font-size="17" text-anchor="middle">${esc(spec.before.label)}</text>`);

  // The one step in between. The mechanism is a single arrow.
  o.push(`  ${glyph(spec.by.icon, 571, 176, 34)}`);
  o.push('  <path class="flow" d="M496,240 L 680,240" marker-end="url(#arrow)"/>');
  o.push(`  <text class="title" x="588" y="270" font-size="16" text-anchor="middle">${esc(spec.by.label)}</text>`);
  if (spec.by.with) o.push(`  <text class="muted" x="588" y="290" font-size="14" text-anchor="middle">${esc(spec.by.with)}</text>`);

  // After: a short page, every part in its place.
  const ax = 700;
  const ay = 60;
  o.push(`  <rect class="sheet front" x="${ax}" y="${ay}" width="260" height="300" rx="10"/>`);
  o.push(`  <circle class="dot" cx="${ax + 92}" cy="${ay + 30}" r="7"/><rect class="pill" x="${ax + 106}" y="${ay + 24}" width="76" height="12" rx="6"/>`);
  o.push(`  <rect class="pill" x="${ax + 40}" y="${ay + 52}" width="180" height="9" rx="4.5"/>`);
  o.push(`  <rect class="card" x="${ax + 24}" y="${ay + 76}" width="212" height="70" rx="8"/>`);
  o.push(`  <rect class="bar" x="${ax + 60}" y="${ay + 90}" width="30" height="42" rx="4"/><path class="flow" d="M${ax + 100},${ay + 111} h56" marker-end="url(#arrow)"/><rect class="pill" x="${ax + 168}" y="${ay + 96}" width="30" height="30" rx="4"/>`);
  o.push(`  ${[0, 1, 2, 3].map((i) => `<rect class="pill" x="${ax + 34 + i * 50}" y="${ay + 162}" width="42" height="10" rx="5"/>`).join("")}`);
  o.push(`  ${[150, 170, 132, 160].map((w, i) => `<circle class="dot" cx="${ax + 40}" cy="${ay + 196 + i * 22}" r="4"/><rect class="bar" x="${ax + 54}" y="${ay + 192 + i * 22}" width="${w}" height="8" rx="4"/>`).join("")}`);
  const parts = { tagline: ay + 56, picture: ay + 111, badges: ay + 167, features: ay + 229 };
  const usedAfter = new Set();
  for (const p of spec.after.parts) {
    const y = parts[p.at];
    if (y === undefined) throw new Error(`Unknown part "${p.at}" on the after page. Known: ${Object.keys(parts).join(", ")}.`);
    if (usedAfter.has(p.at)) throw new Error(`Two parts at "${p.at}" on the after page. Each place holds one label.`);
    usedAfter.add(p.at);
    o.push(`  <circle class="good" cx="${ax + 270}" cy="${y}" r="4"/><path class="goodlead" d="M${ax + 270},${y} h12"/>`);
    o.push(`  <text class="title" x="${ax + 288}" y="${y + 5}" font-size="15">${esc(p.label)}</text>`);
  }
  if (spec.after.backing) {
    o.push(`  <g class="glyph ok" transform="translate(${ax + 38},${ay + 322})"><circle cx="10" cy="10" r="8"/><path d="M6.5,10 l2.5,2.5 4.5,-5"/></g>`);
    o.push(`  <text class="muted" x="${ax + 66}" y="${ay + 337}" font-size="15">${esc(spec.after.backing)}</text>`);
  }
  o.push(`  <text class="title" x="${ax + 130}" y="462" font-size="17" text-anchor="middle">${esc(spec.after.label)}</text>`);
  o.push("</svg>");
  return o.join("\n") + "\n";
}

// One repo feeding several pages, each for a different reader: a typographic headline and legend beside the picture,
// a "your repo" source flowing into every tier on every merge, each tier a tile of what that page carries.
function renderPages(spec) {
  if (spec.legend.length !== 2) throw new Error(`The pages layout needs exactly 2 legend entries, got ${spec.legend.length}.`);
  if (spec.tiers.length !== 3) throw new Error(`The pages layout needs exactly 3 tiers, got ${spec.tiers.length}.`);
  if (spec.title.length !== 2) throw new Error(`The pages layout needs exactly 2 title lines, got ${spec.title.length}.`);
  if (spec.subtitle.length !== 3) throw new Error(`The pages layout needs exactly 3 subtitle lines, got ${spec.subtitle.length}.`);
  const o = [];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 500" width="1200" height="500" role="img" aria-labelledby="t">');
  o.push(`<title id="t">${esc(spec.description ?? spec.title.join(" "))}</title>`);
  o.push("<defs>");
  o.push('<marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1e1b4b"/></marker>');
  o.push('<radialGradient id="wash" cx="0.85" cy="0.2" r="0.7"><stop offset="0" stop-color="#c7d2fe" stop-opacity="0.9"/><stop offset="0.5" stop-color="#99f6e4" stop-opacity="0.45"/><stop offset="1" stop-color="#fbfaf7" stop-opacity="0"/></radialGradient>');
  o.push("<style>");
  o.push(".paper{fill:#fbfaf7}");
  o.push(`.eyebrow{font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:3px;fill:#7c3aed}`);
  o.push(`.big{font-family:${FONT};font-size:52px;font-weight:800;letter-spacing:-1.5px;fill:#1e1b4b}`);
  o.push(`.sub{font-family:${FONT};font-size:17px;fill:#475569}`);
  o.push(".card{fill:#ffffff;stroke:#e2e8f0;stroke-width:1}");
  o.push(`.head{font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:0.5px}`);
  o.push(`.item{font-family:${FONT};font-size:16px;fill:#1e1b4b}`);
  o.push(".tick{fill:none;stroke:#16a34a;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}");
  o.push(".flow{fill:none;stroke:#1e1b4b;stroke-width:1.6}");
  o.push(`.merge{font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:2px;fill:#1e1b4b}`);
  o.push(".repo{fill:#1e1b4b}");
  o.push(`.repotext{font-family:${FONT};font-size:17px;font-weight:700;fill:#ffffff}`);
  o.push(".glyph{fill:none;stroke:#1e1b4b;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}");
  o.push(`.who{font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:1px;fill:#1e1b4b}`);
  o.push(`.cap{font-family:${FONT};font-size:14px;fill:#64748b}`);
  o.push("@media (prefers-color-scheme: dark){");
  o.push(" .paper{fill:#0f1222}.big,.item,.flow,.merge,.who,.glyph{fill:#f8fafc;stroke:#f8fafc}.item,.big,.merge,.who{stroke:none}.flow,.glyph{fill:none}.card{fill:#171a2e;stroke:#2a2f4a}.sub{fill:#a5b4fc}.cap{fill:#94a3b8}.repo{fill:#f8fafc}.repotext{fill:#1e1b4b}.tick{stroke:#4ade80}");
  o.push("}");
  o.push("</style></defs>");
  o.push('<rect class="paper" x="0" y="0" width="1200" height="500"/>');
  o.push('<rect x="0" y="0" width="1200" height="500" fill="url(#wash)"/>');
  o.push(`<text class="eyebrow" x="60" y="86">${esc(spec.eyebrow)}</text>`);
  o.push(`<text class="big" x="58" y="150">${esc(spec.title[0])}</text>`);
  o.push(`<text class="big" x="58" y="210">${esc(spec.title[1])}</text>`);
  o.push(`<text class="sub" x="60" y="252">${esc(spec.subtitle[0])}</text>`);
  o.push(`<text class="sub" x="60" y="276">${esc(spec.subtitle[1])}</text>`);
  o.push(`<text class="sub" x="60" y="300">${esc(spec.subtitle[2])}</text>`);
  o.push(`<g class="glyph" style="stroke-width:2"><circle cx="70" cy="365" r="6"/><path d="M59,385 a11,11 0 0 1 22,0"/></g><text class="who" x="92" y="376">${esc(spec.legend[0].who)}</text><text class="cap" x="218" y="376">${esc(spec.legend[0].reads)}</text>`);
  o.push(`<g class="glyph" style="stroke-width:2"><rect x="61" y="406" width="18" height="15" rx="4"/><path d="M70,406 v-4"/><path d="M58,433 a12,12 0 0 1 24,0"/></g><circle cx="66.5" cy="413" r="1.5" fill="#1e1b4b"/><circle cx="73.5" cy="413" r="1.5" fill="#1e1b4b"/><text class="who" x="92" y="424">${esc(spec.legend[1].who)}</text><text class="cap" x="210" y="424">${esc(spec.legend[1].reads)}</text>`);
  o.push('<rect class="repo" x="730" y="82" width="140" height="42" rx="21"/>');
  o.push(`<text class="repotext" x="800" y="109" text-anchor="middle">${esc(spec.source)}</text>`);
  o.push('<path class="flow" d="M770,124 C 770,154 546,152 546,182" marker-end="url(#a)"/>');
  o.push('<path class="flow" d="M800,124 v14"/><path class="flow" d="M800,168 v14" marker-end="url(#a)"/>');
  o.push('<path class="flow" d="M830,124 C 830,154 1054,152 1054,182" marker-end="url(#a)"/>');
  o.push(`<text class="merge" x="800" y="158" text-anchor="middle">${esc(spec.edge)}</text>`);
  spec.tiers.forEach((tier, i) => {
    const x = 430 + i * 254;
    const n = tier.items.length;
    const height = 73 + n * 27;
    o.push(`<rect class="card" x="${x}" y="190" width="232" height="${height}" rx="6"/>`);
    o.push(`<rect x="${x}" y="190" width="6" height="${height}" fill="${tier.colour}"/>`);
    o.push(`<text class="head" x="${x + 24}" y="224" style="fill:${tier.colour}">${esc(tier.label)}</text>`);
    if (tier.reader === "person") {
      const cx = x + 202;
      o.push(`<g class="glyph" style="stroke-width:2"><circle cx="${cx}" cy="217" r="6"/><path d="M${cx - 11},237 a11,11 0 0 1 22,0"/></g>`);
    } else if (tier.reader === "agent") {
      const rx = x + 193;
      o.push(`<g class="glyph" style="stroke-width:2"><rect x="${rx}" y="210" width="18" height="15" rx="4"/><path d="M${rx + 9},210 v-4"/><path d="M${rx - 3},237 a12,12 0 0 1 24,0"/></g><circle cx="${rx + 5.5}" cy="217" r="1.5" fill="#1e1b4b"/><circle cx="${rx + 12.5}" cy="217" r="1.5" fill="#1e1b4b"/>`);
    } else {
      throw new Error(`Unknown reader "${tier.reader}" on tier "${tier.label}". Known: person, agent.`);
    }
    tier.items.forEach((item, j) => {
      const tickY = 255 + 27 * j;
      const textY = 260 + 27 * j;
      o.push(`<path class="tick" d="M${x + 26},${tickY} l4,4 l8,-9"/>`);
      o.push(`<text class="item" x="${x + 46}" y="${textY}">${esc(item)}</text>`);
    });
  });
  o.push("</svg>");
  return o.join("\n") + "\n";
}

// A spec names every field its layout draws. A missing one is an error with the field's name, never a blank picture.
function need(spec, fields) {
  for (const f of fields) {
    const v = f.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), spec);
    if (v === undefined || v === null) throw new Error(`The spec is missing "${f}".`);
  }
}

export function render(spec) {
  if (spec.kind === "before-after") {
    need(spec, ["title", "before", "before.problems", "before.label", "by", "by.icon", "by.label", "after", "after.parts", "after.label"]);
    return renderBeforeAfter(spec);
  }
  if (spec.kind === "pages") {
    need(spec, ["eyebrow", "title", "subtitle", "legend", "source", "edge", "tiers"]);
    return renderPages(spec);
  }
  need(spec, ["title", "sources", "handled", "deliverable", "deliverable.label"]);
  const rows = [...spec.handled.map((h) => ({ ...h, more: false })), ...(spec.more ? [{ label: "and more", icon: "more", more: true }] : [])];
  const n = rows.length;
  const k = spec.sources.length;
  const gap = k <= 2 ? 200 : 140;
  // Tall enough for the rows, for the deliverable page (158 above its middle, 188 below) and for the fan of source cards.
  const height = Math.max(22 + 54 * n + 16, 380, 40 + (k - 1) * gap + 118 + 40);
  const mid = Math.round(height / 2);
  const o = [];
  head(o, spec, height);

  spec.sources.forEach((s, j) => {
    const cy = Math.round(mid + (j - (k - 1) / 2) * gap);
    const y = cy - 59;
    o.push(`  <g><rect class="card" x="24" y="${y}" width="190" height="118" rx="14"/>`);
    o.push(`    ${glyph(s.icon, 97, y + 20, 44)}`);
    o.push(`    <text class="title" x="119" y="${y + 96}" font-size="19" text-anchor="middle">${esc(s.label)}</text></g>`);
    const lean = Math.sign(cy - mid);
    o.push(`  <path class="flow" d="M220,${cy} C 272,${cy} 300,${mid + lean * 45} 336,${mid + lean * 15}" marker-end="url(#arrow)"/>`);
    if (s.gives) o.push(`  <text class="muted" x="278" y="${lean > 0 ? cy + 33 : cy - 17}" font-size="15" text-anchor="middle">${esc(s.gives)}</text>`);
  });
  o.push(`  <circle class="dot" cx="352" cy="${mid}" r="6"/>`);

  rows.forEach((r, i) => {
    const x = 443 + 14 * Math.min(i, n - 1 - i, 3);
    const y = 22 + 54 * i;
    o.push(`  <path class="flow" d="M358,${mid} C 412,${mid} 422,${y + 20} ${x - 6},${y + 20}" marker-end="url(#arrow)"/>`);
    o.push(`  <g transform="translate(${x},${y})"><rect class="card${r.more ? " more" : ""}" x="0" y="0" width="210" height="40" rx="10"/>`);
    o.push(`    ${glyph(r.icon, 14, 10, 20)}`);
    o.push(`    <text class="${r.more ? "muted" : "title"}" x="48" y="26" font-size="17">${esc(r.label)}</text></g>`);
  });
  rows.forEach((_, i) => {
    const x = 443 + 14 * Math.min(i, n - 1 - i, 3) + 210;
    const y = 22 + 54 * i + 20;
    o.push(`  <path class="flow" d="M${x},${y} C ${x + 60},${y} 780,${mid} 844,${mid}"/>`);
  });
  o.push(`  <circle class="dot" cx="850" cy="${mid}" r="6"/>`);
  o.push(`  <path class="flow" d="M856,${mid} L 888,${mid}" marker-end="url(#arrow)"/>`);

  const d = spec.deliverable;
  const top = mid - 158;
  for (const line of page(d.kind === "table" ? "table" : "document", 900, top, d.heading ?? d.label)) o.push(`  ${line}`);
  o.push(`  <text class="title" x="1020" y="${top + 326}" font-size="16" text-anchor="middle">${esc(d.label)}</text>`);
  if (d.backing) o.push(`  <text class="muted" x="1020" y="${top + 346}" font-size="14" text-anchor="middle">${esc(d.backing)}</text>`);
  o.push("</svg>");
  return o.join("\n") + "\n";
}

/** Every label a spec puts on the picture, whatever the layout. The check compares these with the SVG's own text. */
export function labels(spec) {
  const out = [];
  const walk = (v, key) => {
    if (typeof v === "string") return void (["title", "label", "gives", "heading", "backing", "with", "items", "eyebrow", "subtitle", "who", "reads"].includes(key) && v.trim() && out.push(v.trim()));
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(spec, "");
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node hero-svg.mjs <name>.hero.json > <name>.svg");
    process.exit(2);
  }
  process.stdout.write(render(JSON.parse(readFileSync(file, "utf8"))));
}
