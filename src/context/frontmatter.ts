import { parse } from "yaml";
import type { Frontmatter } from "./types.js";

export function splitFrontmatter(text: string): { data: Frontmatter; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  let data: Frontmatter = {};
  try {
    const parsed = parse(m[1]);
    if (parsed && typeof parsed === "object") data = parsed as Frontmatter;
  } catch {
    data = {};
  }
  return { data, body: text.slice(m[0].length) };
}

export function headingsOf(body: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) out.push(h[2]);
  }
  return out;
}

export function firstParagraph(body: string): string | undefined {
  const blocks = body.split(/\r?\n\s*\r?\n/);
  for (const b of blocks) {
    const t = b.trim();
    if (!t || t.startsWith("#") || t.startsWith("<") || t.startsWith("```") || t.startsWith("|") || t.startsWith("-") || t.startsWith("*")) continue;
    return t.replace(/\s+/g, " ");
  }
  return undefined;
}
