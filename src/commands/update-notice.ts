import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const LATEST = "https://raw.githubusercontent.com/oficiallyAkshay/readmerlin/main/package.json";
const CACHE = join(tmpdir(), "readmerlin", "latest.json");
const DAY = 24 * 3600 * 1000;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function newer(latest: string, current: string): boolean {
  const parts = (v: string) => v.split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parts(latest), parts(current)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The cached answer, if it is younger than a day. An empty string means the last lookup failed and is not retried until tomorrow. */
function cached(cache: string): string | undefined {
  try {
    const c = JSON.parse(readFileSync(cache, "utf8")) as { version?: unknown; at?: unknown };
    if (typeof c.at !== "number" || Date.now() - c.at >= DAY) return undefined;
    return typeof c.version === "string" && (c.version === "" || VERSION_RE.test(c.version)) ? c.version : undefined;
  } catch {
    return undefined;
  }
}

function remember(cache: string, version: string): void {
  try {
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, JSON.stringify({ version, at: Date.now() }));
  } catch {
    /* a cache that cannot be written only costs one lookup a run */
  }
}

/** One line when the repo holds a newer version than this copy. Asks at most once a day, sends nothing, and never updates anything itself. */
export async function updateNotice(current: string, fetchFn: typeof fetch = globalThis.fetch, cache = CACHE): Promise<string | undefined> {
  let latest = cached(cache);
  if (latest === undefined) {
    latest = "";
    try {
      const res = await fetchFn(LATEST, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const v = ((await res.json()) as { version?: unknown }).version;
        // Only a version number is ever printed, so the file on the network cannot put anything else on the screen.
        if (typeof v === "string" && VERSION_RE.test(v)) latest = v;
      }
    } catch {
      /* offline or slow: remembered as a miss, so the next run does not wait again today */
    }
    remember(cache, latest);
  }
  return latest && newer(latest, current) ? `readmerlin ${latest} is out, this copy is ${current}. Update with: npx skills update readmerlin` : undefined;
}
