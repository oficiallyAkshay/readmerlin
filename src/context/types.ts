export interface Frontmatter {
  [key: string]: unknown;
}

export interface SkillInfo {
  path: string;
  name?: string;
  description?: string;
  license?: string;
  metadata?: Record<string, unknown>;
  headings: string[];
  summary?: string;
}

export interface NamedDoc {
  path: string;
  name?: string;
  description?: string;
}

export interface PluginInfo {
  path: string;
  name?: string;
  description?: string;
  version?: string;
  commands: string[];
  agents: string[];
  skills: string[];
  hooks?: unknown;
  mcpServers?: string[];
}

export interface McpServerInfo {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
}

export interface McpFileInfo {
  path: string;
  servers: McpServerInfo[];
}

export interface WorkflowInfo {
  file: string;
  name?: string;
}

export interface ReadmeInfo {
  exists: boolean;
  title?: string;
  tagline?: string;
  headings: string[];
  badges: number;
  images: string[];
  words: number;
  text?: string;
}

export interface PackageInfo {
  registry: "npm" | "pypi" | "crates" | "gems" | "docker";
  name: string;
  file: string;
  /** shields badge urls the README should carry for this package */
  badges: Array<{ label: string; src: string; href: string; logo: string }>;
}

export interface RepoContext {
  root: string;
  packages: PackageInfo[];
  repo: { remote?: string; host?: string; owner?: string; name?: string };
  license?: { file: string; spdx?: string };
  install: string[];
  hosts: string[];
  skills: SkillInfo[];
  plugin?: PluginInfo;
  marketplace?: { path: string; name?: string; plugins: string[] };
  mcp: McpFileInfo[];
  commands: NamedDoc[];
  agents: NamedDoc[];
  hooks: string[];
  workflows: WorkflowInfo[];
  readme: ReadmeInfo;
  rootFiles: string[];
  /** The badges the hero row carries, decided by the repo's shape: licence, then registry badges or a clone count. */
  badgeRow: BadgeSpec[];
  /** The second badge row: one works-with badge per host the skill runs in. */
  worksWith: BadgeSpec[];
  /** Hosts found or set that have no works-with badge recipe, so the agent adds those by hand. */
  unbadgedHosts: string[];
  /** True when this repo ships the readmerlin skill itself, so its README is the product's own page. */
  self: boolean;
  /** The comparison spec from readmerlin.json: the alternative repos and the row labels, in order. */
  compare?: { repos: string[]; rows: string[] };
}

export interface BadgeSpec {
  alt: string;
  src: string;
  href: string;
}
