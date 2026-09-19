import { parseArgs } from "node:util";
import { runContext } from "./commands/context.js";
import { runRules } from "./commands/rules.js";
import { runCheck } from "./commands/check.js";
import { runInitWorkflow } from "./commands/init-workflow.js";

const HELP = `readmerlin <command> [options]

Commands
  context [dir]           What the repo offers: skills, commands, agents, manifests, hosts, README
  rules                   Print the writing rules
  check [file...]         Check one or more files, README.md by default. Exit 1 on any fail
  init-workflow [dir]     Add .github/workflows/readme-check.yml. With --clones, also the clonometer workflow

Options
  --format <fmt>          context: json | md (default json). check: text | github | json (default text)
  --config <file>         check: path to readmerlin.json (default: readmerlin.json at the repo root)
  --pages                 check: README.md, CONTRIBUTING and every docs page, in place of the given files
  --no-links              check: skip external link checks
  --no-exec               check: never run count-source commands from readmerlin.json
  --clones                init-workflow: also add the clonometer workflow and print its badges
  --version, -v           Print the version
  --help, -h              This text`;

function parse() {
  return parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    format: { type: "string" },
    config: { type: "string" },
    pages: { type: "boolean", default: false },
    "no-links": { type: "boolean", default: false },
    "no-exec": { type: "boolean", default: false },
    clones: { type: "boolean", default: false },
    version: { type: "boolean", short: "v", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  });
}

let parsed: ReturnType<typeof parse>;
try {
  parsed = parse();
} catch (err) {
  console.error(`${err instanceof Error ? err.message : String(err)}\n\n${HELP}`);
  process.exitCode = 2;
  parsed = { values: { help: true }, positionals: ["help"] } as never;
}
const { values, positionals } = parsed;
const [command, target, ...rest] = positionals;

const FORMATS = { context: ["json", "md"], check: ["text", "github", "json"] } as const;
function pickFormat<T extends string>(allowed: readonly T[], given: unknown, fallback: T): T {
  if (given === undefined) return fallback;
  if ((allowed as readonly string[]).includes(String(given))) return given as T;
  throw new Error(`Unknown --format ${String(given)}. Use one of: ${allowed.join(", ")}.`);
}

async function main(): Promise<number> {
  if (values.version) {
    console.log(__VERSION__);
    return 0;
  }
  if (values.help || !command) {
    if (process.exitCode === 2) return 2;
    console.log(HELP);
    return values.help ? 0 : 2;
  }
  switch (command) {
    case "context":
      return runContext(target ?? process.cwd(), pickFormat(FORMATS.context, values.format, "json"));
    case "rules":
      return runRules();
    case "check":
      return runCheck(target ? [target, ...rest] : ["README.md"], {
        format: pickFormat(FORMATS.check, values.format, "text"),
        configPath: values.config,
        links: !values["no-links"],
        exec: !values["no-exec"],
        pages: values.pages,
      });
    case "init-workflow":
      return runInitWorkflow(target ?? process.cwd(), { clones: values.clones });
    default:
      console.error(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

// A reader that stops early, such as head, closes the pipe. That is not an error of ours.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw err;
});

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
