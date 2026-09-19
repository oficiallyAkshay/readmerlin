import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import { imageSize } from "image-size";
import { attr, collectImages, decodeEntities, localPath as repoPath } from "../util.js";
import type { Doc, Rule } from "../types.js";

const isRemote = (s: string) => /^(https?:)?\/\//i.test(s) || /^data:/i.test(s);
const localPath = (doc: Doc, src: string): string => repoPath(doc.repoRoot, src, doc.dir) ?? "\0outside";

export const imagesExist: Rule = {
  id: "visuals/images-exist",
  level: "fail",
  pages: true,
  description: "Every image exists and has alt text",
  run: ({ doc }) => {
    const out = [];
    for (const i of collectImages(doc)) {
      if (!i.badge && !i.alt.trim()) out.push({ message: "Image without alt text.", line: i.line, repair: "Say in one sentence what the picture shows." });
      if (i.badge || isRemote(i.src)) continue;
      if (!existsSync(localPath(doc, i.src))) out.push({ message: `Image not found: ${i.src}`, line: i.line, repair: "Commit the file or fix the path." });
    }
    return out;
  },
};

export const svgLocal: Rule = {
  id: "visuals/svg-local",
  level: "fail",
  pages: true,
  description: "SVG diagrams are committed in the repo",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => !i.badge && isRemote(i.src) && /\.svg(\?|$)/i.test(i.src))
      .map((i) => ({ message: "Remote SVG.", line: i.line, repair: "Commit the SVG beside its source and reference it by relative path." })),
};

export const rasterWarning: Rule = {
  id: "visuals/raster",
  level: "warn",
  description: "A raster image shows real output at real proportions",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => !i.badge && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(i.src))
      .map((i) => ({ message: "Raster image.", line: i.line, repair: "Fine if it is real output at real proportions. Otherwise draw it as an SVG." })),
};

export const imageHeight: Rule = {
  id: "visuals/height",
  level: "warn",
  description: "Every image shows within the height limit",
  run: ({ doc, config }) => {
    const out = [];
    for (const i of collectImages(doc)) {
      if (i.badge || isRemote(i.src)) continue;
      const p = localPath(doc, i.src);
      if (!existsSync(p)) continue;
      let w: number | undefined;
      let h: number | undefined;
      try {
        const size = imageSize(readFileSync(p));
        w = size.width;
        h = size.height;
      } catch {
        continue;
      }
      if (!w || !h) continue;
      const shownWidth = i.width ?? Math.min(w, 900);
      const shownHeight = i.height ?? Math.round(shownWidth * (h / w));
      if (shownHeight > config.maxImageHeight) out.push({ message: `Image shows at about ${shownHeight}px tall, limit ${config.maxImageHeight}.`, line: i.line, repair: "Crop it, widen it, or set a smaller width." });
    }
    return out;
  },
};

export const specBeside: Rule = {
  id: "visuals/spec-beside",
  level: "fail",
  pages: true,
  // Accepted specs: <name>.hero.json for a hero, <name>.archify.json, <name>.d2 or <name>.mmd for a diagram,
  // and any <name>.json or <name>.<kind>.json, which stands for a spec with its own generator script and rebuild test.
  description: "Every diagram SVG has its source spec beside it",
  run: ({ doc }) => {
    const out = [];
    for (const i of collectImages(doc)) {
      if (i.badge || isRemote(i.src) || !/\.svg(\?|$)/i.test(i.src)) continue;
      const p = localPath(doc, i.src);
      if (!existsSync(p)) continue;
      const dir = dirname(p);
      const base = basename(p, extname(p));
      let siblings: string[] = [];
      try {
        siblings = readdirSync(dir);
      } catch {
        continue;
      }
      const want = i.inHero ? [`${base}.hero.json`] : [`${base}.archify.json`, `${base}.json`, `${base}.d2`, `${base}.mmd`];
      const has = siblings.some((s) => want.includes(s) || (s.startsWith(base + ".") && s.endsWith(".json")));
      if (!has) out.push({ message: `No source spec beside ${i.src}.`, line: i.line, repair: i.inHero ? `Commit ${base}.hero.json next to it and render it with figurehead.` : `Commit ${base}.archify.json next to it and render with Archify.` });
    }
    return out;
  },
};

/** Every label a hero spec puts on the picture, whatever its layout: the string under any title, label, gives, heading, backing, with, eyebrow, subtitle, who, reads, items, source or edge key. figurehead's own labels() in scripts/figurehead.mjs covers its fan and before-after layouts only; this one also covers the pages layout this repo's own hero uses, which figurehead does not yet render. */
function specLabels(spec: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key: string): void => {
    if (typeof v === "string") {
      if (["title", "label", "gives", "heading", "backing", "with", "eyebrow", "subtitle", "who", "reads", "items", "source", "edge"].includes(key) && v.trim()) out.push(v.trim());
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(spec, "");
  return out;
}

export const specAgrees: Rule = {
  id: "visuals/spec-agrees",
  level: "fail",
  description: "A hero shows every label its spec names",
  run: ({ doc }) => {
    const out = [];
    for (const i of collectImages(doc)) {
      if (i.badge || !i.inHero || isRemote(i.src) || !/\.svg(\?|$)/i.test(i.src)) continue;
      const p = localPath(doc, i.src);
      const specFile = p.replace(/\.svg$/i, ".hero.json");
      if (!existsSync(p) || !existsSync(specFile)) continue;
      let labels: string[];
      try {
        labels = specLabels(JSON.parse(readFileSync(specFile, "utf8")));
      } catch {
        out.push({ message: `${basename(specFile)} is not valid JSON.`, line: i.line, repair: "Fix the spec, then redraw the hero from it." });
        continue;
      }
      // A label split across tspans is still one label, so those tags vanish before the others become line breaks.
      const shown = decodeEntities(readFileSync(p, "utf8").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<\/?tspan\b[^>]*>/g, "").replace(/<[^>]+>/g, "\n"));
      const missing = labels.filter((l) => !shown.includes(l));
      if (missing.length) out.push({ message: `${i.src} does not show what its spec names: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", and more" : ""}.`, line: i.line, repair: "Redraw the hero from its spec. The spec is the source, the SVG is its output." });
    }
    return out;
  },
};

interface Box { x: number; y: number; w: number; h: number; line: number }

function parseSvg(text: string): { vb?: { x: number; y: number; w: number; h: number }; rects: Box[]; texts: Array<{ x: number; y: number; size: number; len: number; anchor: string; width?: number }>; hasText: boolean; fontStack: boolean; badAmp: boolean; groups: string[] } {
  const vbm = /viewBox\s*=\s*"([^"]+)"/i.exec(text);
  const vbParts = vbm ? vbm[1].trim().split(/[\s,]+/).map(Number) : [];
  const vb = vbParts.length === 4 ? { x: vbParts[0], y: vbParts[1], w: vbParts[2], h: vbParts[3] } : undefined;
  // Reuses util.ts's own attribute reader instead of a second copy of the same regex.
  const num = (tag: string, name: string) => {
    const v = attr(tag, name);
    return v === undefined || v === "" ? undefined : parseFloat(v);
  };
  // Walk g and rect tags in order. A rect under a transformed group, or with its own transform, is placed by the transform, so it is not measured.
  const rects: Box[] = [];
  const transformed: boolean[] = [];
  for (const m of text.matchAll(/<(\/?)(g|rect)\b([^>]*)>/g)) {
    const [t, close, name, attrs] = m;
    if (name === "g") {
      if (close) transformed.pop();
      else if (!/\/\s*$/.test(attrs)) transformed.push(/\btransform\s*=/.test(attrs));
      continue;
    }
    if (close || transformed.some(Boolean) || /\btransform\s*=/.test(attrs)) continue;
    const x = num(t, "x") ?? 0;
    const y = num(t, "y") ?? 0;
    const w = num(t, "width");
    const h = num(t, "height");
    if (w !== undefined && h !== undefined) rects.push({ x, y, w, h, line: 0 });
  }
  const texts: Array<{ x: number; y: number; size: number; len: number; anchor: string; width?: number }> = [];
  for (const m of text.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const t = m[1];
    const content = m[2].replace(/<[^>]+>/g, "").trim();
    const size = num(t, "font-size") ?? parseFloat(/font-size:\s*([\d.]+)/.exec(t)?.[1] ?? "16");
    const anchor = /text-anchor\s*=\s*"([^"]+)"/.exec(t)?.[1] ?? "start";
    texts.push({ x: num(t, "x") ?? 0, y: num(t, "y") ?? 0, size, len: content.length, anchor, width: num(t, "textLength") });
  }
  const hasText = texts.length > 0;
  const fontStack = /font-family\s*[:=]/i.test(text);
  const badAmp = /&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/.test(text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "").replace(/<!--[\s\S]*?-->/g, ""));
  const groups = [...text.matchAll(/<g\b[^>]*class="[^"]*(glyph|icon)[^"]*"[^>]*>([\s\S]*?)<\/g>/g)].map((m) => m[2].replace(/\s+/g, ""));
  return { vb, rects, texts, hasText, fontStack, badAmp, groups };
}

function localSvgs(doc: Doc): Array<{ src: string; line: number; text: string }> {
  const d = doc;
  const out: Array<{ src: string; line: number; text: string }> = [];
  for (const i of collectImages(doc)) {
    if (i.badge || isRemote(i.src) || !/\.svg(\?|$)/i.test(i.src)) continue;
    const p = localPath(d, i.src);
    if (!existsSync(p)) continue;
    try {
      out.push({ src: i.src, line: i.line, text: readFileSync(p, "utf8") });
    } catch {
      /* unreadable, images-exist covers it */
    }
  }
  return out;
}

export const svgEscaped: Rule = {
  id: "visuals/svg-escaped",
  level: "fail",
  description: "SVG text is XML escaped",
  run: ({ doc }) => localSvgs(doc).filter((s) => parseSvg(s.text).badAmp).map((s) => ({ message: `Unescaped ampersand in ${s.src}.`, line: s.line, repair: "Write &amp; inside SVG text." })),
};

export const svgFontStack: Rule = {
  id: "visuals/svg-font-stack",
  level: "fail",
  description: "SVG text declares a font stack",
  run: ({ doc }) => localSvgs(doc).filter((s) => { const p = parseSvg(s.text); return p.hasText && !p.fontStack; }).map((s) => ({ message: `No font-family in ${s.src}.`, line: s.line, repair: "Declare a system font stack in a style rule so every host renders the same." })),
};

export const svgClipping: Rule = {
  id: "visuals/svg-clipping",
  level: "fail",
  description: "Every SVG shape sits inside its viewBox",
  run: ({ doc }) => {
    const out = [];
    for (const s of localSvgs(doc)) {
      const p = parseSvg(s.text);
      if (!p.vb) continue;
      const { x, y, w, h } = p.vb;
      const clipped = p.rects.filter((r) => r.x < x || r.y < y || r.x + r.w > x + w + 0.5 || r.y + r.h > y + h + 0.5);
      if (clipped.length) out.push({ message: `${clipped.length} shapes outside the viewBox in ${s.src}.`, line: s.line, repair: "Grow the viewBox or move the shapes." });
    }
    return out;
  },
};

export const svgTextOverflow: Rule = {
  id: "visuals/svg-text-overflow",
  level: "warn",
  description: "SVG labels fit inside the viewBox",
  run: ({ doc }) => {
    const out = [];
    for (const s of localSvgs(doc)) {
      const p = parseSvg(s.text);
      if (!p.vb) continue;
      let measured = 0;
      let guessed = 0;
      for (const t of p.texts) {
        // textLength is the label's own width. Without it the width is a guess from character count, so allow a wide margin.
        const width = t.width ?? t.len * t.size * 0.58;
        const slack = t.width === undefined ? p.vb.w * 0.1 : 0.5;
        const left = t.anchor === "middle" ? t.x - width / 2 : t.anchor === "end" ? t.x - width : t.x;
        if (left < p.vb.x - slack || left + width > p.vb.x + p.vb.w + slack) t.width === undefined ? guessed++ : measured++;
      }
      if (measured) out.push({ message: `${measured} labels run past the edge of ${s.src}.`, line: s.line, repair: "Shorten the label or widen the canvas." });
      if (guessed) out.push({ message: `${guessed} labels may run past the edge of ${s.src}, going by character count.`, line: s.line, repair: "Open the SVG at full width and look. Set textLength on a label to have it measured instead of guessed." });
    }
    return out;
  },
};

export const distinctIcons: Rule = {
  id: "visuals/distinct-icons",
  level: "warn",
  description: "Every item in an SVG has its own icon",
  run: ({ doc }) => {
    const out = [];
    for (const s of localSvgs(doc)) {
      const p = parseSvg(s.text);
      const counts = new Map<string, number>();
      for (const g of p.groups) counts.set(g, (counts.get(g) ?? 0) + 1);
      const repeated = [...counts.values()].filter((c) => c >= 3).length;
      const uses = new Map<string, number>();
      for (const m of s.text.matchAll(/<use\b[^>]*href="#([^"]+)"/g)) uses.set(m[1], (uses.get(m[1]) ?? 0) + 1);
      const repeatedUse = [...uses.values()].filter((c) => c >= 3).length;
      if (repeated || repeatedUse) out.push({ message: `A generic icon repeats in ${s.src}.`, line: s.line, repair: "Give every item its own icon." });
    }
    return out;
  },
};

export const VISUAL_RULES: Rule[] = [imagesExist, svgLocal, rasterWarning, imageHeight, specBeside, specAgrees, svgEscaped, svgFontStack, svgClipping, svgTextOverflow, distinctIcons];
