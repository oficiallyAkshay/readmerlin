import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import { stabilize } from "../text.js";
import { isBadge } from "../check/util.js";
import { firstParagraph, headingsOf, splitFrontmatter } from "./frontmatter.js";
import type { BadgeSpec, McpFileInfo, NamedDoc, PackageInfo, PluginInfo, ReadmeInfo, SkillInfo, WorkflowInfo } from "./types.js";

// Never entered, at any depth.
const SKIP_ALWAYS = new Set(["node_modules", ".git", ".readmerlin"]);
// Skipped only at the repo root: a skill or command may be named test, spec or build.
const SKIP_AT_ROOT = new Set(["dist", "build", ".venv", "venv", "__pycache__", ".next", "target", "vendor", "test", "tests", "__tests__", "fixtures", "spec", "examples", "example"]);
const SKIP_DIRS = new Set([...SKIP_ALWAYS, ...SKIP_AT_ROOT]);

const posix = (p: string): string => p.split(sep).join("/");

function realpathOr(p: string): string | undefined {
  try {
    return realpathSync(p);
  } catch {
    return undefined;
  }
}

/** Lists files under root to maxDepth. A symlink is followed once and only when it stays inside root, so a link out of the repo or back into it never adds files. */
export function walk(root: string, maxDepth: number, pred: (rel: string, name: string) => boolean): string[] {
  const out: string[] = [];
  const rootReal = realpathOr(root) ?? root;
  const seen = new Set<string>([rootReal]);
  const inside = (real: string) => real === rootReal || real.startsWith(rootReal + sep);
  const visit = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      const rel = posix(relative(root, full));
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      const real = realpathOr(full);
      if (!real || !inside(real)) continue;
      if (st.isDirectory()) {
        if (SKIP_ALWAYS.has(name) || (depth === 0 && SKIP_AT_ROOT.has(name))) continue;
        if (seen.has(real)) continue;
        seen.add(real);
        visit(full, depth + 1);
      } else if (pred(rel, name)) {
        if (seen.has(real)) continue;
        seen.add(real);
        out.push(rel);
      }
    }
  };
  visit(root, 0);
  return out.sort();
}

function readText(root: string, rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function readJson(root: string, rel: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(readText(root, rel));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);

export function readSkills(root: string): SkillInfo[] {
  return walk(root, 3, (_rel, name) => name === "SKILL.md").map((rel) => {
    const { data, body } = splitFrontmatter(readText(root, rel));
    return {
      path: rel,
      name: str(data.name),
      description: str(data.description),
      license: str(data.license),
      metadata: data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : undefined,
      headings: headingsOf(body),
      summary: firstParagraph(body),
    };
  });
}

export function readNamedDocs(root: string, dirs: string[]): NamedDoc[] {
  const out: NamedDoc[] = [];
  // The same file reached through two folders, one a link to the other, is listed once.
  const seen = new Set<string>();
  for (const d of dirs) {
    const full = join(root, d);
    if (!existsSync(full)) continue;
    for (const rel of walk(full, 2, (_r, name) => name.endsWith(".md") && name !== "README.md")) {
      const path = posix(join(d, rel));
      // walk() already resolved this same path a moment ago; only a concurrent delete gets the fallback here.
      /* v8 ignore next */
      const real = realpathOr(join(root, path)) ?? path;
      if (seen.has(real)) continue;
      seen.add(real);
      const { data, body } = splitFrontmatter(readText(root, path));
      out.push({ path, name: str(data.name) ?? rel.replace(/\.md$/, ""), description: str(data.description) ?? firstParagraph(body) });
    }
  }
  return out;
}

export function readPlugin(root: string): PluginInfo | undefined {
  const rel = ".claude-plugin/plugin.json";
  const j = readJson(root, rel);
  if (!j) return undefined;
  const mcp = j.mcpServers && typeof j.mcpServers === "object" ? Object.keys(j.mcpServers as object) : undefined;
  return {
    path: rel,
    name: str(j.name),
    description: str(j.description),
    version: str(j.version),
    commands: strList(j.commands),
    agents: strList(j.agents),
    skills: strList(j.skills),
    hooks: j.hooks,
    mcpServers: mcp,
  };
}

export function readMarketplace(root: string): { path: string; name?: string; plugins: string[] } | undefined {
  const rel = ".claude-plugin/marketplace.json";
  const j = readJson(root, rel);
  if (!j) return undefined;
  const plugins = Array.isArray(j.plugins) ? (j.plugins as Array<Record<string, unknown>>).map((p) => str(p.name) ?? "").filter(Boolean) : [];
  return { path: rel, name: str(j.name), plugins };
}

export function readMcp(root: string): McpFileInfo[] {
  const files = [".mcp.json", "mcp.json", "server.json", ".cursor/mcp.json", ".vscode/mcp.json"].filter((f) => existsSync(join(root, f)));
  const out: McpFileInfo[] = [];
  for (const rel of files) {
    const j = readJson(root, rel);
    if (!j) continue;
    const servers: McpFileInfo["servers"] = [];
    const table = (j.mcpServers ?? j.servers) as Record<string, Record<string, unknown>> | undefined;
    if (table && typeof table === "object") {
      for (const [name, cfg] of Object.entries(table)) {
        if (!cfg || typeof cfg !== "object") continue;
        servers.push({ name, command: str(cfg.command), args: strList(cfg.args), url: str(cfg.url) });
      }
    } else if (str(j.name)) {
      const pk = Array.isArray(j.packages) ? (j.packages as Array<Record<string, unknown>>)[0] : undefined;
      servers.push({ name: str(j.name)!, command: pk ? str(pk.identifier) ?? str(pk.name) : undefined, url: str(j.url) });
    }
    out.push({ path: rel, servers });
  }
  return out;
}

export function readHooks(root: string): string[] {
  const out: string[] = [];
  for (const rel of ["hooks/hooks.json", ".claude/hooks.json", ".claude/settings.json"]) {
    const j = readJson(root, rel);
    const hooks = j?.hooks;
    if (hooks && typeof hooks === "object") out.push(...Object.keys(hooks as object).map((k) => `${rel}: ${k}`));
  }
  return out;
}

export function readWorkflows(root: string): WorkflowInfo[] {
  const dir = ".github/workflows";
  if (!existsSync(join(root, dir))) return [];
  return walk(join(root, dir), 0, (_r, name) => /\.ya?ml$/.test(name)).map((file) => {
    let name: string | undefined;
    try {
      const y = parseYaml(readText(root, join(dir, file)));
      name = str(y?.name);
    } catch {
      name = undefined;
    }
    return { file: posix(join(dir, file)), name };
  });
}

export function readLicense(root: string): { file: string; spdx?: string } | undefined {
  const file = readdirSync(root).find((n) => /^(LICENSE|LICENCE|COPYING)([.-].*)?$/i.test(n) && existsSync(join(root, n)));
  if (!file) return undefined;
  const head = readText(root, file).slice(0, 400);
  const spdx = /MIT License/i.test(head) ? "MIT" : /Apache License/i.test(head) ? "Apache-2.0" : /GNU GENERAL PUBLIC/i.test(head) ? (/Version 2\b/.test(head) ? "GPL-2.0" : "GPL-3.0") : /BSD/i.test(head) ? "BSD" : /Mozilla Public/i.test(head) ? "MPL-2.0" : undefined;
  return { file, spdx };
}

export function readReadme(root: string): ReadmeInfo {
  const file = readdirSync(root).find((n) => /^readme\.md$/i.test(n) && existsSync(join(root, n)));
  if (!file) return { exists: false, headings: [], badges: 0, images: [], words: 0 };
  const text = readText(root, file);
  const { body } = splitFrontmatter(text);
  const h1Body = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body)?.[1];
  const title = (h1Body !== undefined ? stabilize(h1Body, /<[^>]+>/g, "").trim() : undefined) ?? /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const tagline = /<b>([^<]+)<\/b>/i.exec(body)?.[1]?.trim() ?? /^\*\*([^*]+)\*\*$/m.exec(body)?.[1]?.trim();
  const images = [...body.matchAll(/(?:<img[^>]+src="([^"]+)"|!\[[^\]]*\]\(([^)\s]+))/g)].map((m) => m[1] ?? m[2]);
  // The same badge-host allowlist the check runs on: shields.io and its mirrors, plus a handful of
  // hosts with no shields mirror at all (OpenSSF Best Practices, Scorecard, codecov.io), so a badge
  // from any of those is counted here and left out of the plain image list the same way.
  const badges = images.filter((s) => isBadge(s)).length;
  const prose = body.replace(/<[^>]+>/g, " ").replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const words = prose.split(/\s+/).filter((w) => /\w/.test(w)).length;
  return { exists: true, title, tagline, headings: headingsOf(body), badges, images: images.filter((s) => !isBadge(s)), words, text: body.trim() };
}

const HOST_HINTS: Array<[RegExp, string]> = [
  [/claude[\s-]?code/i, "Claude Code"],
  [/claude\.ai|claude desktop/i, "Claude.ai"],
  [/\bcursor\b/i, "Cursor"],
  [/\bcodex\b/i, "Codex"],
  [/gemini[\s-]?cli/i, "Gemini CLI"],
  [/\bcopilot\b/i, "Copilot"],
  [/\bopencode\b/i, "OpenCode"],
  [/\bwindsurf\b/i, "Windsurf"],
  [/\bopenclaw\b/i, "OpenClaw"],
  [/\bhermes\b/i, "Hermes Agent"],
];

export function detectHosts(root: string, plugin: PluginInfo | undefined, skills: SkillInfo[]): string[] {
  const found = new Set<string>();
  const texts: string[] = [];
  for (const rel of ["references/hosts.md", "docs/hosts.md", "HOSTS.md"]) {
    if (existsSync(join(root, rel))) texts.push(headingsOf(readText(root, rel)).join("\n"));
  }
  if (texts.length === 0) {
    // The hero names the hosts, so read the README up to its first section and no further.
    const readme = readdirSync(root).find((n) => /^readme\.md$/i.test(n) && existsSync(join(root, n)));
    if (readme) {
      const body = splitFrontmatter(readText(root, readme)).body;
      const hero = body.split(/^##\s/m)[0];
      texts.push(hero);
    }
  }
  for (const t of texts) for (const [re, host] of HOST_HINTS) if (re.test(t)) found.add(host);
  // A host folder says where the developer works, so it only names a host when the repo ships something an agent loads: a plugin, a skill or an MCP server.
  if (found.size === 0 && (plugin || skills.length > 0 || readMcp(root).length > 0)) {
    if (plugin || existsSync(join(root, ".claude"))) found.add("Claude Code");
    if (existsSync(join(root, ".cursor"))) found.add("Cursor");
    if (existsSync(join(root, ".codex")) || existsSync(join(root, "AGENTS.md"))) found.add("Codex");
    if (skills.length > 0 && found.size === 0) found.add("Claude Code");
  }
  return [...found];
}

export function installLines(repo: { owner?: string; name?: string }, plugin: PluginInfo | undefined, skills: SkillInfo[], marketplace: { name?: string } | undefined, packages: PackageInfo[] = []): string[] {
  const out: string[] = [];
  for (const p of packages) {
    if (p.registry === "npm") out.push(`npx ${p.name}`);
    if (p.registry === "pypi") out.push(`uvx ${p.name}`);
    if (p.registry === "crates") out.push(`cargo install ${p.name}`);
    if (p.registry === "gems") out.push(`gem install ${p.name}`);
  }
  const slug = repo.owner && repo.name ? `${repo.owner}/${repo.name}` : "<owner>/<repo>";
  if (skills.length > 0) out.push(`npx skills add ${slug} -g`);
  if (plugin && plugin.name) out.push(`/plugin install ${plugin.name}${marketplace?.name ? `@${marketplace.name}` : ""}`);
  if (marketplace) out.push(`/plugin marketplace add ${slug}`);
  return out;
}

/** Published packages the repo declares. A package is published when it has a name and is not marked private. */
export function readPackages(root: string): PackageInfo[] {
  const out: PackageInfo[] = [];
  const npm = readJson(root, "package.json");
  // A package.json is published when it is not private and has something to publish: a bin, an entry point or a files list.
  if (npm && str(npm.name) && npm.private !== true && (npm.bin || npm.main || npm.exports || npm.files || npm.publishConfig)) {
    const name = str(npm.name)!;
    const enc = encodeURIComponent(name);
    out.push({ registry: "npm", name, file: "package.json", badges: [
      { label: "npm version", src: `https://img.shields.io/npm/v/${enc}?logo=npm&logoColor=white`, href: `https://www.npmjs.com/package/${name}`, logo: "npm" },
      { label: "npm downloads per week", src: `https://img.shields.io/npm/dw/${enc}?logo=npm&logoColor=white`, href: `https://www.npmjs.com/package/${name}`, logo: "npm" },
    ] });
  }
  if (existsSync(join(root, "pyproject.toml"))) {
    const toml = readText(root, "pyproject.toml");
    // The name key of the [project] or [tool.poetry] table itself, not of a later table or an inline author.
    const tableName = (table: string) => new RegExp(`^\\[${table}\\]\\s*\\n((?:(?!^\\[)[^\\n]*\\n)*?)^name\\s*=\\s*"([^"]+)"`, "m").exec(toml)?.[2];
    const inProject = tableName("project") ?? tableName("tool\\.poetry");
    const priv = /Private\s*::\s*Do Not Upload/i.test(toml);
    // Published when it declares a build system; a pyproject that only configures tools is not a package.
    if (inProject && !priv && /\[build-system\]/.test(toml)) {
      const name = inProject;
      out.push({ registry: "pypi", name, file: "pyproject.toml", badges: [
        { label: "PyPI version", src: `https://img.shields.io/pypi/v/${name}?logo=pypi&logoColor=white`, href: `https://pypi.org/project/${name}/`, logo: "pypi" },
        { label: "PyPI downloads per month", src: `https://img.shields.io/pypi/dm/${name}?logo=pypi&logoColor=white`, href: `https://pypi.org/project/${name}/`, logo: "pypi" },
      ] });
    }
  }
  if (existsSync(join(root, "Cargo.toml"))) {
    const toml = readText(root, "Cargo.toml");
    const m = /\[package\][\s\S]*?name\s*=\s*"([^"]+)"/.exec(toml);
    if (m && !/publish\s*=\s*false/.test(toml)) {
      const name = m[1];
      out.push({ registry: "crates", name, file: "Cargo.toml", badges: [
        { label: "crates.io version", src: `https://img.shields.io/crates/v/${name}?logo=rust&logoColor=white`, href: `https://crates.io/crates/${name}`, logo: "rust" },
        { label: "crates.io downloads", src: `https://img.shields.io/crates/d/${name}?logo=rust&logoColor=white`, href: `https://crates.io/crates/${name}`, logo: "rust" },
      ] });
    }
  }
  const gemspec = readdirSync(root).find((n) => n.endsWith(".gemspec"));
  if (gemspec) {
    const m = /\.name\s*=\s*["']([^"']+)["']/.exec(readText(root, gemspec));
    if (m) {
      const name = m[1];
      out.push({ registry: "gems", name, file: gemspec, badges: [
        { label: "gem version", src: `https://img.shields.io/gem/v/${name}?logo=rubygems&logoColor=white`, href: `https://rubygems.org/gems/${name}`, logo: "rubygems" },
        { label: "gem downloads", src: `https://img.shields.io/gem/dt/${name}?logo=rubygems&logoColor=white`, href: `https://rubygems.org/gems/${name}`, logo: "rubygems" },
      ] });
    }
  }
  return out;
}

export function rootFiles(root: string): string[] {
  return readdirSync(root).filter((n) => !SKIP_DIRS.has(n) && !n.startsWith(".") || n === ".github" || n === ".claude-plugin" || n === ".mcp.json").sort();
}

export const CLONOMETER_URL = "https://github.com/oficiallyAkshay/clonometer";

// The badge row follows the repo's shape, never the data on hand: a clone badge belongs on a repo with no package before its first count exists.
export function badgeRow(repo: { host?: string; owner?: string; name?: string }, license: { file: string; spdx?: string } | undefined, packages: PackageInfo[]): BadgeSpec[] {
  const row: BadgeSpec[] = [];
  if (license?.spdx) row.push({ alt: `${license.spdx} licence`, src: `https://img.shields.io/badge/license-${license.spdx.replace(/-/g, "--")}-2f6f4e?logo=opensourceinitiative&logoColor=white`, href: license.file });
  for (const p of packages) for (const b of p.badges) row.push({ alt: b.label, src: b.src, href: b.href });
  if (packages.length === 0 && repo.host === "github.com" && repo.owner && repo.name) {
    row.push({ alt: "clones of this repository, last seven days and all time", src: `https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/${repo.owner}/${repo.name}/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white`, href: CLONOMETER_URL });
  }
  return row;
}

export function isSelf(skills: SkillInfo[]): boolean {
  return skills.some((k) => k.name === "readmerlin" && k.path === "skills/readmerlin/SKILL.md");
}

export function readCompare(root: string): { repos: string[]; rows: string[] } | undefined {
  const file = join(root, "readmerlin.json");
  if (!existsSync(file)) return undefined;
  try {
    const c = (JSON.parse(readFileSync(file, "utf8")) as { compare?: { repos?: unknown; rows?: unknown } }).compare;
    if (!c) return undefined;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return { repos: list(c.repos), rows: list(c.rows) };
  } catch {
    return undefined;
  }
}

// shields has no OpenAI mark, so Codex carries the simple-icons one inline (CC0), drawn white.
const OPENAI_MARK = "data:image/svg%2bxml;base64,PHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk9wZW5BSTwvdGl0bGU+PHBhdGggZD0iTTIyLjI4MTkgOS44MjExYTUuOTg0NyA1Ljk4NDcgMCAwIDAtLjUxNTctNC45MTA4IDYuMDQ2MiA2LjA0NjIgMCAwIDAtNi41MDk4LTIuOUE2LjA2NTEgNi4wNjUxIDAgMCAwIDQuOTgwNyA0LjE4MThhNS45ODQ3IDUuOTg0NyAwIDAgMC0zLjk5NzcgMi45IDYuMDQ2MiA2LjA0NjIgMCAwIDAgLjc0MjcgNy4wOTY2IDUuOTggNS45OCAwIDAgMCAuNTExIDQuOTEwNyA2LjA1MSA2LjA1MSAwIDAgMCA2LjUxNDYgMi45MDAxQTUuOTg0NyA1Ljk4NDcgMCAwIDAgMTMuMjU5OSAyNGE2LjA1NTcgNi4wNTU3IDAgMCAwIDUuNzcxOC00LjIwNTggNS45ODk0IDUuOTg5NCAwIDAgMCAzLjk5NzctMi45MDAxIDYuMDU1NyA2LjA1NTcgMCAwIDAtLjc0NzUtNy4wNzI5em0tOS4wMjIgMTIuNjA4MWE0LjQ3NTUgNC40NzU1IDAgMCAxLTIuODc2NC0xLjA0MDhsLjE0MTktLjA4MDQgNC43NzgzLTIuNzU4MmEuNzk0OC43OTQ4IDAgMCAwIC4zOTI3LS42ODEzdi02LjczNjlsMi4wMiAxLjE2ODZhLjA3MS4wNzEgMCAwIDEgLjAzOC4wNTJ2NS41ODI2YTQuNTA0IDQuNTA0IDAgMCAxLTQuNDk0NSA0LjQ5NDR6bS05LjY2MDctNC4xMjU0YTQuNDcwOCA0LjQ3MDggMCAwIDEtLjUzNDYtMy4wMTM3bC4xNDIuMDg1MiA0Ljc4MyAyLjc1ODJhLjc3MTIuNzcxMiAwIDAgMCAuNzgwNiAwbDUuODQyOC0zLjM2ODV2Mi4zMzI0YS4wODA0LjA4MDQgMCAwIDEtLjAzMzIuMDYxNUw5Ljc0IDE5Ljk1MDJhNC40OTkyIDQuNDk5MiAwIDAgMS02LjE0MDgtMS42NDY0ek0yLjM0MDggNy44OTU2YTQuNDg1IDQuNDg1IDAgMCAxIDIuMzY1NS0xLjk3MjhWMTEuNmEuNzY2NC43NjY0IDAgMCAwIC4zODc5LjY3NjVsNS44MTQ0IDMuMzU0My0yLjAyMDEgMS4xNjg1YS4wNzU3LjA3NTcgMCAwIDEtLjA3MSAwbC00LjgzMDMtMi43ODY1QTQuNTA0IDQuNTA0IDAgMCAxIDIuMzQwOCA3Ljg3MnptMTYuNTk2MyAzLjg1NThMMTMuMTAzOCA4LjM2NCAxNS4xMTkyIDcuMmEuMDc1Ny4wNzU3IDAgMCAxIC4wNzEgMGw0LjgzMDMgMi43OTEzYTQuNDk0NCA0LjQ5NDQgMCAwIDEtLjY3NjUgOC4xMDQydi01LjY3NzJhLjc5Ljc5IDAgMCAwLS40MDctLjY2N3ptMi4wMTA3LTMuMDIzMWwtLjE0Mi0uMDg1Mi00Ljc3MzUtMi43ODE4YS43NzU5Ljc3NTkgMCAwIDAtLjc4NTQgMEw5LjQwOSA5LjIyOTdWNi44OTc0YS4wNjYyLjA2NjIgMCAwIDEgLjAyODQtLjA2MTVsNC44MzAzLTIuNzg2NmE0LjQ5OTIgNC40OTkyIDAgMCAxIDYuNjgwMiA0LjY2ek04LjMwNjUgMTIuODYzbC0yLjAyLTEuMTYzOGEuMDgwNC4wODA0IDAgMCAxLS4wMzgtLjA1NjdWNi4wNzQyYTQuNDk5MiA0LjQ5OTIgMCAwIDEgNy4zNzU3LTMuNDUzN2wtLjE0Mi4wODA1TDguNzA0IDUuNDU5YS43OTQ4Ljc5NDggMCAwIDAtLjM5MjcuNjgxM3ptMS4wOTc2LTIuMzY1NGwyLjYwMi0xLjQ5OTggMi42MDY5IDEuNDk5OHYyLjk5OTRsLTIuNTk3NCAxLjQ5OTctMi42MDY3LTEuNDk5N1oiLz48L3N2Zz4=";

// Hosts a skill runs in, with the page a reader acts on and a shields logo where one renders.
const HOST_BADGES: Record<string, { href: string; logo?: string }> = {
  "Claude Code": { href: "https://github.com/anthropics/claude-code", logo: "claude" },
  Codex: { href: "https://github.com/openai/codex", logo: OPENAI_MARK },
  Cursor: { href: "https://cursor.com", logo: "cursor" },
  "Gemini CLI": { href: "https://github.com/google-gemini/gemini-cli", logo: "googlegemini" },
  Copilot: { href: "https://github.com/features/copilot", logo: "githubcopilot" },
  "Claude.ai": { href: "https://claude.ai", logo: "claude" },
  OpenCode: { href: "https://opencode.ai" },
  Windsurf: { href: "https://windsurf.com" },
  "Hermes Agent": { href: "https://github.com/NousResearch/hermes-agent" },
  OpenClaw: { href: "https://github.com/openclaw/openclaw" },
  "Claude Agent SDK": { href: "https://github.com/anthropics/claude-agent-sdk-typescript", logo: "claude" },
};

export const BADGED_HOSTS = (): string[] => Object.keys(HOST_BADGES);

/** Works-with badges for hosts shields has no mark for, which are label-only by design. */
export const MARKLESS_HOST_BADGES = (): string[] => Object.keys(HOST_BADGES).filter((h) => !HOST_BADGES[h].logo).map(hostBadgeSrc);

// Message-only: a logo and the host name, no repeated "works with" label. The row itself says "Works with" once, above the badges.
export function hostBadgeSrc(host: string): string {
  const esc = (v: string) => encodeURIComponent(v.replace(/-/g, "--"));
  const logo = HOST_BADGES[host]?.logo;
  return `https://img.shields.io/badge/${esc(host)}-1e1b4b${logo ? `?logo=${logo}${logo.startsWith("data:") ? "" : "&logoColor=white"}` : ""}`;
}

export function worksWithRow(hosts: string[]): BadgeSpec[] {
  return hosts.filter((h) => HOST_BADGES[h]).map((h) => ({ alt: h, src: hostBadgeSrc(h), href: HOST_BADGES[h].href }));
}

/** "AGENTS.md" when the repo has one at its root, so context lists it the way it lists a workflow. */
export function readAgentsFile(root: string): string | undefined {
  return existsSync(join(root, "AGENTS.md")) ? "AGENTS.md" : undefined;
}

export function readWorksWith(root: string): string[] | undefined {
  const file = join(root, "readmerlin.json");
  if (!existsSync(file)) return undefined;
  try {
    const w = (JSON.parse(readFileSync(file, "utf8")) as { worksWith?: unknown }).worksWith;
    return Array.isArray(w) ? w.filter((x): x is string => typeof x === "string") : undefined;
  } catch {
    return undefined;
  }
}
