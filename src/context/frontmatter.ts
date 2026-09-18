import { parse } from "yaml";
import type { Frontmatter } from "./types.js";

// Plain data only. A YAML anchor cycle is cut where it closes, and a date becomes its ISO string.
function plain(v: unknown, seen: Set<object>): unknown {
  if (v instanceof Date) return v.toISOString();
  if (!v || typeof v !== "object") return v;
  if (seen.has(v)) return undefined;
  seen.add(v);
  const out = Array.isArray(v) ? v.map((x) => plain(x, seen)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x, seen)]));
  seen.delete(v);
  return out;
}

export function splitFrontmatter(text: string): { data: Frontmatter; body: string } {
  text = text.replace(/^\uFEFF/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  let data: Frontmatter = {};
  try {
    const parsed = plain(parse(m[1]), new Set());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Frontmatter;
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
    // A closing run of hashes needs a space before it; "# F#" keeps its hash.
    const h = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (h) out.push(h[2]);
  }
  return out;
}

export function firstParagraph(body: string): string | undefined {
  const blocks = body.split(/\r?\n\s*\r?\n/);
  for (const b of blocks) {
    const t = b.trim();
    if (!t || t.startsWith("#") || t.startsWith(">") || t.startsWith("<") || t.startsWith("```") || t.startsWith("|") || t.startsWith("-") || t.startsWith("*")) continue;
    return t.replace(/\s+/g, " ");
  }
  return undefined;
}
