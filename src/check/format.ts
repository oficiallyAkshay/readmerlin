import type { CheckResult } from "./types.js";

// GitHub workflow commands: % and line breaks are escaped in the message, and also , and : in a property.
const escData = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (s: string) => escData(s).replace(/,/g, "%2C").replace(/:/g, "%3A");

export function format(r: CheckResult, fmt: "text" | "github" | "json"): string {
  if (fmt === "json") return JSON.stringify(r, null, 2) + "\n";
  let out = "";
  const sorted = [...r.findings].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  for (const f of sorted) {
    if (fmt === "github") {
      const kind = f.level === "fail" ? "error" : "warning";
      out += `::${kind} file=${escProp(r.file)}${f.line ? `,line=${f.line}` : ""},title=${escProp(f.id)}::${escData(f.message)}${f.repair ? ` Repair: ${escData(f.repair)}` : ""}\n`;
    } else {
      out += `  ${f.line ?? "-"}\t${f.level}\t${f.message}  [${f.id}]\n`;
      if (f.repair) out += `\t\trepair: ${f.repair}\n`;
    }
  }
  out += fmt === "github" ? `::notice::readmerlin ${r.file}: ${r.fails} fails, ${r.warns} warnings, ${r.ran.length} rules\n` : `\n${r.file}: ${r.fails} fails, ${r.warns} warnings, ${r.ran.length} rules\n`;
  return out;
}
