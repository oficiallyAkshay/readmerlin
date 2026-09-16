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
}

export interface RepoContext {
  root: string;
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
}
