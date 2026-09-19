import type { RepoContext } from "./types.js";

// A value stays on its line: a multi-line description cannot open a heading or a list item of its own.
const one = (v: string | number | undefined) => String(v ?? "").replace(/\s+/g, " ").trim();
const line = (label: string, v: string | number | undefined) => (v === undefined || v === "" ? "" : `- ${label}: ${one(v)}\n`);

// A value that looks like a credential is shown masked. The agent has the file if it needs the value.
const SECRET_RE = /(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[A-Z0-9]{12,}|xox[abpr]-[A-Za-z0-9-]{8,}|([?&](?:token|key|api_key|apikey|secret|password)=)[^&\s]+)/gi;
export const mask = (v: string): string => v.replace(SECRET_RE, (m, _a, prefix) => (prefix ? `${prefix}<hidden>` : "<hidden>"));

export function toMarkdown(c: RepoContext): string {
  let s = `# Repo context\n\n`;
  s += line("Repo", c.repo.owner && c.repo.name ? `${c.repo.owner}/${c.repo.name}` : c.repo.remote);
  s += line("License", c.license ? `${c.license.spdx ?? "unknown"} (${c.license.file})` : undefined);
  s += line("Hosts", c.hosts.join(", ") || undefined);
  s += line("Install", c.install.map((i) => `\`${i}\``).join(" or ") || undefined);
  s += line("Root files", c.rootFiles.join(", "));
  if (c.packages.length) {
    s += `\n## Published packages\n\n`;
    for (const p of c.packages) {
      s += `- ${p.registry}: ${p.name} (${p.file}). Badges to carry, each linked to ${p.badges[0].href}:\n`;
      for (const b of p.badges) s += `  - ${b.label}: ${b.src}\n`;
    }
  }
  if (c.skills.length) {
    s += `\n## Skills\n\n`;
    for (const k of c.skills) {
      s += `### ${k.name ?? k.path}\n\n${line("Path", k.path)}${line("Description", k.description)}${line("Headings", k.headings.join(" | ") || undefined)}${line("Summary", k.summary)}\n`;
    }
  }
  if (c.plugin) {
    s += `## Plugin\n\n${line("Name", c.plugin.name)}${line("Description", c.plugin.description)}${line("Version", c.plugin.version)}${line("Commands", c.plugin.commands.join(", ") || undefined)}${line("Agents", c.plugin.agents.join(", ") || undefined)}${line("Skills", c.plugin.skills.join(", ") || undefined)}${line("MCP servers", c.plugin.mcpServers?.join(", "))}\n`;
  }
  if (c.mcp.length) {
    s += `## MCP servers\n\n`;
    for (const f of c.mcp) for (const sv of f.servers) s += `- ${sv.name} (${f.path}): ${mask(one(sv.url ?? [sv.command, ...(sv.args ?? [])].filter(Boolean).join(" ")))}\n`;
    s += "\n";
  }
  if (c.commands.length) {
    s += `## Commands\n\n`;
    for (const d of c.commands) s += `- ${one(d.name)}: ${one(d.description ?? "")}\n`;
    s += "\n";
  }
  if (c.agents.length) {
    s += `## Agents\n\n`;
    for (const d of c.agents) s += `- ${one(d.name)}: ${one(d.description ?? "")}\n`;
    s += "\n";
  }
  if (c.hooks.length) s += `## Hooks\n\n${c.hooks.map((h) => `- ${h}`).join("\n")}\n\n`;
  if (c.workflows.length) s += `## Workflows\n\n${c.workflows.map((w) => `- ${w.file}${w.name ? `: ${w.name}` : ""}`).join("\n")}\n\n`;
  s += `## Existing README\n\n`;
  if (!c.readme.exists) s += `- none\n`;
  else s += `${line("Title", c.readme.title)}${line("Tagline", c.readme.tagline)}${line("Words", c.readme.words)}${line("Badges", c.readme.badges)}${line("Images", c.readme.images.join(", ") || undefined)}${line("Headings", c.readme.headings.join(" | ") || undefined)}`;
  return s;
}
