import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import { imageSize } from "image-size";
import { collectImages, localPath as repoPath } from "../util.js";
import type { Doc, Rule } from "../types.js";

const isRemote = (s: string) => /^(https?:)?\/\//i.test(s) || /^data:/i.test(s);
const localPath = (root: string, src: string): string => repoPath(root, src) ?? "\0outside";

export const imagesExist: Rule = {
  id: "visuals/images-exist",
  level: "fail",
  description: "Every image exists and has alt text",
  run: ({ doc }) => {
    const out = [];
    for (const i of collectImages(doc)) {
      if (!i.badge && !i.alt.trim()) out.push({ message: "Image without alt text.", line: i.line, repair: "Say in one sentence what the picture shows." });
      if (i.badge || isRemote(i.src)) continue;
      if (!existsSync(localPath(doc.repoRoot, i.src))) out.push({ message: `Image not found: ${i.src}`, line: i.line, repair: "Commit the file or fix the path." });
    }
    return out;
  },
};

export const svgLocal: Rule = {
  id: "visuals/svg-local",
  level: "fail",
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
      const p = localPath(doc.repoRoot, i.src);
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
      const shownHeight = Math.round(shownWidth * (h / w));
      if (shownHeight > config.maxImageHeight) out.push({ message: `Image shows at about ${shownHeight}px tall, limit ${config.maxImageHeight}.`, line: i.line, repair: "Crop it, widen it, or set a smaller width." });
    }
    return out;
  },
};

export const specBeside: Rule = {
  id: "visuals/spec-beside",
  level: "fail",
  // Accepted specs: <name>.hero.json for a hero, <name>.archify.json, <name>.d2 or <name>.mmd for a diagram,
  // and any <name>.json or <name>.<kind>.json, which stands for a spec with its own generator script and rebuild test.
  description: "Every diagram SVG has its source spec beside it",
  run: ({ doc }) => {
    const out = [];
    for (const i of collectImages(doc)) {
      if (i.badge || isRemote(i.src) || !/\.svg(\?|$)/i.test(i.src)) continue;
      const p = localPath(doc.repoRoot, i.src);
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
      if (!has) out.push({ message: `No source spec beside ${i.src}.`, line: i.line, repair: i.inHero ? `Commit ${base}.hero.json next to it and render with herofold.` : `Commit ${base}.archify.json next to it and render with Archify.` });
    }
    return out;
  },
};

interface Box { x: number; y: number; w: number; h: number; line: number }

function parseSvg(text: string): { vb?: { w: number; h: number }; rects: Box[]; texts: Array<{ x: number; y: number; size: number; len: number; anchor: string; width?: number }>; hasText: boolean; fontStack: boolean; badAmp: boolean; groups: string[] } {
  const vbm = /viewBox\s*=\s*"([^"]+)"/i.exec(text);
  const vbParts = vbm ? vbm[1].trim().split(/[\s,]+/).map(Number) : [];
  const vb = vbParts.length === 4 ? { w: vbParts[2], h: vbParts[3] } : undefined;
  const num = (tag: string, name: string) => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`).exec(tag);
    return m ? parseFloat(m[1]) : undefined;
  };
  const rects: Box[] = [];
  for (const m of text.matchAll(/<rect\b[^>]*>/g)) {
    const t = m[0];
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
    const p = localPath(d.repoRoot, i.src);
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
      const clipped = p.rects.filter((r) => r.x < 0 || r.y < 0 || r.x + r.w > p.vb!.w + 0.5 || r.y + r.h > p.vb!.h + 0.5);
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
        if (left < -slack || left + width > p.vb.w + slack) t.width === undefined ? guessed++ : measured++;
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

export const VISUAL_RULES: Rule[] = [imagesExist, svgLocal, rasterWarning, imageHeight, specBeside, svgEscaped, svgFontStack, svgClipping, svgTextOverflow, distinctIcons];
