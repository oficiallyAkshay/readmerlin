import { readPackages } from "../../context/readers.js";
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
  description: "A published package carries its registry version and downloads badges",
  run: async ({ doc, links, fetch }) => {
    const out = [];
    const badges = collectImages(doc).filter((i) => i.badge).map((i) => i.src);
    // The manifest beside the README, or the repo's when the README's folder has none.
    const packages = readPackages(doc.dir).length ? readPackages(doc.dir) : readPackages(doc.repoRoot);
    for (const p of packages) {
      const re = PATTERNS[p.registry];
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
    return out;
  },
};

export const REGISTRY_RULES: Rule[] = [registryBadges];
