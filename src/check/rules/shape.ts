import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import { htmlOf } from "../doc.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { collectImages, collectLinks, EMOJI_RE, fencedLines } from "../util.js";
import type { Rule, Section } from "../types.js";

const INSTALL_RE = /(\bmcpServers\b|\bnpx\s+-y\s+|\bclaude\s+mcp\s+add|\bcode\s+--add-mcp|\bnpx\s+(-y\s+)?skills\s+add|(?:\/|\bclaude\s+)plugin\s+(install|marketplace)|npm\s+i(nstall)?\b|pnpm\s+(add|i)\b|yarn\s+add|pip(x)?\s+install|uv(x)?\s+(tool\s+)?(install|run)?|brew\s+install|cargo\s+install|go\s+install|git\s+clone|curl\s+-[a-zA-Z]*s|docker\s+(run|pull)|claude\s+mcp\s+add|cp\s+-r)/i;

/** An install step written as a plain sentence: what to add, and where. */
// A plain sentence that gets the thing onto the reader's machine: "Add the skill", "Clone the repo and build it", "Download the app".
const INSTALL_PROSE_RE = /\b(install|add|enable|copy|clone|download)\b[^.\n]{0,80}\b(action|skill|plugin|package|server|extension|workflow|folder|repo|repository|app|binary|launcher|tool|CLI)\b/i;
const BADGES_TITLE = /^badges?$/i;
const FEATURES_TITLE = /^features$/i;
const SECURITY_TITLE = /^security\b/i;
// A section addressed to an agent ("For agents", "Agent instructions"), never one that is merely about agents ("Supported agents") or a host ("For Claude Desktop").
const AGENT_TITLE = /^(?:#+\s*)?(?:(?:(?:notes?|instructions?|guidance|guide|context|reference)\s+)?for\s+(?:ai\s+|coding\s+)?(?:agents?|llms?|the model|claude(?=\s*$)|assistants?)\b|(?:ai\s+)?(?:agents?|llms?)\s+(?:instructions?|notes?|guide|reference|block)\b|agents\.md\s*$)/i;

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
      .filter((p) => !p.children.every((c) => c.type === "strong" || c.type === "image" || c.type === "link" || c.type === "html" || (c.type === "text" && !/\S/.test((c as { value?: string }).value ?? ""))))
      .map((p) => toString(p as never).trim())
      .filter(Boolean);
    // What is left of the html once the title and the bold lines are gone.
    const plainHtml = html
      .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
      .replace(/<(b|strong)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const hasPlain = plain.length > 0 || plainHtml.length > 0;
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
  description: "Badges live in the hero or in a Badges section",
  run: ({ doc }) => {
    const allowed = doc.sections.filter((s) => BADGES_TITLE.test(s.title)).map((s) => [s.startLine, s.endLine] as const);
    return collectImages(doc)
      .filter((i) => i.badge && !i.inHero && !allowed.some(([a, b]) => i.line >= a && i.line <= b))
      .map((i) => ({ message: "Badge outside the hero and the Badges section.", line: i.line, repair: "Move it into the badge rows under the hero graphic or into a Badges section, or drop it." }));
  },
};

export const heroVisual: Rule = {
  id: "shape/hero-visual",
  level: "fail",
  description: "The hero holds a visual",
  run: ({ doc }) => (collectImages(doc).some((i) => i.inHero && !i.badge) ? [] : [{ message: "No visual in the hero.", line: 1, repair: "Add the hero graphic under the tagline, above the badge rows." }]),
};

export const heroOneVisual: Rule = {
  id: "shape/hero-one-visual",
  level: "warn",
  description: "The hero holds one visual",
  run: ({ doc }) => {
    const visuals = collectImages(doc).filter((i) => i.inHero && !i.badge);
    const lines = [...new Set(visuals.map((v) => v.line))];
    return lines.length > 1 ? lines.slice(1).map((line) => ({ message: `More than one visual block in the hero (${lines.length}).`, line, repair: "One graphic above the fold. Anything else moves into a section." })) : [];
  },
};

export const ctaLink: Rule = {
  id: "shape/cta-link",
  level: "warn",
  description: "The hero holds at most one bold link, to the real artifact",
  run: ({ doc }) => {
    const bold = collectLinks(doc).filter((l) => l.inHero && l.bold);
    return bold.slice(1).map((l) => ({ message: "More than one bold link in the hero.", line: l.line, repair: "Keep the one that shows the real artifact." }));
  },
};

export const sectionCount: Rule = {
  id: "shape/section-count",
  level: "warn",
  description: "The section count stays within the limit",
  run: ({ doc, config }) => {
    const top = doc.sections.filter((s) => s.depth === 2);
    return top.length > config.maxSections ? [{ message: `${top.length} sections, limit ${config.maxSections}.`, line: top[config.maxSections].startLine, repair: "Merge or move sections into reference pages." }] : [];
  },
};

export const sectionLength: Rule = {
  id: "shape/section-length",
  level: "warn",
  description: "Every section stays within the line limit",
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
  description: "The install step sits in the hero or the first four sections",
  run: ({ doc }) => {
    const early = doc.sections.slice(0, 4).flatMap((s) => s.nodes).concat(doc.hero);
    let found = false;
    for (const n of early) {
      visit({ type: "root", children: [n] } as never, (node: { type: string; value?: string }) => {
        if ((node.type === "code" || node.type === "inlineCode") && INSTALL_RE.test(node.value ?? "")) found = true;
        if (node.type === "html" && /<code>[^<]*<\/code>/.test(node.value ?? "") && INSTALL_RE.test(node.value ?? "")) found = true;
      });
      // The sentence may sit in a paragraph, a list item or an html block.
      if (INSTALL_PROSE_RE.test(toString(n).replace(/<[^>]+>/g, " "))) found = true;
      if (found) break;
    }
    return found ? [] : [{ message: "No install or enable step in the hero or the first four sections.", line: doc.sections[0]?.startLine ?? 1, repair: "Add one plain sentence under the opening paragraph that names the secret to store, if any, and the action, skill or package to add." }];
  },
};

export const noProseOnly: Rule = {
  id: "shape/structured-sections",
  level: "warn",
  description: "A long section holds a list, a table or a picture",
  run: ({ doc }) =>
    doc.sections
      .filter((s) => s.nodes.length > 0 && s.nodes.every((n) => n.type === "paragraph") && s.nodes.map((n) => toString(n)).join(" ").split(/\s+/).length > 60)
      .map((s) => ({ message: `Section "${s.title}" is paragraphs only.`, line: s.startLine, repair: "Turn it into a list, a table, a fence or a picture, or cut it." })),
};

export const killList: Rule = {
  id: "shape/earned-headings",
  level: "fail",
  description: "Every heading earns its place; the kill list names the ones that never do",
  run: ({ doc, config }) => {
    const banned = new Set(config.killList.map((s) => s.toLowerCase()));
    return doc.sections
      .filter((s) => banned.has(s.title.toLowerCase()))
      .map((s) => ({ message: `Heading "${s.title}" is on the kill list.`, line: s.startLine, repair: "Drop the section. The platform or a badge already carries it." }));
  },
};

function blockLines(lines: string[], from: number): number {
  let n = 0;
  for (let i = from; i < lines.length && !/^#{1,2}\s/.test(lines[i]); i++) if (lines[i].trim()) n++;
  return n;
}

const AGENT_BLOCK_LINES = 40;

export const agentSection: Rule = {
  id: "shape/agents-in-contributing",
  level: "fail",
  description: "The agent block lives in CONTRIBUTING, under forty lines; the README is for people",
  run: ({ doc }) => {
    const out = doc.sections
      .filter((s) => AGENT_TITLE.test(s.title))
      .map((s) => ({ message: `Section "${s.title}" is written for agents.`, line: s.startLine, repair: "Move it to CONTRIBUTING under .github. The README is for people." }));
    for (const rel of [".github/CONTRIBUTING.md", "CONTRIBUTING.md", "docs/CONTRIBUTING.md"]) {
      const file = join(doc.repoRoot, rel);
      if (!existsSync(file)) continue;
      let lines: string[];
      try {
        lines = readFileSync(file, "utf8").split(/\r?\n/);
      } catch {
        continue;
      }
      const at = lines.findIndex((l) => /^##\s/.test(l) && AGENT_TITLE.test(l));
      if (at < 0) continue;
      const n = blockLines(lines, at + 1);
      if (n > AGENT_BLOCK_LINES) out.push({ message: `The agent block in ${rel} is ${n} lines, limit ${AGENT_BLOCK_LINES}.`, line: 1, repair: "Cut it to what an agent needs to start, and link the rest." });
    }
    return out;
  },
};

export const sectionOrder: Rule = {
  id: "shape/section-order",
  level: "warn",
  description: "Sections come from the configured set, in its order",
  run: ({ doc, config }) => {
    const order = config.sectionOrder.map((o) => o.toLowerCase());
    if (order.length === 0) return [];
    const top = doc.sections.filter((s) => s.depth === 2);
    const out = top
      .filter((s) => !order.includes(s.title.toLowerCase()))
      .map((s) => ({ message: `Section "${s.title}" is outside the shape.`, line: s.startLine, repair: `Fold it into one of: ${config.sectionOrder.join(", ")}. Reference detail goes to CONTRIBUTING.` }));
    const titles = top.map((s) => s.title.toLowerCase());
    const positions = order.map((o) => titles.indexOf(o)).filter((p) => p >= 0);
    const sorted = [...positions].sort((a, b) => a - b);
    if (!positions.every((p, i) => p === sorted[i])) out.push({ message: "Sections are out of order.", line: top[0].startLine, repair: `Order: ${config.sectionOrder.join(", ")}.` });
    return out;
  },
};

export const noCodeBeforeFeatures: Rule = {
  id: "shape/prose-before-features",
  level: "fail",
  description: "Everything above Features is words, the hero graphic and badges",
  run: ({ doc }) => {
    const features = doc.sections.find((s) => FEATURES_TITLE.test(s.title)) ?? doc.sections[0];
    const end = features ? features.startLine : Number.MAX_SAFE_INTEGER;
    const first = [...fencedLines(doc)].sort((a, b) => a - b)[0];
    return first !== undefined && first < end ? [{ message: "Code fence before the Features heading.", line: first, repair: "Say the install step in one plain sentence. Workflow files, commands and recipes live in CONTRIBUTING." }] : [];
  },
};

const SHELL_LANG = /^(bash|sh|shell|zsh|fish|console|shellsession|terminal|powershell|pwsh|ps1|bat|cmd)$/i;
// export counts only as a shell variable, so export default and export const stay code.
const SHELL_LINE = /^\s*(\$\s+|(sudo\s+)?(npx|npm|pnpm|yarn|bunx?|pipx?|uvx?|brew|cargo|go|git|curl|wget|mkdir|sed|cd|cp|mv|rm|docker|chmod|make|gh|claude)\s+\S|export\s+[A-Za-z_]\w*=)/;

export const noShellSnippets: Rule = {
  id: "shape/install-in-words",
  level: "fail",
  description: "Install and usage are said in plain sentences; commands live in CONTRIBUTING",
  run: ({ doc }) => {
    const out: Array<{ message: string; line?: number; repair: string }> = [];
    const repair = "Name the thing to add in a plain sentence. Commands live in CONTRIBUTING.";
    visit(doc.tree, (node) => {
      if (node.type === "code") {
        const lang = (node.lang ?? "").trim();
        const shell = SHELL_LANG.test(lang) || (!lang && node.value.split("\n").some((l) => SHELL_LINE.test(l)));
        if (shell) out.push({ message: "Shell snippet.", line: node.position?.start.line, repair });
      }
      if (node.type === "inlineCode" && SHELL_LINE.test(node.value)) out.push({ message: "Shell command in inline code.", line: node.position?.start.line, repair });
    });
    return out;
  },
};

function topItems(s: Section) {
  return s.nodes.flatMap((n) => (n.type === "list" ? n.children : []));
}

export const featureBullets: Rule = {
  id: "shape/feature-bullets",
  level: "warn",
  description: "Features is a bullet list; each bullet leads with an emoji and a bold phrase",
  run: ({ doc }) => {
    const out = [];
    for (const s of doc.sections.filter((x) => FEATURES_TITLE.test(x.title))) {
      const table = s.nodes.find((n) => n.type === "table" || (n.type === "html" && /<table\b/i.test(n.value)));
      if (table) out.push({ message: "Features is a table.", line: table.position?.start.line, repair: "Make it a bullet list: emoji, bold phrase of two to four words, one short clause." });
      for (const item of topItems(s)) {
        const para = item.children[0];
        const kids = para?.type === "paragraph" ? para.children : [];
        const lead = kids[0]?.type === "text" ? kids[0].value : "";
        const bold = kids.slice(0, 2).some((k) => k.type === "strong");
        if (!EMOJI_RE.test(lead) || !bold) out.push({ message: "Feature bullet without an emoji and a bold lead.", line: item.position?.start.line, repair: "Start with one emoji, then a bold phrase of two to four words, then one short clause." });
      }
    }
    return out;
  },
};

export const securityChecklist: Rule = {
  id: "shape/security-checklist",
  level: "warn",
  description: "Security is one sentence on the credential, then a checklist of what never happens",
  run: ({ doc }) => {
    const out = [];
    for (const s of doc.sections.filter((x) => SECURITY_TITLE.test(x.title))) {
      const table = s.nodes.find((n) => n.type === "table" || (n.type === "html" && /<table\b/i.test(n.value)));
      if (table) out.push({ message: "Security holds a table.", line: table.position?.start.line, repair: "One sentence on the credential, its scope and how it travels, then one list where every item starts with \u274c." });
      const paras = s.nodes.filter((n) => n.type === "paragraph");
      if (paras.length > 1) out.push({ message: `Security holds ${paras.length} paragraphs.`, line: paras[1].position?.start.line, repair: "Keep one sentence. The rest is the checklist." });
      const items = topItems(s);
      if (items.length === 0) out.push({ message: "Security has no checklist.", line: s.startLine, repair: "List what the software never does, every item starting with \u274c." });
      for (const item of items) if (!/^\s*\u274c/u.test(toString(item))) out.push({ message: "Security item does not start with \u274c.", line: item.position?.start.line, repair: "The list says what never happens. Move what it does into the opening sentence, or cut it." });
    }
    return out;
  },
};

export const badgesTable: Rule = {
  id: "shape/badges-table",
  level: "warn",
  description: "A Badges section is one full-width HTML table of live badges",
  run: ({ doc }) =>
    doc.sections
      .filter((s) => BADGES_TITLE.test(s.title))
      .filter((s) => !/<table\b[^>]*\bwidth\s*=\s*["']?100%/i.test(htmlOf(s.nodes)))
      .map((s) => ({ message: "The Badges section is not a full-width HTML table.", line: s.startLine, repair: 'Use <table width="100%">: rows are metrics, columns are time windows, every cell a live badge linked to its own URL.' })),
};

export const SHAPE_RULES: Rule[] = [heroExists, badgesInHero, heroVisual, heroOneVisual, ctaLink, sectionCount, sectionLength, enableStep, noProseOnly, killList, agentSection, sectionOrder, noCodeBeforeFeatures, noShellSnippets, featureBullets, securityChecklist, badgesTable];
