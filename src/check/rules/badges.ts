import { execSync } from "node:child_process";
import { remoteOf } from "../../context/git.js";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import { collectImages, safeDecode } from "../util.js";
import type { ImageRef } from "../util.js";
import type { Rule } from "../types.js";

const svgCache = new Map<string, Promise<string | null>>();

async function fetchText(fetchFn: typeof fetch, url: string): Promise<string | null> {
  if (!svgCache.has(url)) {
    svgCache.set(
      url,
      (async () => {
        try {
          const res = await fetchFn(url, { headers: { accept: "image/svg+xml" }, signal: AbortSignal.timeout(8000) });
          if (!res.ok) return null;
          return await res.text();
        } catch {
          return null;
        }
      })(),
    );
  }
  return svgCache.get(url)!;
}

export const badgesLinked: Rule = {
  id: "badges/linked",
  level: "fail",
  description: "Every badge is wrapped in a link",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => i.badge && !i.linked)
      .map((i) => ({ message: "Badge is not a link.", line: i.line, repair: "Wrap it in a link to the thing it states: the workflow, the coverage page, the host notes." })),
};

export const badgesLogoPresent: Rule = {
  id: "badges/logo-present",
  level: "warn",
  description: "Shields badges carry a logo where one exists",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => i.badge && /shields\.io/.test(i.src) && !/[?&]logo=/.test(i.src))
      .map((i) => ({ message: "Shields badge without a logo.", line: i.line, repair: "Add logo=<simple-icons slug> if one exists. Label-only is fine for a host with no mark." })),
};

export const badgesLogo: Rule = {
  id: "badges/logo-renders",
  level: "fail",
  description: "Every shields badge logo actually renders",
  run: async ({ doc, links, fetch }) => {
    const out = [];
    for (const i of collectImages(doc).filter((b) => b.badge && /shields\.io/.test(b.src) && /[?&]logo=/.test(b.src))) {
      if (!links) continue;
      const svg = await fetchText(fetch, i.src);
      if (svg === null) continue;
      if (!/<image\b/i.test(svg)) out.push({ message: "Shields badge logo does not render.", line: i.line, repair: "The logo slug is unknown to shields. Pick a slug from simple-icons or drop the logo." });
    }
    return out;
  },
};

export const ciMatchesRemote: Rule = {
  id: "badges/ci-matches-remote",
  level: "fail",
  description: "The CI badge points at this repo's own workflow",
  run: ({ doc }) => {
    const remote = remoteOf(doc.repoRoot);
    if (!remote.owner || !remote.name) return [];
    const want = `${remote.owner}/${remote.name}`.toLowerCase();
    const out = [];
    for (const i of collectImages(doc).filter((b) => b.badge)) {
      const m = /actions\/workflow\/status\/([^/]+\/[^/?]+)|github\.com\/([^/]+\/[^/]+)\/actions\/workflows/i.exec(i.src);
      if (!m) continue;
      const got = (m[1] ?? m[2]).replace(/\.git$/, "").toLowerCase();
      if (got !== want) out.push({ message: `CI badge belongs to ${got}, this repo is ${want}.`, line: i.line, repair: "Point the badge at this repo's workflow." });
    }
    return out;
  },
};

export const staticStatus: Rule = {
  id: "badges/live-status",
  level: "fail",
  description: "A status badge reads from the live service",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => i.badge && /shields\.io\/badge\/(build|ci|tests?|coverage|status)-(?!\d)/i.test(i.src))
      .map((i) => ({ message: "Static status badge.", line: i.line, repair: "Use the live shields endpoint for the workflow or coverage service, or drop it." })),
};

/** A count in the short form a badge shows: 1.2k, 3M. */
function short(n: number): string {
  const one = (v: number) => String(Math.round(v * 10) / 10);
  return n >= 1e6 ? `${one(n / 1e6)}M` : n >= 1000 ? `${one(n / 1000)}k` : String(n);
}

export const countSource: Rule = {
  id: "badges/count-source",
  level: "fail",
  description: "Every numeric badge has a source command whose output matches",
  run: ({ doc, config, exec }) => {
    const out = [];
    const counts = new Map<string, string>();
    for (const [k, v] of Object.entries(config.counts)) counts.set(k.replace(/_/g, " ").toLowerCase(), v);
    for (const i of collectImages(doc).filter((b) => b.badge)) {
      // The label may carry shields' escaped dash (--). The count is digits, digits with separators, or the short form.
      const m = /shields\.io\/badge\/((?:[^-/?#]|--)+)-(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?[km]?)-/i.exec(i.src);
      if (!m) continue;
      const label = safeDecode(m[1]).replace(/--/g, "-").replace(/_/g, " ").toLowerCase();
      if (/^(python|node|nodejs|node\.js|go|golang|ruby|java|rust|php|dotnet|swift|kotlin|version|v|release|api|schema|since)$/.test(label)) continue;
      const number = m[2].replace(/,/g, "").toLowerCase().replace(/\.0(?=[km]$)/, "");
      const cmd = counts.get(label) ?? config.counts[safeDecode(m[1])];
      if (!cmd) {
        out.push({ message: `Count badge "${label}: ${number}" has no source command.`, line: i.line, repair: `Add counts["${label}"] = "<command that prints the number>" to readmerlin.json.` });
        continue;
      }
      if (!exec) {
        out.push({ level: "warn" as const, message: `Count badge "${label}: ${number}" was not verified, commands are off.`, line: i.line, repair: "Run without --no-exec on a machine you trust." });
        continue;
      }
      let got: string;
      try {
        got = execSync(cmd, { cwd: doc.repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 }).trim();
      } catch {
        out.push({ message: `Source command for "${label}" failed.`, line: i.line, repair: `Run: ${cmd}` });
        continue;
      }
      const gotNumber = got.replace(/,/g, "").match(/\d[\d.]*/)?.[0];
      const same = gotNumber !== undefined && (gotNumber === number || short(Number(gotNumber)).toLowerCase() === number);
      if (!same) out.push({ message: `Count badge says ${number}, source says ${gotNumber ?? got}.`, line: i.line, repair: "Update the badge to the real number." });
    }
    return out;
  },
};

export const rowLength: Rule = {
  id: "badges/row-length",
  level: "warn",
  description: "A badge row stays within the limit",
  run: ({ doc, config }) => {
    const out = [];
    // Group badges by the html block or paragraph they sit in. A <br> inside an html block starts a new row.
    const badges = collectImages(doc).filter((b) => b.badge);
    const seen = new Set<ImageRef>();
    for (const node of doc.hero) {
      const s = node.position?.start.line ?? 0;
      const e = node.position?.end.line ?? s;
      const rows: Array<[number, number]> = [];
      let from = s;
      if (node.type === "html") {
        for (const m of node.value.matchAll(/<br\s*\/?>/gi)) {
          const at = s + (node.value.slice(0, m.index).match(/\n/g)?.length ?? 0);
          rows.push([from, at]);
          from = at;
        }
      }
      rows.push([from, e]);
      for (const [a, b] of rows) {
        const row = badges.filter((x) => !seen.has(x) && x.line >= a && x.line <= b);
        for (const x of row) seen.add(x);
        if (row.length > config.maxBadgesPerRow) out.push({ message: `${row.length} badges in one row, limit ${config.maxBadgesPerRow}.`, line: a, repair: "Keep the badges that change what the reader does." });
      }
    }
    return out;
  },
};

const CI_BADGE_RE = /actions\/workflow\/status\/|\/actions\/workflows\/[^"'\s)]*badge\.svg|\/workflows\/[^"'\s)]*\.svg|shields\.io\/(github\/checks-status|github\/check-runs|circleci|travis|gitlab\/pipeline|appveyor|azure-devops\/build)\b|circleci\.com\/[^"'\s)]*\.svg|travis-ci\.(com|org)\/[^"'\s)]*\.svg/i;

export const noCiBadge: Rule = {
  id: "badges/carry-facts",
  level: "fail",
  description: "Every badge carries a number or a fact; CI status is table stakes and stays out",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => i.badge && CI_BADGE_RE.test(i.src))
      .map((i) => ({ message: "CI status badge.", line: i.line, repair: "Drop it. Green CI is table stakes once merges require it. Keep badges that carry a number or a fact." })),
};

const RAW_BADGE_RE = /https?:\/\/(img\.shields\.io|badgen\.net)\/\S+/i;

export const noRawUrls: Rule = {
  id: "badges/shown-as-badges",
  level: "fail",
  description: "A badge URL appears only as the badge itself, linked",
  run: ({ doc }) => {
    const out: Array<{ message: string; line?: number; repair: string }> = [];
    const hit = (line: number | undefined) => out.push({ message: "Raw badge URL.", line, repair: "Show the badge itself, linked to its own URL. Recipe templates live in CONTRIBUTING." });
    visit(doc.tree, (node) => {
      if ((node.type === "code" || node.type === "inlineCode") && RAW_BADGE_RE.test(node.value)) hit(node.position?.start.line);
      // A bare URL that GFM autolinks, or a link whose visible words are the URL.
      if (node.type === "link" && RAW_BADGE_RE.test(toString(node, { includeHtml: false }))) hit(node.position?.start.line);
      if (node.type === "html" && RAW_BADGE_RE.test(node.value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " "))) hit(node.position?.start.line);
    });
    return out;
  },
};

const FACT_LABELS = /^(license|licence|node|nodejs|node\.js|python|go|golang|ruby|java|rust|php|dotnet|swift|kotlin|deno|bun|typescript|platform|os|agent|version|v|release|api|schema|since|made with|built with|runs on|style|code style)$/i;

export const claimsBacked: Rule = {
  id: "badges/claims-backed",
  level: "warn",
  description: "A badge that states a claim reads it from a file a tested job writes",
  run: ({ doc }) => {
    const out = [];
    for (const i of collectImages(doc).filter((b) => b.badge)) {
      const m = /shields\.io\/badge\/([^-?]+)-([^-?]+)-/i.exec(i.src.replace(/--/g, "\u2010"));
      if (!m) continue;
      const label = safeDecode(m[1]).replace(/_/g, " ").trim();
      const message = safeDecode(m[2]).replace(/_/g, " ").trim();
      // A name with no message is a host badge, a bare number belongs to badges/count-source, and a version or licence is a fact of the manifest.
      if (!label || !message || FACT_LABELS.test(label) || /^[\d.,+%\sv<>=]+[km]?$/i.test(message)) continue;
      out.push({ message: `Hand-written badge states a claim: "${label}: ${message}".`, line: i.line, repair: "Have a tested CI job write the claim to a JSON file and read it with a shields endpoint or dynamic badge, or say it in a sentence." });
    }
    return out;
  },
};

export const BADGE_RULES: Rule[] = [badgesLinked, badgesLogoPresent, badgesLogo, ciMatchesRemote, noCiBadge, staticStatus, countSource, claimsBacked, rowLength, noRawUrls];
