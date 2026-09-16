import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import { htmlOf } from "../doc.js";
import { collectImages, collectLinks } from "../util.js";
import type { Rule } from "../types.js";

const INSTALL_RE = /(\bmcpServers\b|\bnpx\s+-y\s+|\bclaude\s+mcp\s+add|\bcode\s+--add-mcp|\bnpx\s+(-y\s+)?skills\s+add|\/plugin\s+(install|marketplace)|npm\s+i(nstall)?\b|pnpm\s+(add|i)\b|yarn\s+add|pip(x)?\s+install|uv(x)?\s+(tool\s+)?(install|run)?|brew\s+install|cargo\s+install|go\s+install|git\s+clone|curl\s+-[a-zA-Z]*s|docker\s+(run|pull)|claude\s+mcp\s+add|cp\s+-r)/i;

export const heroExists: Rule = {
  id: "hero/exists",
  level: "fail",
  description: "Everything before the first section holds a title, one bold line and one plain line",
  run: ({ doc }) => {
    const html = htmlOf(doc.hero);
    const hasTitle = /<h1[\s>]/i.test(html) || doc.hero.some((n) => n.type === "heading" && n.depth === 1);
    const hasBold = /<b>|<strong>/i.test(html) || doc.hero.some((n) => n.type === "paragraph" && (n as { children: Array<{ type: string }> }).children.some((c) => c.type === "strong"));
    const plain = doc.hero
      .filter((n) => n.type === "paragraph")
      .map((n) => n as { children: Array<{ type: string }> })
      .filter((p) => !p.children.every((c) => c.type === "strong" || c.type === "image" || c.type === "link" || (c.type === "text" && !/\S/.test((c as { value?: string }).value ?? ""))))
      .map((p) => toString(p as never).trim())
      .filter(Boolean);
    const plainHtml = html.replace(/<[^>]+>/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean);
    const hasPlain = plain.length > 0 || plainHtml.length > 1;
    const out = [];
    if (!hasTitle) out.push({ message: "No title before the first section.", line: 1, repair: "Start with a centered h1: emoji plus name." });
    if (!hasBold) out.push({ message: "No bold tagline before the first section.", line: 1, repair: "Add one bold line under the title that names the outcome." });
    if (!hasPlain) out.push({ message: "No plain one-liner before the first section.", line: 1, repair: "Add one plain sentence under the tagline." });
    return out;
  },
};

export const badgesInHero: Rule = {
  id: "shape/badges-in-hero",
  level: "fail",
  description: "All badges live in the hero, none below it",
  run: ({ doc }) =>
    collectImages(doc)
      .filter((i) => i.badge && !i.inHero)
      .map((i) => ({ message: "Badge below the first section.", line: i.line, repair: "Move it into the badge rows at the top, or drop it." })),
};

export const heroVisual: Rule = {
  id: "shape/hero-visual",
  level: "fail",
  description: "The hero holds a visual",
  run: ({ doc }) => (collectImages(doc).some((i) => i.inHero && !i.badge) ? [] : [{ message: "No visual in the hero.", line: 1, repair: "Add the hero graphic under the badge rows." }]),
};

export const heroOneVisual: Rule = {
  id: "shape/hero-one-visual",
  level: "warn",
  description: "The hero holds one visual, real output pages excepted",
  run: ({ doc }) => {
    const visuals = collectImages(doc).filter((i) => i.inHero && !i.badge);
    const lines = [...new Set(visuals.map((v) => v.line))];
    return lines.length > 1 ? lines.slice(1).map((line) => ({ message: `More than one visual block in the hero (${lines.length}).`, line, repair: "One graphic above the fold. Real output pages may follow the artifact link; anything else moves into a section." })) : [];
  },
};

export const ctaLink: Rule = {
  id: "shape/cta-link",
  level: "warn",
  description: "One bold call-to-action link in the hero",
  run: ({ doc }) => {
    const bold = collectLinks(doc).filter((l) => l.inHero && l.bold);
    if (bold.length === 1) return [];
    if (bold.length === 0) return [{ message: "No bold link to the real artifact in the hero.", line: 1, repair: "Add one bold centered link to the example output." }];
    return bold.slice(1).map((l) => ({ message: "More than one bold link in the hero.", line: l.line, repair: "Keep the one that shows the real artifact." }));
  },
};

export const sectionCount: Rule = {
  id: "shape/section-count",
  level: "warn",
  description: "Section count under the limit",
  run: ({ doc, config }) => {
    const top = doc.sections.filter((s) => s.depth === 2);
    return top.length > config.maxSections ? [{ message: `${top.length} sections, limit ${config.maxSections}.`, line: top[config.maxSections].startLine, repair: "Merge or move sections into reference pages." }] : [];
  },
};

export const sectionLength: Rule = {
  id: "shape/section-length",
  level: "warn",
  description: "Every section fits under the line limit",
  run: ({ doc, config }) =>
    doc.sections
      .filter((s) => s.depth === 2)
      .map((s, i, all) => ({ s, end: all[i + 1] ? all[i + 1].startLine - 1 : doc.lines.length }))
      .filter(({ s, end }) => end - s.startLine > config.maxSectionLines)
      .map(({ s, end }) => ({ message: `Section "${s.title}" is ${end - s.startLine} lines, limit ${config.maxSectionLines}.`, line: s.startLine, repair: "Cut prose or move detail to a reference page." })),
};

export const enableStep: Rule = {
  id: "shape/enable-step",
  level: "fail",
  description: "One enable or install step in the hero or the first four sections",
  run: ({ doc }) => {
    const early = doc.sections.slice(0, 4).flatMap((s) => s.nodes).concat(doc.hero);
    let found = false;
    for (const n of early) {
      visit({ type: "root", children: [n] } as never, (node: { type: string; value?: string }) => {
        if ((node.type === "code" || node.type === "inlineCode") && INSTALL_RE.test(node.value ?? "")) found = true;
        if (node.type === "html" && /<code>[^<]*<\/code>/.test(node.value ?? "") && INSTALL_RE.test(node.value ?? "")) found = true;
      });
      if (found) break;
    }
    return found ? [] : [{ message: "No install or enable step in the hero or the first four sections.", line: doc.sections[0]?.startLine ?? 1, repair: "Add one line: npx skills add owner/repo -g, a plugin command, or a folder copy." }];
  },
};

export const noProseOnly: Rule = {
  id: "shape/no-prose-only",
  level: "warn",
  description: "No section is prose only",
  run: ({ doc }) =>
    doc.sections
      .filter((s) => s.nodes.length > 0 && s.nodes.every((n) => n.type === "paragraph") && s.nodes.map((n) => toString(n)).join(" ").split(/\s+/).length > 60)
      .map((s) => ({ message: `Section "${s.title}" is paragraphs only.`, line: s.startLine, repair: "Turn it into a list, a table, a fence or a picture, or cut it." })),
};

export const killList: Rule = {
  id: "shape/kill-list",
  level: "fail",
  description: "No heading from the kill list",
  run: ({ doc, config }) => {
    const banned = new Set(config.killList.map((s) => s.toLowerCase()));
    return doc.sections
      .filter((s) => banned.has(s.title.toLowerCase()))
      .map((s) => ({ message: `Heading "${s.title}" is on the kill list.`, line: s.startLine, repair: "Drop the section. The platform or a badge already carries it." }));
  },
};

export const agentSection: Rule = {
  id: "shape/agent-section",
  level: "warn",
  description: "A named agent section exists and sits last",
  run: ({ doc }) => {
    const top = doc.sections.filter((s) => s.depth === 2);
    if (top.length === 0) return [];
    const idx = top.findIndex((s) => /\b(agents?|for the model|for claude|llms?)\b/i.test(s.title));
    if (idx < 0) return [{ message: "No section for agents.", line: top[top.length - 1].startLine, repair: "End with a named, denser section the agent reads." }];
    if (idx !== top.length - 1) return [{ message: "The agent section is not last.", line: top[idx].startLine, repair: "Move it to the end. Humans first, agents last." }];
    return [];
  },
};

export const sectionOrder: Rule = {
  id: "shape/section-order",
  level: "off",
  description: "Sections follow the configured order",
  run: ({ doc, config }) => {
    const order = config.sectionOrder;
    if (order.length === 0) return [];
    const titles = doc.sections.filter((s) => s.depth === 2).map((s) => s.title.toLowerCase());
    const positions = order.map((o) => titles.indexOf(o.toLowerCase())).filter((p) => p >= 0);
    const sorted = [...positions].sort((a, b) => a - b);
    return positions.every((p, i) => p === sorted[i]) ? [] : [{ message: "Sections are out of the configured order.", line: doc.sections[0].startLine, repair: `Order: ${order.join(", ")}.` }];
  },
};

export const SHAPE_RULES: Rule[] = [heroExists, badgesInHero, heroVisual, heroOneVisual, ctaLink, sectionCount, sectionLength, enableStep, noProseOnly, killList, agentSection, sectionOrder];
