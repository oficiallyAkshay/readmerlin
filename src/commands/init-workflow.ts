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
const TAG_RE = /^v\d+\.\d+\.\d+$/;

/** The tag of a repo's latest release, so a workflow's version comment names a real, verifiable tag. Falls back to the highest v* tag when the repo has no release. */
async function latestTag(repo: string, fetchFn: typeof fetch): Promise<string | undefined> {
  const opts = { headers: { accept: "application/vnd.github+json", "user-agent": "readmerlin" }, signal: AbortSignal.timeout(8000) };
  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, opts);
    if (res.ok) {
      const tag = ((await res.json()) as { tag_name?: unknown }).tag_name;
      if (typeof tag === "string" && TAG_RE.test(tag)) return tag;
    }
  } catch {
    /* the tag list below is the second try */
  }
  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/tags`, opts);
    if (!res.ok) return undefined;
    const tags = (await res.json()) as Array<{ name?: unknown }>;
    const versions = tags.map((t) => t.name).filter((n): n is string => typeof n === "string" && TAG_RE.test(n));
    return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  } catch {
    return undefined;
  }
}

/** The commit a tag points at, dereferencing an annotated tag to its commit, so a workflow pins a sha and never a moving ref. Asks the API first, then git's own ref listing, which needs no credential and has no hourly limit. */
async function tagSha(repo: string, tag: string, fetchFn: typeof fetch): Promise<string | undefined> {
  const opts = { headers: { accept: "application/vnd.github.sha", "user-agent": "readmerlin" }, signal: AbortSignal.timeout(8000) };
  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/commits/${tag}`, opts);
    const sha = res.ok ? (await res.text()).trim() : "";
    if (/^[0-9a-f]{40}$/.test(sha)) return sha;
  } catch {
    /* the ref listing below is the second try */
  }
  try {
    const res = await fetchFn(`https://github.com/${repo}.git/info/refs?service=git-upload-pack`, opts);
    const text = res.ok ? await res.text() : "";
    // An annotated tag advertises both its own object and a peeled `^{}` line for the commit it wraps;
    // a lightweight tag only ever has the direct line, which already names a commit.
    const peeled = new RegExp(`([0-9a-f]{40}) refs/tags/${tag}\\^\\{\\}`).exec(text)?.[1];
    return peeled ?? new RegExp(`([0-9a-f]{40}) refs/tags/${tag}\\b`).exec(text)?.[1];
  } catch {
    return undefined;
  }
}

/** The tag and commit of a repo's latest release, or undefined when either could not be resolved. */
async function latestRelease(repo: string, fetchFn: typeof fetch): Promise<{ tag: string; sha: string } | undefined> {
  const tag = await latestTag(repo, fetchFn);
  if (!tag) return undefined;
  const sha = await tagSha(repo, tag, fetchFn);
  return sha ? { tag, sha } : undefined;
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
    const release = await latestRelease(repo, fetchFn);
    const filled = release ? template.replace("<sha>", release.sha).replace("<comment>", release.tag) : template.replace("<comment>", "vX.Y.Z, replace before pushing");
    put(dir, file, filled);
    if (!release) console.log(`GitHub could not be reached. Replace <sha> and the version comment in ${file} with a real release tag of ${repo} before you push.`);
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
