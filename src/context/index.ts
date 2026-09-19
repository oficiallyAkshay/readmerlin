import { resolve } from "node:path";
import { remoteOf } from "./git.js";
import { BADGED_HOSTS, badgeRow, detectHosts, installLines, isSelf, readAgentsFile, readCompare, readWorksWith, worksWithRow, readHooks, readLicense, readMarketplace, readMcp, readNamedDocs, readPackages, readPlugin, readReadme, readSkills, readWorkflows, rootFiles } from "./readers.js";
import type { RepoContext } from "./types.js";

export async function gather(dir: string): Promise<RepoContext> {
  const root = resolve(dir);
  const repo = remoteOf(root);
  const skills = readSkills(root);
  const plugin = readPlugin(root);
  const marketplace = readMarketplace(root);
  const packages = readPackages(root);
  const license = readLicense(root);
  const hosts = readWorksWith(root) ?? detectHosts(root, plugin, skills);
  return {
    root,
    packages,
    repo,
    license,
    install: installLines(repo, plugin, skills, marketplace, packages),
    hosts,
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
    agentsFile: readAgentsFile(root),
    badgeRow: badgeRow(repo, license, packages),
    worksWith: worksWithRow(hosts),
    unbadgedHosts: hosts.filter((h) => !BADGED_HOSTS().includes(h)),
    self: isSelf(skills),
    compare: readCompare(root),
  };
}

export type { RepoContext, PackageInfo } from "./types.js";
