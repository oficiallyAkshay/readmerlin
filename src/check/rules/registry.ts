import { readPackages } from "../../context/readers.js";
import { collectImages } from "../util.js";
import type { Rule } from "../types.js";

const PATTERNS: Record<string, RegExp> = {
  npm: /shields\.io\/npm\/(v|dw|dm|dt|d18m)\//i,
  pypi: /shields\.io\/pypi\/(v|dm|dw|dd)\//i,
  crates: /shields\.io\/crates\/(v|d|dv)\//i,
  gems: /shields\.io\/gem\/(v|dt|dv)\//i,
};

export const registryBadges: Rule = {
  id: "badges/registry-present",
  level: "warn",
  description: "A published package carries its registry version and downloads badges",
  run: ({ doc }) => {
    const out = [];
    const badges = collectImages(doc).filter((i) => i.badge).map((i) => i.src);
    for (const p of readPackages(doc.repoRoot)) {
      const re = PATTERNS[p.registry];
      if (!re) continue;
      const hasVersion = badges.some((b) => re.test(b) && /\/(v)\//.test(b));
      const hasDownloads = badges.some((b) => re.test(b) && !/\/(v)\//.test(b));
      if (!hasVersion || !hasDownloads) {
        out.push({
          message: `${p.name} is published on ${p.registry} but the README carries no ${!hasVersion && !hasDownloads ? "version or downloads" : !hasVersion ? "version" : "downloads"} badge for it.`,
          line: 1,
          repair: `Add, linked to ${p.badges[0].href}: ${p.badges.map((b) => b.src).join(" and ")}`,
        });
      }
    }
    return out;
  },
};

export const REGISTRY_RULES: Rule[] = [registryBadges];
