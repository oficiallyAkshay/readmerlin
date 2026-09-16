import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Paragraph } from "mdast";
import type { Doc } from "./types.js";

export const BADGE_RE = /img\.shields\.io|shields\.io|badgen\.net|\/badge\/|badge\.svg|codecov\.io\/[^"'\s)]*\/graph\/badge|img\.badgesize|deepwiki\.com\/badge|trendshift\.io\/api\/badge|\/workflows\/[^"'\s)]*\.svg/i;
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
}

/** Yields [lineIndex, lineText] for lines outside fenced code. */
export function* proseLines(doc: Doc): Generator<[number, string]> {
  let inFence = false;
  for (let i = 0; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) yield [i, line];
  }
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
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
  // Markdown images, with link-wrapping detected by parent.
  visit(doc.tree as Root, "image", (node, _index, parent) => {
    const line = node.position?.start.line ?? 0;
    out.push({ src: node.url, alt: node.alt ?? "", line, inHero: line < heroEnd, linked: parent?.type === "link", html: false, badge: isBadge(node.url) });
  });
  // HTML images. Link wrapping: an <a that opens before the img and has not closed.
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  let inFence = false;
  const fences = new Set<number>();
  doc.lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence;
    if (inFence) fences.add(i + 1);
  });
  while ((m = re.exec(doc.text))) {
    const line = lineAt(doc, m.index);
    if (fences.has(line)) continue;
    const before = doc.text.slice(Math.max(0, m.index - 400), m.index);
    const lastOpen = before.lastIndexOf("<a");
    const lastClose = before.lastIndexOf("</a>");
    const src = attr(m[0], "src") ?? "";
    const w = attr(m[0], "width");
    const h = attr(m[0], "height");
    out.push({ src, alt: attr(m[0], "alt") ?? "", line, inHero: line < heroEnd, linked: lastOpen > lastClose, html: true, width: w ? Number(w) : undefined, height: h ? Number(h) : undefined, badge: isBadge(src) });
  }
  return out.sort((a, b) => a.line - b.line);
}

export function collectLinks(doc: Doc): LinkRef[] {
  const out: LinkRef[] = [];
  const heroEnd = heroEndLine(doc);
  visit(doc.tree as Root, "link", (node, _i, parent) => {
    const line = node.position?.start.line ?? 0;
    const onlyImage = node.children.length === 1 && node.children[0].type === "image";
    if (onlyImage) return;
    out.push({ href: node.url, line, inHero: line < heroEnd, text: toString(node), bold: parent?.type === "strong", html: false });
  });
  const re = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc.text))) {
    const inner = m[3];
    if (/<img\b/i.test(inner) && !inner.replace(/<[^>]+>/g, "").trim()) continue;
    const line = lineAt(doc, m.index);
    const before = doc.text.slice(Math.max(0, m.index - 12), m.index);
    out.push({ href: m[1] ?? m[2], line, inHero: line < heroEnd, text: inner.replace(/<[^>]+>/g, "").trim(), bold: /<b>\s*$|<strong>\s*$/i.test(before), html: true });
  }
  return out.sort((a, b) => a.line - b.line);
}

export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
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
