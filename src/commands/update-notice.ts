import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LATEST = "https://raw.githubusercontent.com/oficiallyAkshay/readmerlin/main/package.json";
const CACHE = join(tmpdir(), "readmerlin", "latest.json");
const DAY = 24 * 3600 * 1000;

export function newer(latest: string, current: string): boolean {
  const parts = (v: string) => v.split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parts(latest), parts(current)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** One line when the repo holds a newer version than this copy. Asks at most once a day, sends nothing, and never updates anything itself. */
export async function updateNotice(current: string, fetchFn: typeof fetch = globalThis.fetch): Promise<string | undefined> {
  let latest: string | undefined;
  try {
    const c = JSON.parse(readFileSync(CACHE, "utf8")) as { version: string; at: number };
    if (Date.now() - c.at < DAY) latest = c.version;
  } catch {
    /* no cache yet */
  }
  if (!latest) {
    try {
      const res = await fetchFn(LATEST, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return undefined;
      latest = String(((await res.json()) as { version?: unknown }).version ?? "");
      mkdirSync(join(tmpdir(), "readmerlin"), { recursive: true });
      writeFileSync(CACHE, JSON.stringify({ version: latest, at: Date.now() }));
    } catch {
      return undefined;
    }
  }
  return newer(latest, current) ? `readmerlin ${latest} is out, this copy is ${current}. Update with: npx skills update readmerlin` : undefined;
}
