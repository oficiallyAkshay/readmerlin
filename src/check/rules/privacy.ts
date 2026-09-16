import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { toString } from "mdast-util-to-string";
import { proseLines } from "../util.js";
import type { Rule } from "../types.js";

const CONVENTIONAL = [
  /^readme(\.[a-z]{2})?\.md$/i, /^licen[cs]e(\..*)?$/i, /^changelog(\..*)?$/i, /^contributing(\..*)?$/i, /^security(\..*)?$/i, /^code_of_conduct(\..*)?$/i, /^codeowners$/i,
  /^skill\.md$/i, /^agents\.md$/i, /^claude\.md$/i, /^gemini\.md$/i, /^\.cursorrules$/i,
  /^package(-lock)?\.json$/, /^pnpm-lock\.yaml$/, /^yarn\.lock$/, /^bun\.lockb?$/, /^pyproject\.toml$/, /^requirements.*\.txt$/, /^setup\.(py|cfg)$/, /^uv\.lock$/, /^poetry\.lock$/, /^cargo\.(toml|lock)$/i, /^go\.(mod|sum)$/, /^makefile$/i, /^dockerfile$/i, /^docker-compose.*\.ya?ml$/, /^tsconfig.*\.json$/, /^.*\.config\.(js|ts|mjs|cjs)$/, /^action\.ya?ml$/, /^readmerlin(\.schema)?\.json$/, /^codecov\.ya?ml$/, /^\.pre-commit-config\.yaml$/, /^\.editorconfig$/, /^\.prettierrc.*$/, /^\.eslintrc.*$/, /^\.npmrc$/, /^\.nvmrc$/, /^\.python-version$/, /^\.env\.example$/, /^\.gitignore$/, /^\.gitattributes$/, /^\.gitmodules$/, /^vitest\.config\.ts$/,
  /^\.github$/, /^\.claude$/, /^\.claude-plugin$/, /^\.mcp\.json$/, /^\.cursor$/, /^\.codex$/, /^\.agents$/, /^\.vscode$/,
  /^(src|lib|bin|dist|docs|examples?|tests?|scripts?|assets|references?|skills?|commands?|agents?|hooks?|templates?|schemas?|renderers?|tools?|integrations?|benchmarks?|public|static)$/i,
];

export const rootFiles: Rule = {
  id: "honesty/root-files",
  level: "warn",
  description: "Root files outside the conventional set",
  run: ({ doc }) => {
    let names: string[];
    try {
      names = readdirSync(doc.repoRoot).filter((n) => n !== ".git" && n !== "node_modules" && n !== ".DS_Store");
    } catch {
      return [];
    }
    const odd = names.filter((n) => !CONVENTIONAL.some((re) => re.test(n)));
    return odd.length ? [{ message: `Root has files a host or reader does not need: ${odd.join(", ")}.`, line: 1, repair: "Move them under docs, references or scripts, or delete them." }] : [];
  },
};

export const comparisonHeaders: Rule = {
  id: "honesty/comparison-categories",
  level: "warn",
  description: "Comparison columns are categories, not products",
  run: ({ doc, config }) => {
    if (config.productNames.length === 0) return [];
    const out = [];
    const names = config.productNames.map((p) => p.toLowerCase());
    for (const s of doc.sections.filter((x) => /compar|alternativ|\bvs\b/i.test(x.title))) {
      for (const n of s.nodes) {
        if (n.type !== "table" || !n.children[0]) continue;
        const header = n.children[0].children.map((c) => toString(c).toLowerCase());
        const hits = header.filter((h) => names.includes(h));
        if (hits.length) out.push({ message: `Comparison names products: ${hits.join(", ")}.`, line: n.position?.start.line, repair: "Head the columns with categories, such as AI generators or syntax linters." });
      }
    }
    return out;
  },
};

export const denylist: Rule = {
  id: "privacy/denylist",
  level: "fail",
  description: "No token whose hash is on the committed denylist",
  run: ({ doc, config }) => {
    const file = config.denylistFile ?? join(doc.repoRoot, ".readmerlin", "denylist.sha256");
    if (!existsSync(file)) return [];
    const hashes = new Set(readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => /^[0-9a-f]{64}$/.test(l)));
    if (hashes.size === 0) return [];
    const out = [];
    for (let i = 0; i < doc.lines.length; i++) {
      const tokens = new Set<string>();
      for (const t of doc.lines[i].split(/[\s<>"'()[\],;:|]+/)) {
        const clean = t.replace(/^[^\w@.-]+|[^\w@.-]+$/g, "");
        if (clean.length >= 3) {
          tokens.add(clean);
          tokens.add(clean.toLowerCase());
        }
      }
      for (const t of tokens) {
        if (hashes.has(createHash("sha256").update(t).digest("hex"))) {
          out.push({ message: "A denylisted token appears on this line.", line: i + 1, repair: "Remove it. The denylist is hashed, so the token is not named here." });
          break;
        }
      }
    }
    return out;
  },
};

const EMAIL_RE = /(?<![\w/:])([\w.+-]+)@([\w-]+(?:\.[\w-]+)*\.[a-z]{2,})(?![\w:/])/gi;
const SAFE_EMAIL = /@(example\.(com|org|net)|.*\.invalid|users\.noreply\.github\.com)$/i;
const HOME_RE = /(^|[\s"'(=:`])(\/Users\/[\w.-]+|\/home\/[\w.-]+|[A-Z]:\\Users\\[\w.-]+)(?=[\/\s"'`)]|$)/;
const KEY_RE = /\b(sk-(ant-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

export const pii: Rule = {
  id: "privacy/pii",
  level: "fail",
  description: "No emails, home paths or key-shaped strings",
  run: ({ doc }) => {
    const out = [];
    for (let i = 0; i < doc.lines.length; i++) {
      const line = doc.lines[i];
      const emails = [...line.matchAll(EMAIL_RE)].map((m) => m[0]).filter((e) => !SAFE_EMAIL.test(e) && !/^git@/i.test(e));
      if (emails.length) out.push({ message: "Email address in the README.", line: i + 1, repair: "Remove it. Contact goes through issues or the platform profile." });
      if (HOME_RE.test(line)) out.push({ message: "Home directory path in the README.", line: i + 1, repair: "Use a relative path or a placeholder." });
      if (KEY_RE.test(line)) out.push({ message: "Key-shaped string in the README.", line: i + 1, repair: "Remove it and rotate the key." });
    }
    return out;
  },
};

export const hostPathPointers: Rule = {
  id: "privacy/host-path-pointers",
  level: "fail",
  description: "No host install-path pointer lines",
  run: ({ doc }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      if (/^\s*(<sub>)?\s*(install paths?|paths? per host|where (it|this) (lives|installs))/i.test(line.replace(/<[^>]+>/g, ""))) out.push({ message: "Host path pointer line.", line: i + 1, repair: "The Runs on badges already link to each host's notes." });
    }
    return out;
  },
};

export const PRIVACY_RULES: Rule[] = [rootFiles, comparisonHeaders, denylist, pii, hostPathPointers];
