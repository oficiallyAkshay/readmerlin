import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Table, TableCell } from "mdast";
import { remoteOf } from "../../context/git.js";
import { proseLines } from "../util.js";
import type { Doc, Rule } from "../types.js";

const CONVENTIONAL = [
  /^readme(\.[a-z]{2})?\.md$/i, /^licen[cs]e(\..*)?$/i, /^changelog(\..*)?$/i, /^contributing(\..*)?$/i, /^security(\..*)?$/i, /^code_of_conduct(\..*)?$/i, /^codeowners$/i,
  /^skill\.md$/i, /^agents\.md$/i, /^claude\.md$/i, /^gemini\.md$/i, /^\.cursorrules$/i,
  /^package(-lock)?\.json$/, /^pnpm-lock\.yaml$/, /^yarn\.lock$/, /^bun\.lockb?$/, /^pyproject\.toml$/, /^requirements.*\.txt$/, /^setup\.(py|cfg)$/, /^uv\.lock$/, /^poetry\.lock$/, /^cargo\.(toml|lock)$/i, /^go\.(mod|sum)$/, /^makefile$/i, /^dockerfile$/i, /^docker-compose.*\.ya?ml$/, /^tsconfig.*\.json$/, /^.*\.config\.(js|ts|mjs|cjs)$/, /^action\.ya?ml$/, /^readmerlin(\.schema)?\.json$/, /^codecov\.ya?ml$/, /^\.pre-commit-config\.yaml$/, /^\.editorconfig$/, /^\.prettierrc.*$/, /^\.eslintrc.*$/, /^\.npmrc$/, /^\.nvmrc$/, /^\.python-version$/, /^\.env\.example$/, /^\.gitignore$/, /^\.gitattributes$/, /^\.gitmodules$/, /^vitest\.config\.ts$/, /\.gemspec$/,
  /^\.github$/, /^\.readmerlin$/, /^\.claude$/, /^\.claude-plugin$/, /^\.mcp\.json$/, /^\.cursor$/, /^\.codex$/, /^\.agents$/, /^\.vscode$/,
  /^(src|lib|bin|dist|docs|examples?|tests?|scripts?|assets|references?|skills?|commands?|agents?|hooks?|templates?|schemas?|renderers?|tools?|integrations?|benchmarks?|public|static)$/i,
];

/** Top-level names git tracks. Undefined outside a git checkout, so caches and virtualenvs never count. */
function trackedRootNames(root: string): string[] | undefined {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000, maxBuffer: 64 * 1024 * 1024 });
    const names = new Set(out.split("\0").filter(Boolean).map((f) => f.split("/")[0]));
    return names.size ? [...names] : undefined;
  } catch {
    return undefined;
  }
}

export const rootFiles: Rule = {
  id: "honesty/root-files",
  level: "warn",
  description: "Every tracked root file is one a host or a reader needs",
  // The README's own folder: a package inside a monorepo is judged on its files, not the monorepo's.
  run: ({ doc }) => {
    let names = trackedRootNames(doc.dir);
    if (!names) {
      try {
        names = readdirSync(doc.dir).filter((n) => n !== ".git" && n !== "node_modules" && n !== ".DS_Store");
      } catch {
        return [];
      }
    }
    const odd = names.filter((n) => !CONVENTIONAL.some((re) => re.test(n))).sort();
    return odd.length ? [{ message: `Root has files a host or reader does not need: ${odd.join(", ")}.`, line: 1, repair: "Move them under docs, references or scripts, or delete them." }] : [];
  },
};

const COMPARE_TITLE = /compar|alternativ|\bvs\b/i;

function comparisonTables(doc: Doc): Table[] {
  return doc.sections.filter((s) => COMPARE_TITLE.test(s.title)).flatMap((s) => s.nodes.filter((n): n is Table => n.type === "table"));
}

/** Header cells that name a column. The corner cell above the row labels is empty and does not count. */
function columns(t: Table): TableCell[] {
  const cells = t.children[0]?.children ?? [];
  return cells.filter((c, i) => i > 0 || toString(c).trim() !== "");
}

const linkOf = (c: TableCell): string | undefined => {
  let href: string | undefined;
  visit(c, "link", (l) => {
    href ??= l.url;
  });
  return href;
};

export const comparisonLinks: Rule = {
  id: "honesty/comparison-links",
  level: "warn",
  description: "Comparison columns are the real alternatives, each header a link to its repo",
  run: ({ doc }) =>
    comparisonTables(doc).flatMap((t) =>
      columns(t)
        .filter((c) => !linkOf(c))
        .map((c) => ({ message: `Comparison column "${toString(c).trim()}" is not a link.`, line: c.position?.start.line, repair: "Head every column with the full owner/repo name, linked, this project's included. Check every cell against that repo's README." })),
    ),
};

export const comparisonProductFirst: Rule = {
  id: "honesty/comparison-product-first",
  level: "warn",
  description: "The product is the first column of its comparison",
  run: ({ doc }) => {
    const remote = remoteOf(doc.repoRoot);
    const h1 = doc.hero.find((n) => n.type === "heading") ?? doc.hero.find((n) => n.type === "html" && /<h1\b/i.test(n.value));
    const title = h1 ? (h1.type === "html" ? (/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(h1.value)?.[1] ?? "").replace(/<[^>]+>/g, "") : toString(h1)) : "";
    const names = [remote.name, title.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim()].filter((n): n is string => !!n).map((n) => n.toLowerCase());
    if (names.length === 0) return [];
    const out = [];
    for (const t of comparisonTables(doc)) {
      const first = columns(t)[0];
      if (!first) continue;
      const text = `${toString(first)} ${linkOf(first) ?? ""}`.toLowerCase();
      if (!names.some((n) => text.includes(n))) out.push({ message: "The first comparison column is not this project.", line: first.position?.start.line, repair: "Put the product first, then the alternatives." });
    }
    return out;
  },
};

export const comparisonYesNo: Rule = {
  id: "honesty/comparison-marks",
  level: "fail",
  description: "A boolean comparison cell is \u2705 or \u274c",
  run: ({ doc }) => {
    const out = [];
    for (const t of comparisonTables(doc)) {
      for (const row of t.children.slice(1)) {
        for (const c of row.children.slice(1)) {
          if (/^(yes|no)\b/i.test(toString(c).trim())) out.push({ message: `Comparison cell says "${toString(c).trim()}".`, line: c.position?.start.line, repair: "Use \u2705 or \u274c. Any other cell is one or two words." });
        }
      }
    }
    for (const s of doc.sections.filter((x) => COMPARE_TITLE.test(x.title))) {
      for (const n of s.nodes) {
        if (n.type === "html" && /<td\b[^>]*>\s*(yes|no)\s*<\/td>/i.test(n.value)) out.push({ message: "Comparison cell says Yes or No.", line: n.position?.start.line, repair: "Use \u2705 or \u274c. Any other cell is one or two words." });
      }
    }
    return out;
  },
};

export const denylist: Rule = {
  id: "privacy/denylist-clear",
  level: "fail",
  description: "Every word is clear of the committed hashed denylist",
  run: ({ doc, config }) => {
    const file = config.denylistFile ? resolve(doc.repoRoot, config.denylistFile) : join(doc.repoRoot, ".readmerlin", "denylist.sha256");
    if (!existsSync(file)) return [];
    const hashes = new Set(readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => /^[0-9a-f]{64}$/.test(l)));
    if (hashes.size === 0) return [];
    const out = [];
    for (let i = 0; i < doc.lines.length; i++) {
      const tokens = new Set<string>();
      for (const t of doc.lines[i].split(/[\s<>"'()[\],;:|]+/)) {
        const clean = t.replace(/^[^\p{L}\p{N}_@.-]+|[^\p{L}\p{N}_@-]+$/gu, "");
        // The token itself, and each part of a compound such as acme-corp or acme.example.com.
        for (const part of [clean, ...clean.split(/[.@-]/)]) {
          if (part.length >= 3) {
            tokens.add(part);
            tokens.add(part.toLowerCase());
          }
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

const EMAIL_RE = /(?<![\w/])([\w.+-]+)@([\w-]+(?:\.[\w-]+)*\.[a-z]{2,})(?![\w:/])/gi;
const SAFE_EMAIL = /@(example\.(com|org|net)|.*\.invalid|users\.noreply\.github\.com)$/i;
const HOME_RE = /(^|[\s"'(=:`])(\/Users\/[\w.-]+|\/home\/[\w.-]+|[A-Z]:\\Users\\[\w.-]+)(?=[\/\s"'`)]|$)/;
const KEY_RE = /\b(sk-(ant-)?[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

export const pii: Rule = {
  id: "privacy/personal-data-clear",
  level: "fail",
  description: "Contact goes through the platform, paths are relative, keys stay out",
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
  id: "privacy/hosts-through-badges",
  level: "fail",
  description: "Host install notes are reached through the host badges",
  run: ({ doc }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      if (/^\s*(<sub>)?\s*(install paths?|paths? per host|where (it|this) (lives|installs))/i.test(line.replace(/<[^>]+>/g, ""))) out.push({ message: "Host path pointer line.", line: i + 1, repair: "The Runs on badges already link to each host's notes." });
    }
    return out;
  },
};

export const PRIVACY_RULES: Rule[] = [rootFiles, comparisonLinks, comparisonProductFirst, comparisonYesNo, denylist, pii, hostPathPointers];
