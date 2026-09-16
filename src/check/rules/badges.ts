import { execSync } from "node:child_process";
import { remoteOf } from "../../context/git.js";
import { collectImages } from "../util.js";
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
  id: "badges/no-static-status",
  level: "fail",
  description: "No hand-written status badge",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => i.badge && /shields\.io\/badge\/(build|ci|tests?|coverage|status)-/i.test(i.src))
      .map((i) => ({ message: "Static status badge.", line: i.line, repair: "Use the live shields endpoint for the workflow or coverage service, or drop it." })),
};

export const countSource: Rule = {
  id: "badges/count-source",
  level: "fail",
  description: "Every numeric badge has a source command whose output matches",
  run: ({ doc, config }) => {
    const out = [];
    for (const i of collectImages(doc).filter((b) => b.badge)) {
      const m = /shields\.io\/badge\/([^-]+)-(\d{1,3}(?:,\d{3})*|\d+)-/i.exec(i.src);
      if (!m) continue;
      const label = decodeURIComponent(m[1]).replace(/_/g, " ").toLowerCase();
      if (/^(python|node|nodejs|node\.js|go|golang|ruby|java|rust|php|dotnet|swift|kotlin|version|v|release|api|schema|since)$/.test(label)) continue;
      const number = m[2].replace(/,/g, "");
      const cmd = config.counts[label] ?? config.counts[decodeURIComponent(m[1])];
      if (!cmd) {
        out.push({ message: `Count badge "${label}: ${number}" has no source command.`, line: i.line, repair: `Add counts["${label}"] = "<command that prints the number>" to readmerlin.json.` });
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
      if (gotNumber !== number) out.push({ message: `Count badge says ${number}, source says ${gotNumber ?? got}.`, line: i.line, repair: "Update the badge to the real number." });
    }
    return out;
  },
};

export const rowLength: Rule = {
  id: "badges/row-length",
  level: "warn",
  description: "No badge row longer than the limit",
  run: ({ doc, config }) => {
    const out = [];
    const counts = new Map<number, number>();
    // Group badges by the html block or paragraph they sit in, using the nearest hero node.
    const badges = collectImages(doc).filter((b) => b.badge);
    for (const node of doc.hero) {
      const s = node.position?.start.line ?? 0;
      const e = node.position?.end.line ?? s;
      const n = badges.filter((b) => b.line >= s && b.line <= e).length;
      if (n) counts.set(s, n);
    }
    for (const [line, n] of counts) if (n > config.maxBadgesPerRow) out.push({ message: `${n} badges in one row, limit ${config.maxBadgesPerRow}.`, line, repair: "Keep the badges that change what the reader does." });
    return out;
  },
};

export const BADGE_RULES: Rule[] = [badgesLinked, badgesLogoPresent, badgesLogo, ciMatchesRemote, staticStatus, countSource, rowLength];
