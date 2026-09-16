import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectImages, collectLinks, localPath, safeDecode, slug } from "../util.js";
import type { Rule } from "../types.js";

const isExternal = (h: string) => /^(https?:)?\/\//i.test(h);
const isSkippable = (h: string) => /^(mailto:|tel:|javascript:|data:)/i.test(h);

export const relativeLinks: Rule = {
  id: "links/relative",
  level: "fail",
  description: "Every relative link resolves to a file and every anchor to a heading",
  run: ({ doc }) => {
    const out = [];
    const slugs = new Set<string>();
    for (const s of doc.sections) slugs.add(slug(s.title));
    for (const line of doc.lines) {
      const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
      if (m) slugs.add(slug(m[1]));
    }
    for (const m of doc.text.matchAll(/<(?:h[1-6]|a|p|div|section)\b[^>]*\b(?:id|name)="([^"]+)"/gi)) slugs.add(m[1].toLowerCase());
    const refs = [...collectLinks(doc).map((l) => ({ href: l.href, line: l.line })), ...collectImages(doc).map((i) => ({ href: i.src, line: i.line }))];
    for (const r of refs) {
      const href = r.href.trim();
      if (!href || isExternal(href) || isSkippable(href)) continue;
      const [pathPart, anchor] = href.split("#");
      if (pathPart) {
        const p = localPath(doc.repoRoot, pathPart);
        if (!p) {
          out.push({ message: `Link points outside the repo: ${pathPart}`, line: r.line, repair: "Link to a file in the repo or to a URL." });
          continue;
        }
        if (!existsSync(p)) {
          out.push({ message: `Link target not found: ${pathPart}`, line: r.line, repair: "Fix the path or commit the file." });
          continue;
        }
      }
      if (anchor !== undefined && !pathPart) {
        const a = anchor.toLowerCase();
        if (!slugs.has(a) && !slugs.has(slug(safeDecode(a)))) out.push({ message: `Anchor not found: #${anchor}`, line: r.line, repair: "Match the heading text, lower-cased with hyphens." });
      }
    }
    return out;
  },
};

interface CacheEntry { ok: boolean; at: number }
const CACHE_FILE = join(tmpdir(), "readmerlin", "links.json");
const DAY = 24 * 3600 * 1000;

function loadCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(c: Record<string, CacheEntry>): void {
  try {
    const week = 7 * DAY;
    for (const [k, v] of Object.entries(c)) if (Date.now() - v.at > week) delete c[k];
    mkdirSync(join(tmpdir(), "readmerlin"), { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(c));
    renameSync(tmp, CACHE_FILE);
  } catch {
    /* cache is best effort */
  }
}

const UA = "readmerlin link check (+https://github.com/oficiallyAkshay/readmerlin)";

/** HEAD first, GET on refusal, one retry on network error. Returns the status, 0 on a network failure. */
export async function probe(fetchFn: typeof fetch, url: string, timeoutMs = 15000): Promise<number> {
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetchFn(url, { method, redirect: "follow", headers: { "user-agent": UA, accept: "*/*" }, signal: AbortSignal.timeout(timeoutMs) });
    if (method === "GET") await res.body?.cancel();
    return res.status;
  };
  for (let i = 0; i < 2; i++) {
    try {
      let status = await attempt("HEAD");
      if (status === 405 || status === 403 || status === 404 || status === 501 || status === 400) status = await attempt("GET");
      return status;
    } catch {
      if (i === 1) return 0;
    }
  }
  return 0;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export const externalLinks: Rule = {
  id: "links/external",
  level: "fail",
  description: "Every external link answers",
  run: async ({ doc, links, fetch }) => {
    if (!links) return [];
    const refs = collectLinks(doc).filter((l) => isExternal(l.href));
    if (refs.length === 0) return [];
    const cache = loadCache();
    const fresh = (u: string) => cache[u] && Date.now() - cache[u].at < DAY && cache[u].ok;
    const urls = [...new Set(refs.map((r) => (r.href.startsWith("//") ? "https:" + r.href : r.href)).filter((u) => !fresh(u)))];
    const statuses = await mapLimit(urls, 12, async (u) => [u, await probe(fetch, u)] as const);
    const broken = new Map<string, number>();
    for (const [u, status] of statuses) {
      const ok = status >= 200 && status < 400;
      if (!ok) broken.set(u, status);
      cache[u] = { ok, at: Date.now() };
    }
    saveCache(cache);
    return refs
      .map((r) => ({ r, u: r.href.startsWith("//") ? "https:" + r.href : r.href }))
      .filter(({ u }) => broken.has(u))
      .map(({ r, u }) => ({ message: `Link answers ${broken.get(u) || "with a network error"}: ${u}`, line: r.line, repair: "Fix or remove the link." }));
  },
};

export const LINK_RULES: Rule[] = [relativeLinks, externalLinks];
