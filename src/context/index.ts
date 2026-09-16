import { resolve } from "node:path";
import { remoteOf } from "./git.js";
import { detectHosts, installLines, readHooks, readLicense, readMarketplace, readMcp, readNamedDocs, readPlugin, readReadme, readSkills, readWorkflows, rootFiles } from "./readers.js";
import type { RepoContext } from "./types.js";

export async function gather(dir: string): Promise<RepoContext> {
  const root = resolve(dir);
  const repo = remoteOf(root);
  const skills = readSkills(root);
  const plugin = readPlugin(root);
  const marketplace = readMarketplace(root);
  return {
    root,
    repo,
    license: readLicense(root),
    install: installLines(repo, plugin, skills, marketplace),
    hosts: detectHosts(root, plugin, skills),
    skills,
    plugin,
    marketplace,
    mcp: readMcp(root),
    commands: readNamedDocs(root, ["commands", ".claude/commands"]),
    agents: readNamedDocs(root, ["agents", ".claude/agents"]),
    hooks: readHooks(root),
    workflows: readWorkflows(root),
    readme: readReadme(root),
    rootFiles: rootFiles(root),
  };
}

export type { RepoContext } from "./types.js";
