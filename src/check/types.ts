import type { Root, RootContent, Heading } from "mdast";

export type Level = "off" | "warn" | "fail";

export interface Finding {
  id: string;
  level: Exclude<Level, "off">;
  message: string;
  line?: number;
  repair?: string;
}

export interface Section {
  heading: Heading | undefined;
  title: string;
  depth: number;
  nodes: RootContent[];
  startLine: number;
  endLine: number;
}

export interface Doc {
  file: string;
  text: string;
  lines: string[];
  tree: Root;
  hero: RootContent[];
  sections: Section[];
  repoRoot: string;
}

export interface RuleContext {
  doc: Doc;
  config: Config;
  links: boolean;
  fetch: typeof fetch;
}

export interface Rule {
  id: string;
  level: Level;
  description: string;
  run: (ctx: RuleContext) => Promise<Omit<Finding, "id" | "level">[]> | Omit<Finding, "id" | "level">[];
}

export interface Config {
  rules: Record<string, Level>;
  killList: string[];
  disclaimers: string[];
  headingAllowlist: string[];
  sectionOrder: string[];
  maxSections: number;
  maxSectionLines: number;
  maxParagraphSentences: number;
  maxBadgesPerRow: number;
  maxImageHeight: number;
  productNames: string[];
  denylistFile?: string;
  counts: Record<string, string>;
  maxFindingsPerRule: number;
}

export interface CheckResult {
  file: string;
  findings: Finding[];
  fails: number;
  warns: number;
  ran: string[];
}
