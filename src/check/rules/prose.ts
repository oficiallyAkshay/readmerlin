import { toString } from "mdast-util-to-string";
import { EMOJI_RE, paragraphs, proseLines, sentences } from "../util.js";
import type { Rule } from "../types.js";

export const noDashes: Rule = {
  id: "prose/no-dashes",
  level: "fail",
  description: "No em dashes or en dashes",
  run: ({ doc }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      const stripped = line.replace(/<img[^>]*>/g, "").replace(/!\[[^\]]*\]/g, "").replace(/\((https?:)?[^)\s]*\)/g, "").replace(/src="[^"]*"|href="[^"]*"/g, "").replace(/`[^`]*`/g, "");
      if (/[—–]/.test(stripped)) out.push({ message: "Em or en dash in prose.", line: i + 1, repair: "Split into two sentences, or use a comma or colon." });
    }
    return out;
  },
};

const VISUAL = "(readme|diagram|graphic|infographic|figure|image|svg|screenshot|chart|illustration)";
const META: Array<[RegExp, string]> = [
  [/\bthis readme\b/i, "talks about the README itself"],
  [new RegExp(`\\b(this|the|above|below|each|every)\\s+${VISUAL}s?\\b[^.\\n]{0,80}\\b(was|were|is|are)?\\s?(generated|produced|rendered|drawn|created|made|built)\\b[^.\\n]{0,40}\\b(by|with|using|from)\\b`, "i"), "explains how a visual was made"],
  [new RegExp(`\\b(generated|produced|rendered|drawn|created)\\b[^.\\n]{0,40}\\b(by|with|using)\\b[^.\\n]{0,60}\\b(this|the|above|below)\\s+${VISUAL}s?\\b`, "i"), "explains how a visual was made"],
];

export const metaNarration: Rule = {
  id: "prose/meta-narration",
  level: "fail",
  description: "No sentences about how the README or its visuals were produced",
  run: ({ doc }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      if (/^\s*<img|^\s*!\[|^\s*<!--/.test(line)) continue;
      // Quoted text is what the user says, not the README talking about itself.
      const stripped = line.replace(/alt="[^"]*"/g, "").replace(/!\[[^\]]*\]/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/"[^"]*"/g, "");
      for (const [re, why] of META) {
        if (re.test(stripped)) {
          out.push({ message: `Line ${why}.`, line: i + 1, repair: "Cut it. The reader does not need the making-of." });
          break;
        }
      }
    }
    return out;
  },
};

export const sentenceCase: Rule = {
  id: "prose/sentence-case",
  level: "warn",
  description: "Headings in sentence case",
  run: ({ doc, config }) => {
    const out = [];
    for (const s of doc.sections) {
      let title = s.title;
      for (const a of [...config.headingAllowlist].sort((x, y) => y.length - x.length)) title = title.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "gu"), "$1 ");
      const words = title.split(/\s+/).filter(Boolean);
      const bad = words.slice(1).filter((w) => /^[A-Z][a-z]+$/.test(w));
      if (bad.length) out.push({ message: `Heading "${s.title}" is not sentence case (${bad.join(", ")}).`, line: s.startLine, repair: "Lower-case every word after the first unless it is a name. Add names to headingAllowlist." });
    }
    return out;
  },
};

export const noEmojiDecoration: Rule = {
  id: "prose/no-emoji-decoration",
  level: "warn",
  description: "No emoji at the start of headings or bullets outside the hero",
  run: ({ doc }) => {
    const out = [];
    for (const s of doc.sections) {
      if (EMOJI_RE.test(s.title)) out.push({ message: `Heading "${s.title}" starts with an emoji.`, line: s.startLine, repair: "Drop it. Emoji belong in the title only." });
      for (const n of s.nodes) {
        if (n.type !== "list") continue;
        for (const item of n.children) {
          const text = toString(item);
          if (EMOJI_RE.test(text)) out.push({ message: "Bullet starts with an emoji.", line: item.position?.start.line, repair: "Drop it. Let the words carry it." });
        }
      }
    }
    return out;
  },
};

export const paragraphLength: Rule = {
  id: "prose/paragraph-length",
  level: "warn",
  description: "Paragraph sentence count under the limit",
  run: ({ doc, config }) => {
    const out = [];
    for (const s of doc.sections) {
      for (const p of paragraphs(s.nodes)) {
        const n = sentences(toString(p)).length;
        if (n > config.maxParagraphSentences) out.push({ message: `Paragraph has ${n} sentences, limit ${config.maxParagraphSentences}.`, line: p.position?.start.line, repair: "Split it, or turn it into a list." });
      }
    }
    return out;
  },
};

export const inlineCode: Rule = {
  id: "prose/inline-code",
  level: "warn",
  description: "No inline code inside a sentence",
  run: ({ doc }) => {
    const out = [];
    for (const s of doc.sections) {
      for (const p of paragraphs(s.nodes)) {
        const codes = p.children.filter((c) => c.type === "inlineCode");
        if (codes.length === 0) continue;
        const prose = p.children.filter((c) => c.type !== "inlineCode").map((c) => toString(c)).join(" ");
        const words = prose.split(/\s+/).filter((w) => /\w/.test(w)).length;
        if (words >= 4) out.push({ message: "Inline code inside a sentence.", line: p.position?.start.line, repair: "Move the path or flag into a fence, a link or a table." });
      }
    }
    return out;
  },
};

export const disclaimers: Rule = {
  id: "prose/disclaimers",
  level: "warn",
  description: "No disclaimer phrases",
  run: ({ doc, config }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      const hit = config.disclaimers.find((d) => line.toLowerCase().includes(d.toLowerCase()));
      if (hit) out.push({ message: `Disclaimer phrase "${hit}".`, line: i + 1, repair: "Cut the sentence. Let the artifact speak." });
    }
    return out;
  },
};

export const PROSE_RULES: Rule[] = [noDashes, metaNarration, sentenceCase, noEmojiDecoration, paragraphLength, inlineCode, disclaimers];
