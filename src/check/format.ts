import type { CheckResult } from "./types.js";

export function format(r: CheckResult, fmt: "text" | "github" | "json"): string {
  if (fmt === "json") return JSON.stringify(r, null, 2) + "\n";
  let out = "";
  const sorted = [...r.findings].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  for (const f of sorted) {
    if (fmt === "github") {
      const kind = f.level === "fail" ? "error" : "warning";
      out += `::${kind} file=${r.file}${f.line ? `,line=${f.line}` : ""},title=${f.id}::${f.message}${f.repair ? ` Repair: ${f.repair}` : ""}\n`;
    } else {
      out += `  ${f.line ?? "-"}\t${f.level}\t${f.message}  [${f.id}]\n`;
      if (f.repair) out += `\t\trepair: ${f.repair}\n`;
    }
  }
  out += fmt === "github" ? `::notice::readmerlin ${r.file}: ${r.fails} fails, ${r.warns} warnings, ${r.ran.length} checks\n` : `\n${r.file}: ${r.fails} fails, ${r.warns} warnings, ${r.ran.length} checks\n`;
  return out;
}
