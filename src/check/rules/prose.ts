import { toString } from "mdast-util-to-string";
import { stabilize } from "../../text.js";
import { EMOJI_RE, maskedText, paragraphs, proseLines, sentences } from "../util.js";
import type { Rule } from "../types.js";

export const noDashes: Rule = {
  id: "prose/plain-punctuation",
  level: "fail",
  pages: true,
  description: "Sentences are joined with commas, colons and full stops",
  run: ({ doc }) => {
    const out = [];
    // Masked text has code and html comments blanked already.
    for (const [i, line] of maskedText(doc).split("\n").entries()) {
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
  id: "prose/about-the-product",
  level: "fail",
  description: "Every sentence is about the product",
  run: ({ doc }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      if (/^\s*<img|^\s*!\[|^\s*<!--/.test(line)) continue;
      // Quoted text is what the user says, not the README talking about itself.
      const noAlt = stabilize(line, /alt="[^"]*"/g, "");
      const noImg = stabilize(noAlt, /!\[[^\]]*\]/g, "");
      const noComment = stabilize(noImg, /<!--[\s\S]*?-->/g, "");
      const stripped = stabilize(noComment, /"[^"]*"/g, "");
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
  id: "prose/plain-headings",
  level: "warn",
  description: "Section headings are words only",
  run: ({ doc }) =>
    doc.sections
      .filter((s) => EMOJI_RE.test(s.title))
      .map((s) => ({ message: `Heading "${s.title}" starts with an emoji.`, line: s.startLine, repair: "Drop it. Emoji belong in the title and at the start of feature bullets." })),
};

const STOP = new Set("a an and are as at be but by for from in is it its of on or so that the this to with you your".split(" "));
const words = (t: string): string[] => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

export const taglineRepeat: Rule = {
  id: "prose/says-it-once",
  level: "warn",
  description: "The opening paragraphs add to the tagline",
  run: ({ doc }) => {
    const html = doc.hero.filter((n) => n.type === "html").map((n) => (n as { value: string }).value).join("\n");
    const bolds = [...html.matchAll(/<(b|strong)>([\s\S]*?)<\/\1>/gi)].map((m) => stabilize(m[2], /<[^>]+>/g, ""));
    for (const p of paragraphs(doc.hero)) for (const c of p.children) if (c.type === "strong") bolds.push(toString(c));
    const tagline = bolds.flatMap((b) => sentences(b)).map(words).filter((w) => w.length >= 3);
    if (tagline.length === 0) return [];
    const out = [];
    const body = [...paragraphs(doc.hero).filter((p) => !p.children.every((c) => c.type === "strong" || c.type === "image" || c.type === "link")), ...(doc.sections[0] ? paragraphs(doc.sections[0].nodes) : [])];
    for (const p of body) {
      // The bold part is the tagline itself, so only the plain part is compared.
      for (const sentence of sentences(p.children.filter((c) => c.type !== "strong").map((c) => toString(c)).join(" "))) {
        const w = new Set(words(sentence));
        const repeat = tagline.some((t) => t.filter((x) => w.has(x)).length / t.length >= 0.75);
        if (repeat) out.push({ message: "A sentence restates the tagline.", line: p.position?.start.line, repair: "Say it once. Let the body add what the tagline does not." });
      }
    }
    return out;
  },
};

export const paragraphLength: Rule = {
  id: "prose/paragraph-length",
  level: "warn",
  description: "A paragraph stays within the sentence limit",
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
  id: "prose/code-outside-sentences",
  level: "warn",
  description: "Code sits in a table, a link, or a short clause that names it on its own",
  run: ({ doc }) => {
    const out = [];
    for (const s of doc.sections) {
      for (const p of paragraphs(s.nodes)) {
        if (!p.children.some((c) => c.type === "inlineCode")) continue;
        // Flatten to one string, marking each inline code's spot, then judge the clause around each mark on its own:
        // a flag or a path named as the short clause's own subject, such as "`--no-links` turns that off", stays quiet.
        let text = "";
        for (const c of p.children) text += c.type === "inlineCode" ? "\u0000" : toString(c);
        const buried = text.split(/(?<=[.;])\s+/).some((clause) => {
          if (!clause.includes("\u0000")) return false;
          const words = clause.replace(/\u0000/g, "").split(/\s+/).filter((w) => /\w/.test(w)).length;
          return words >= 8;
        });
        if (buried) out.push({ message: "Inline code buried in a long sentence.", line: p.position?.start.line, repair: "Move the path or flag into a fence, a link or a table, or give it its own short clause." });
      }
    }
    return out;
  },
};

export const disclaimers: Rule = {
  id: "prose/unhedged",
  level: "warn",
  description: "The artifact speaks for itself, without disclaimers",
  run: ({ doc, config }) => {
    const out = [];
    for (const [i, line] of proseLines(doc)) {
      const hit = config.disclaimers.find((d) => line.toLowerCase().includes(d.toLowerCase()));
      if (hit) out.push({ message: `Disclaimer phrase "${hit}".`, line: i + 1, repair: "Cut the sentence. Let the artifact speak." });
    }
    return out;
  },
};

export const PROSE_RULES: Rule[] = [noDashes, metaNarration, sentenceCase, noEmojiDecoration, taglineRepeat, paragraphLength, inlineCode, disclaimers];
