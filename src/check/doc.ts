import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Heading } from "mdast";
import type { Doc, Section } from "./types.js";

export function parseDoc(file: string, repoRoot?: string): Doc {
  const text = readFileSync(file, "utf8");
  const tree = unified().use(remarkParse).use(remarkGfm).parse(text) as Root;
  const lines = text.split(/\r?\n/);
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
  return { file, text, lines, tree, hero, sections, repoRoot: repoRoot ? resolve(repoRoot) : resolve(dirname(file)) };
}

export function lineOf(node: { position?: { start: { line: number } } }): number | undefined {
  return node.position?.start.line;
}

export function htmlOf(nodes: RootContent[]): string {
  return nodes.filter((n) => n.type === "html").map((n) => (n as { value: string }).value).join("\n");
}
