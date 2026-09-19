import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Paragraph } from "mdast";
import { isAbsolute, relative, resolve } from "node:path";
import type { Doc } from "./types.js";

/** decodeURIComponent that returns the input on malformed escapes instead of throwing. */
export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Resolve a path inside the repo. Relative paths start at base, the README's folder; root-relative paths start at the repo root. Returns undefined when the path escapes the repo. */
export function localPath(root: string, src: string, base: string = root): string | undefined {
  const clean = safeDecode(src.split(/[?#]/)[0]);
  const p = clean.startsWith("/") ? resolve(root, clean.replace(/^\/+/, "")) : resolve(base, clean);
  const rel = relative(root, p);
  if (rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return p;
}

/** Line numbers (1-based) that sit inside code blocks: fenced with any marker, or indented. */
export function fencedLines(doc: Doc): Set<number> {
  const out = new Set<number>();
  visit(doc.tree as Root, "code", (node) => {
    const s = node.position?.start.line;
    const e = node.position?.end.line;
    if (s === undefined || e === undefined) return;
    for (let i = s; i <= e; i++) out.add(i);
  });
  return out;
}

/** Decode the html entities that appear in attribute values and SVG text. */
export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
    const code = dec ? Number(dec) : hex ? parseInt(hex, 16) : -1;
    if (code >= 0) return code <= 0x10ffff ? String.fromCodePoint(code) : m;
    return named[name.toLowerCase()] ?? m;
  });
}

/** The document text with fenced code, inline code and html comments blanked out, offsets preserved. */
export function maskedText(doc: Doc): string {
  const fences = fencedLines(doc);
  const lines = doc.lines.map((l, i) => (fences.has(i + 1) ? " ".repeat(l.length) : l));
  let text = lines.join("\n");
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  text = text.replace(/<!--[\s\S]*?-->/g, blank);
  text = text.replace(/`[^`\n]*`/g, blank);
  return text;
}

export const BADGE_RE = /img\.shields\.io|shields\.io|badgen\.net|https?:\/\/[^"'\s)]*\/badge\/|badge\.svg|codecov\.io\/[^"'\s)]*\/graph\/badge|img\.badgesize|deepwiki\.com\/badge|trendshift\.io\/api\/badge|api\.scorecard\.dev\/|api\.securityscorecards\.dev\/|\/workflows\/[^"'\s)]*\.svg/i;
export const isBadge = (src: string): boolean => BADGE_RE.test(src);

export interface ImageRef {
  src: string;
  alt: string;
  line: number;
  inHero: boolean;
  linked: boolean;
  html: boolean;
  width?: number;
  height?: number;
  badge: boolean;
}

export interface LinkRef {
  href: string;
  line: number;
  inHero: boolean;
  text: string;
  bold: boolean;
  html: boolean;
  /** The link holds nothing but an image, such as a badge. */
  imageOnly: boolean;
}

/** Yields [lineIndex, lineText] for lines outside code blocks. */
export function* proseLines(doc: Doc): Generator<[number, string]> {
  const fences = fencedLines(doc);
  for (let i = 0; i < doc.lines.length; i++) if (!fences.has(i + 1)) yield [i, doc.lines[i]];
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3]) : undefined;
}

/** A pixel size from an html attribute. A percentage is taken against a 900px column. */
function px(v: string | undefined, pctOf?: number): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return undefined;
  if (/%\s*$/.test(v)) return pctOf === undefined ? undefined : Math.round((pctOf * n) / 100);
  return n;
}

/** Reference-style targets: [id]: url, keyed by the lower-cased label. */
function definitions(doc: Doc): Map<string, string> {
  const out = new Map<string, string>();
  visit(doc.tree as Root, "definition", (node) => {
    out.set(node.identifier.toLowerCase(), node.url);
  });
  return out;
}

/** Offset ranges of every markdown link, so inline html inside one counts as linked. */
function linkRanges(doc: Doc): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  visit(doc.tree as Root, (node) => {
    if ((node.type === "link" || node.type === "linkReference") && node.position?.start.offset !== undefined && node.position.end.offset !== undefined) out.push([node.position.start.offset, node.position.end.offset]);
  });
  return out;
}

function lineAt(doc: Doc, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < doc.text.length; i++) if (doc.text.charCodeAt(i) === 10) line++;
  return line;
}

function heroEndLine(doc: Doc): number {
  return doc.sections.length ? doc.sections[0].startLine : Number.MAX_SAFE_INTEGER;
}

export function collectImages(doc: Doc): ImageRef[] {
  const out: ImageRef[] = [];
  const heroEnd = heroEndLine(doc);
  const defs = definitions(doc);
  const wrapped = (t: string | undefined) => t === "link" || t === "linkReference";
  // Markdown images, inline or reference-style, with link-wrapping detected by parent.
  visit(doc.tree as Root, (node, _index, parent) => {
    if (node.type !== "image" && node.type !== "imageReference") return;
    const src = node.type === "image" ? node.url : defs.get(node.identifier.toLowerCase());
    if (src === undefined) return;
    const line = node.position?.start.line ?? 0;
    out.push({ src, alt: node.alt ?? "", line, inHero: line < heroEnd, linked: wrapped(parent?.type), html: false, badge: isBadge(src) });
  });
  // HTML images. Link wrapping: an <a that opens before the img and has not closed, or a markdown link around it.
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  const text = maskedText(doc);
  const ranges = linkRanges(doc);
  while ((m = re.exec(text))) {
    const at = m.index;
    const line = lineAt(doc, at);
    const before = text.slice(0, at);
    const lastOpen = before.lastIndexOf("<a");
    const lastClose = before.lastIndexOf("</a>");
    const inLink = ranges.some(([s, e]) => at >= s && at < e);
    const src = attr(m[0], "src") ?? "";
    const w = px(attr(m[0], "width"), 900);
    out.push({ src, alt: attr(m[0], "alt") ?? "", line, inHero: line < heroEnd, linked: lastOpen > lastClose || inLink, html: true, width: w, height: px(attr(m[0], "height")), badge: isBadge(src) });
  }
  return out.sort((a, b) => a.line - b.line);
}

/** Every link. Image-only links, such as wrapped badges, come only when all is true. */
export function collectLinks(doc: Doc, all = false): LinkRef[] {
  const out: LinkRef[] = [];
  const heroEnd = heroEndLine(doc);
  const text = maskedText(doc);
  const defs = definitions(doc);
  visit(doc.tree as Root, (node, _i, parent) => {
    if (node.type !== "link" && node.type !== "linkReference") return;
    const href = node.type === "link" ? node.url : defs.get(node.identifier.toLowerCase());
    if (href === undefined) return;
    const line = node.position?.start.line ?? 0;
    const imageOnly = node.children.length === 1 && (node.children[0].type === "image" || node.children[0].type === "imageReference");
    if (imageOnly && !all) return;
    out.push({ href, line, inHero: line < heroEnd, text: toString(node), bold: parent?.type === "strong", html: false, imageOnly });
  });
  const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const inner = m[3];
    const imageOnly = /<img\b/i.test(inner) && !inner.replace(/<[^>]+>/g, "").trim();
    if (imageOnly && !all) continue;
    const line = lineAt(doc, m.index);
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    out.push({ href: decodeEntities(m[1] ?? m[2]), line, inHero: line < heroEnd, text: inner.replace(/<[^>]+>/g, "").trim(), bold: /<b>\s*$|<strong>\s*$/i.test(before), html: true, imageOnly });
  }
  return out.sort((a, b) => a.line - b.line);
}

/** The anchor GitHub gives a heading: lower-cased, punctuation dropped, spaces to hyphens. A leading emoji leaves a leading hyphen. */
// GitHub's anchor: lower case, every character that is not a letter, a number, a mark, a space, a hyphen or an underscore dropped, and each space turned into a hyphen. Two spaces give two hyphens.
export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export function paragraphs(nodes: RootContent[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const n of nodes) {
    if (n.type === "paragraph") out.push(n);
  }
  return out;
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const EMOJI_RE = /^\s*(?:[\p{Extended_Pictographic}‍️]|:[a-z0-9_+-]+:)/u;
