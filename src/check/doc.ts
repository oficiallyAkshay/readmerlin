import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Heading } from "mdast";
import type { Doc, Section } from "./types.js";

/** README.md, with an optional locale suffix such as README.fr.md. Every other file is a page: CONTRIBUTING, a docs page, anything else. */
const README_RE = /^readme(\.[a-z]{2})?\.md$/i;

/** The nearest folder at or above dir that holds .git, a folder or a file. */
export function gitRoot(dir: string): string | undefined {
  let d = dir;
  for (;;) {
    if (existsSync(join(d, ".git"))) return d;
    // A home directory under git is a dotfiles repo, never the root of a README below it.
    const up = dirname(d);
    if (up === d || up === homedir()) return undefined;
    d = up;
  }
}

export function parseDoc(file: string, repoRoot?: string): Doc {
  // One line ending, so offsets from the parser match offsets in text.
  const text = readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
  const tree = unified().use(remarkParse).use(remarkGfm).parse(text) as Root;
  const lines = text.split("\n");
  const dir = resolve(dirname(file));
  const hero: RootContent[] = [];
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const node of tree.children) {
    if (node.type === "heading" && node.depth >= 2) {
      current = { heading: node as Heading, title: toString(node).trim(), depth: node.depth, nodes: [], startLine: node.position?.start.line ?? 0, endLine: node.position?.end.line ?? 0 };
      sections.push(current);
      continue;
    }
    if (current) {
      current.nodes.push(node);
      current.endLine = node.position?.end.line ?? current.endLine;
    } else {
      hero.push(node);
    }
  }
  const root = repoRoot ? resolve(repoRoot) : gitRoot(dir) ?? dir;
  // A README is the page of a repo or of a package: at the repo root, or beside a manifest or a SKILL.md. A README.md inside docs is a page.
  const ownsAProduct = resolve(dir) === root || ["package.json", "pyproject.toml", "Cargo.toml", "SKILL.md", "action.yml", "plugin.json"].some((n) => existsSync(join(dir, n)));
  const kind: Doc["kind"] = README_RE.test(basename(file)) && ownsAProduct ? "readme" : "page";
  return { file, text, lines, tree, hero, sections, dir, repoRoot: root, kind };
}

export function lineOf(node: { position?: { start: { line: number } } }): number | undefined {
  return node.position?.start.line;
}

export function htmlOf(nodes: RootContent[]): string {
  return nodes.filter((n) => n.type === "html").map((n) => (n as { value: string }).value).join("\n");
}
