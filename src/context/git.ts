import { execFileSync } from "node:child_process";

export function remoteOf(dir: string): { remote?: string; host?: string; owner?: string; name?: string } {
  let remote: string | undefined;
  try {
    remote = execFileSync("git", ["-C", dir, "config", "--get", "remote.origin.url"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return {};
  }
  if (!remote) return {};
  // A credential in the URL never leaves this function.
  remote = remote.replace(/\/\/[^@/]+@/, "//");
  // ssh://host:port/owner/name, git@host:owner/name, https://host/group/sub/name; the last two segments are owner and name.
  const m = /(?:@|:\/\/)([^/:]+)(?::\d+)?[/:](.+?)\/([^/]+?)(?:\.git)?\/?$/.exec(remote);
  if (!m) return { remote };
  return { remote, host: m[1], owner: m[2], name: m[3] };
}
