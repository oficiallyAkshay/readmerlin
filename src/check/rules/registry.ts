import { BADGED_HOSTS, hostBadgeSrc, readPackages } from "../../context/readers.js";
import { remoteOf } from "../../context/git.js";
import { collectImages } from "../util.js";
import type { Rule } from "../types.js";

const PATTERNS: Record<string, RegExp> = {
  npm: /shields\.io\/npm\/(v|dw|dm|dt|d18m)\//i,
  pypi: /shields\.io\/pypi\/(v|dm|dw|dd)\//i,
  crates: /shields\.io\/crates\/(v|d|dv)\//i,
  gems: /shields\.io\/gem\/(v|dt|dv)\//i,
};

const LOOKUP: Record<string, (name: string) => string> = {
  npm: (n) => `https://registry.npmjs.org/${n.replace("/", "%2F")}`,
  pypi: (n) => `https://pypi.org/pypi/${n}/json`,
  crates: (n) => `https://crates.io/api/v1/crates/${n}`,
  gems: (n) => `https://rubygems.org/api/v1/gems/${n}.json`,
};

/** True when the registry knows the package, false on a 404, undefined when it could not be asked. */
async function published(fetchFn: typeof fetch, registry: string, name: string): Promise<boolean | undefined> {
  const url = LOOKUP[registry]?.(name);
  // published() is only ever called below with a registry PATTERNS already matched, and PATTERNS
  // and LOOKUP carry the exact same four keys, so this lookup cannot miss.
  /* v8 ignore next */
  if (!url) return undefined;
  try {
    const res = await fetchFn(url, { headers: { accept: "application/json", "user-agent": "readmerlin registry check" }, signal: AbortSignal.timeout(8000) });
    await res.body?.cancel();
    if (res.status === 404) return false;
    return res.ok ? true : undefined;
  } catch {
    return undefined;
  }
}

export const registryBadges: Rule = {
  id: "badges/registry-present",
  level: "warn",
  pages: true,
  description: "A published package carries its registry version and downloads badges; a repo with no package carries its clone count; each host in worksWith has its badge",
  run: async ({ doc, config, links, fetch }) => {
    const out = [];
    const badges = collectImages(doc).filter((i) => i.badge).map((i) => i.src);
    // The manifest beside the README, or the repo's when the README's folder has none.
    const packages = readPackages(doc.dir).length ? readPackages(doc.dir) : readPackages(doc.repoRoot);
    for (const p of packages) {
      const re = PATTERNS[p.registry];
      // readPackages() only ever emits registry: "npm" | "pypi" | "crates" | "gems", the exact
      // key set PATTERNS carries, so this lookup cannot miss.
      /* v8 ignore next */
      if (!re) continue;
      const hasVersion = badges.some((b) => re.test(b) && /\/(v)\//.test(b));
      const hasDownloads = badges.some((b) => re.test(b) && !/\/(v)\//.test(b));
      if (!hasVersion || !hasDownloads) {
        // The manifest says publishable. Only the registry says published.
        if (links && (await published(fetch, p.registry, p.name)) === false) continue;
        out.push({
          message: `${p.name} ${links ? "is published on" : "is set up to publish to"} ${p.registry} but the README carries no ${!hasVersion && !hasDownloads ? "version or downloads" : !hasVersion ? "version" : "downloads"} badge for it.`,
          line: 1,
          repair: `Add, linked to ${p.badges[0].href}: ${p.badges.map((b) => b.src).join(" and ")}`,
        });
      }
    }
    if (doc.kind === "readme") {
      for (const host of (config.worksWith ?? []).filter((h) => BADGED_HOSTS().includes(h))) {
        const want = hostBadgeSrc(host).split("?")[0].toLowerCase();
        if (!badges.some((b) => b.split("?")[0].toLowerCase() === want)) out.push({ message: `No works-with badge for ${host}.`, line: 1, repair: "Carry the works-with row from `readmerlin context`, one badge per host, under the first badge row." });
      }
    }
    // No package means clones are the only count, so the README carries the clone badge from the first day.
    if (doc.kind === "readme" && packages.length === 0 && !badges.some((b) => /\/badges\/clones\.json/.test(b))) {
      const r = remoteOf(doc.repoRoot);
      if (r.host === "github.com" && r.owner && r.name) {
        out.push({ message: "The repo has no registry package, and the README carries no clone count.", line: 1, repair: `Add the clone badge from \`readmerlin context\`, linked to https://github.com/oficiallyAkshay/clonometer, and run \`readmerlin init-workflow --clones\` for its numbers.` });
      }
    }
    return out;
  },
};

export const REGISTRY_RULES: Rule[] = [registryBadges];
