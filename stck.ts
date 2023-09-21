#!bun

import { Compiler, TypeChecker, codegenFasm } from "./src/compiler";
import { existsSync, statSync, writeFileSync } from "fs";
import { Parser, Preprocessor } from "./src/parser";
import { tmpdir, platform } from "os";
import { Lexer } from "./src/lexer";
import { File } from "./src/shared";
import minimist from "minimist";
import chalk from "chalk";
import plib from "path";

const ERROR = chalk.red.bold("[ERROR]");
const INFO  = chalk.bold.green("[INFO]");
const WARN  = chalk.yellow.bold("[WARN]");
const CMD   = chalk.bold.white("[CMD]");

let verbose = false;
function trace(...msg: any[]) {
  if (verbose) {
    console.log(...msg);
  }
}

const TARGET_OPTIONS = ["bytecode", "fasm"];

function panic(...data: any[]): never {
  console.error(...data);
  process.exit(1);
}

function printHelp(): never {
  console.log(chalk.bold("stck v0.0.2"));
  console.log(chalk.red("usage:"));
  console.log(" ", chalk.bold("stck run"), chalk.yellow.bold("<file>"));
  console.log("   ", "Run a program");
  console.log(" ", chalk.bold("stck build"), chalk.yellow.bold("<file>"), chalk.yellow.dim("[output]"));
  console.log("   ", "Build a program");
  console.log(" ", chalk.bold("stck check"), chalk.yellow.bold("<file>"));
  console.log("   ", "Typecheck a program without running or compiling it");
  console.log();
  console.log(chalk.gray("options:"));
  console.log(" ", chalk.bold("--target, -t"), chalk.yellow.bold("<target>"));
  console.log("   ", "Change the compilation target");
  console.log("   ", "Available targets:", chalk.bold(TARGET_OPTIONS.join(", ")));
  console.log(" ", chalk.bold("--verbose, -v"));
  console.log("   ", "More verbose logs");
  console.log();
  process.exit(1);
}

function cmd(command: string[]) {
  trace(CMD, command.join(" "));
  const cmd = Bun.spawnSync({ cmd: command });

  if (cmd.exitCode != 0) {
    console.error(ERROR, chalk.bold("Command failed"));

    const lines = cmd.stderr.toString().trim().split("\n");
    for (const line of lines) {
      console.error(chalk.red("[ERROR]"), line);
    }

    process.exit(1);
  }
}

function main() {
  const args = minimist(process.argv.slice(2));

  const action = args._[0] as ("run" | "build" | "check");
  if (action != "run" && action != "build" && action != "check")
    printHelp();

  const path = args._[1];
  if (!path) printHelp();
  else if (!existsSync(path) || !statSync(path).isFile())
    panic("File not found:", path);

  // TODO: Providing a custom file extension will still append .stbin or .asm
  const outPath = args._[2] || path.replace(/(\.stck)?$/, "");
  if (!outPath) printHelp();
  else if (!existsSync(plib.dirname(outPath)))
    panic("Directory not found:", outPath);

  const target = args.target || args.t || "fasm";
  if (!TARGET_OPTIONS.includes(target))
    panic("Available targets:", TARGET_OPTIONS.join(", "));

  verbose = args.verbose || args.v || verbose;

  const file = File.read(plib.resolve(path));
  trace(INFO, "Parsing");

  const tokens = new Lexer(file).collect();
  const preprocessed = new Preprocessor(tokens).preprocess();
  const program = new Parser(preprocessed).parse();

  trace(INFO, "Typechecking");
  new TypeChecker(program).typecheck();

  if (!program.procs.has("main")) {
    trace(ERROR, "No main procedure");
    return;
  } else if (program.procs.get("main")?.unsafe) {
    trace(WARN, "Unsafe main procedure");
  }

  if (action == "check") {
    trace(INFO, "Typechecking successful");
    return;
  }

  trace(INFO, "Compiling");
  const prog = new Compiler(program).compile();

  if (target == "bytecode") {
    panic("Bytecode has been temporarily removed, sorry! Will be added back soon");
  } else if (target == "fasm") {
    if (platform() != "linux") trace(WARN, `This platform (${platform()}) might not be supported`);

    const out = codegenFasm(prog);

    if (action == "build") {
      writeFileSync(outPath + ".asm", out.join("\n"));
      cmd(["fasm", outPath + ".asm"]);

      trace(INFO, "Compiled to", chalk.bold(plib.resolve(outPath)));
    } else if (action == "run") {
      const path = plib.join(tmpdir(), "stck-temp");

      writeFileSync(path + ".asm", out.join("\n"));
      cmd(["fasm", "-m", "524288", path + ".asm"]);

      trace(INFO, "Running");

      Bun.spawn({
        stdio: ["inherit", "inherit", "inherit"],
        cmd: [path],
        onExit(_, code, sig) {
          if (typeof sig == "string") {
            console.error(ERROR, "Process exited with", chalk.bold(sig));
            process.exit(code ?? 1);
          } else {
            process.exit(code || 0);
          }
        }
      });
    }
  } else {
    throw new Error("unreachable");
  }
}

main();