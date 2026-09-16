import { parseArgs } from "node:util";
import { runContext } from "./commands/context.js";
import { runRules } from "./commands/rules.js";
import { runCheck } from "./commands/check.js";
import { runInitWorkflow } from "./commands/init-workflow.js";
import { runWrite } from "./commands/write.js";

const HELP = `readmerlin <command> [options]

Commands
  context [dir]          What the repo offers: skills, commands, agents, manifests, hosts, README
  rules                  Print the writing rules
  check [README.md]      Check a README. Exit 1 on any fail
  write [dir]            Write README.md from the repo, using a model already on the machine
  init-workflow [dir]    Add .github/workflows/readme-check.yml

Options
  --format <fmt>         context: json | md (default json). check: text | github | json (default text)
  --config <file>        check: path to readmerlin.json (default ./readmerlin.json)
  --no-links             check: skip external link checks
  --backend <name>       write: auto | claude | anthropic | github | codex | gemini | prompt
  --model <id>           write: model id for the chosen backend
  --out <file>           write: output path (default README.md)
  --rounds <n>           write: repair rounds against check (default 3)
  --instructions <text>  write: extra guidance for the model
  --dry-run              write: print the README instead of saving it
  --version, -v          Print the version
  --help, -h             This text`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    format: { type: "string" },
    config: { type: "string" },
    "no-links": { type: "boolean", default: false },
    backend: { type: "string" },
    model: { type: "string" },
    out: { type: "string" },
    rounds: { type: "string" },
    instructions: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    version: { type: "boolean", short: "v", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, target] = positionals;

async function main(): Promise<number> {
  if (values.version) {
    console.log(__VERSION__);
    return 0;
  }
  if (values.help || !command) {
    console.log(HELP);
    return command ? 0 : 1;
  }
  switch (command) {
    case "context":
      return runContext(target ?? process.cwd(), (values.format as "json" | "md" | undefined) ?? "json");
    case "rules":
      return runRules();
    case "check":
      return runCheck(target ?? "README.md", {
        format: (values.format as "text" | "github" | "json" | undefined) ?? "text",
        configPath: values.config,
        links: !values["no-links"],
      });
    case "write":
      return runWrite(target ?? process.cwd(), {
        backend: values.backend,
        model: values.model,
        out: values.out,
        rounds: values.rounds ? Number(values.rounds) : undefined,
        instructions: values.instructions,
        dryRun: values["dry-run"],
      });
    case "init-workflow":
      return runInitWorkflow(target ?? process.cwd());
    default:
      console.error(`Unknown command: ${command}\n\n${HELP}`);
      return 1;
  }
}

main().then(
  (code) => {
    // Set the code and let stdout drain. process.exit() truncates piped output past 64 KB.
    process.exitCode = code;
  },
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
  },
);
