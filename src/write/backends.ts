import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

export type BackendName = "claude" | "anthropic" | "github" | "codex" | "gemini" | "prompt";

export interface Backend {
  name: BackendName;
  complete: (prompt: string) => Promise<string>;
}

function onPath(bin: string): boolean {
  const exts = process.platform === "win32" ? [".cmd", ".exe", ""] : [""];
  return (process.env.PATH ?? "").split(delimiter).some((dir) => exts.some((e) => existsSync(join(dir, bin + e))));
}

function run(cmd: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolvePromise(out) : reject(new Error(`${cmd} exited ${code}: ${(err.trim() || out.trim()).slice(0, 500)}`))));
    child.stdin.end(stdin);
  });
}

export const claudeCli: Backend = {
  name: "claude",
  // No tools, no hooks, no project settings: the model only sees the prompt, never the target repo.
  complete: (prompt) => run("claude", ["-p", "--output-format", "text", "--tools", "", "--bare", "--setting-sources", "user", "--no-session-persistence"], prompt),
};

export function anthropicSdk(model = "claude-opus-5"): Backend {
  return {
    name: "anthropic",
    complete: async (prompt) => {
      let Anthropic: typeof import("@anthropic-ai/sdk").default;
      try {
        Anthropic = (await import("@anthropic-ai/sdk")).default;
      } catch {
        throw new Error("The anthropic backend needs @anthropic-ai/sdk. Install it next to readmerlin, or use --backend claude with the Claude Code CLI.");
      }
      const client = new Anthropic();
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [{ role: "user", content: prompt }],
      } as never);
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new Error("The model declined the request.");
      return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    },
  };
}

export function githubModels(model = "openai/gpt-4.1"): Backend {
  return {
    name: "github",
    complete: async (prompt) => {
      const token = process.env.GITHUB_TOKEN;
      if (!token) throw new Error("The github backend needs GITHUB_TOKEN. In a workflow, pass env GITHUB_TOKEN: ${{ github.token }} and grant permissions: models: read.");
      const res = await fetch("https://models.github.ai/inference/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/vnd.github+json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 8000 }),
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw new Error(`GitHub Models answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return j.choices?.[0]?.message?.content ?? "";
    },
  };
}

export const codexCli: Backend = {
  name: "codex",
  complete: (prompt) => run("codex", ["exec", "--skip-git-repo-check", "-"], prompt),
};

export const geminiCli: Backend = {
  name: "gemini",
  complete: (prompt) => run("gemini", ["-p", "Follow the instructions in the input exactly."], prompt),
};

export const promptOnly: Backend = {
  name: "prompt",
  complete: async (prompt) => {
    process.stdout.write(prompt + "\n");
    return "";
  },
};

export function pickBackend(preferred: BackendName | "auto", model?: string): Backend {
  if (preferred !== "auto") {
    switch (preferred) {
      case "claude": return claudeCli;
      case "anthropic": return anthropicSdk(model);
      case "github": return githubModels(model);
      case "codex": return codexCli;
      case "gemini": return geminiCli;
      case "prompt": return promptOnly;
    }
  }
  if (onPath("claude")) return claudeCli;
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return anthropicSdk(model);
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_TOKEN) return githubModels(model);
  if (onPath("codex")) return codexCli;
  if (onPath("gemini")) return geminiCli;
  return promptOnly;
}
