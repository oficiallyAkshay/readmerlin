import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { remoteOf } from "../context/git.js";

function put(dir: string, name: string, content: string): void {
  const target = join(dir, ".github", "workflows", name);
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(target, content);
  console.log(`wrote: ${target}`);
}

const READMERLIN = "oficiallyAkshay/readmerlin";
const CLONOMETER = "oficiallyAkshay/clonometer";

/** The commit a repo's main branch points at, so a workflow pins a sha and never a moving tag. Asks the API first, then git's own ref listing, which needs no credential and has no hourly limit. */
async function mainSha(repo: string, fetchFn: typeof fetch): Promise<string | undefined> {
  const opts = { headers: { accept: "application/vnd.github.sha", "user-agent": "readmerlin" }, signal: AbortSignal.timeout(8000) };
  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/commits/main`, opts);
    const sha = res.ok ? (await res.text()).trim() : "";
    if (/^[0-9a-f]{40}$/.test(sha)) return sha;
  } catch {
    /* the ref listing below is the second try */
  }
  try {
    const res = await fetchFn(`https://github.com/${repo}.git/info/refs?service=git-upload-pack`, opts);
    const sha = res.ok ? /([0-9a-f]{40}) refs\/heads\/main\b/.exec(await res.text())?.[1] : undefined;
    return sha;
  } catch {
    return undefined;
  }
}

const recipe = (slug: string, file: string, label: string) => `https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/${slug}/badges/${file}.json&query=$.badge&label=${label}&logo=github&logoColor=white`;

export async function runInitWorkflow(dir: string, opts: { clones?: boolean; fetch?: typeof fetch } = {}): Promise<number> {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  // An existing workflow is left as it is, and GitHub is asked only for one that will be written.
  const pinned = async (repo: string, file: string, template: string) => {
    if (existsSync(join(dir, ".github", "workflows", file))) {
      console.log(`exists: ${join(dir, ".github", "workflows", file)}`);
      return;
    }
    const sha = await mainSha(repo, fetchFn);
    put(dir, file, sha ? template.replace("<sha>", sha) : template);
    if (!sha) console.log(`GitHub could not be reached. Replace <sha> in ${file} with a commit of ${repo} before you push.`);
  };
  await pinned(READMERLIN, "readme-check.yml", __WORKFLOW_YML__);
  if (opts.clones) {
    await pinned(CLONOMETER, "clonometer.yml", __CLONES_YML__);
    const remote = remoteOf(dir);
    const slug = remote.owner && remote.name ? `${remote.owner}/${remote.name}` : "<owner>/<repo>";
    console.log("clonometer.yml needs a TRAFFIC_TOKEN secret: a fine-grained token scoped to this repository, with Contents write and Administration read.");
    console.log("After the first run, the badges read the numbers from the badges branch:");
    console.log(`  clones: ${recipe(slug, "clones", "clones")}`);
    console.log(`  views:  ${recipe(slug, "views", "views")}`);
  }
  return 0;
}
