#!bun

import { File, Parser, Compiler, TypeChecker, Lexer, Preprocessor, StckError, codegenFasm } from "./src";
import { existsSync, statSync, unlinkSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import minimist from "minimist";
import * as shlex from "shlex";
import { tmpdir } from "os";
import chalk from "chalk";
import plib from "path";

let verbose = false;
function printHelp(): never {
  console.log(chalk.bold("stck"));
  console.log(chalk.red("usage:"));
  console.log(" ", chalk.bold("stck run"), chalk.yellow.bold("<file>"),);
  console.log("   ", "Run a program");
  console.log(" ", chalk.bold("stck build"), chalk.yellow.bold("<file>"), chalk.yellow.dim("[output]"));
  console.log("   ", "Build a program");
  console.log(" ", chalk.bold("stck check"), chalk.yellow.bold("<file>"));
  console.log("   ", "Typecheck a program without running or compiling it");
  console.log();
  console.log(chalk.gray("options:"));
  console.log(" ", chalk.bold("--output, -o"));
  console.log("   ", "Output file");
  console.log(" ", chalk.bold("--keep, -k"));
  console.log("   ", "Keep the .asm and .o files");
  console.log(" ", chalk.bold("--verbose, -v"));
  console.log("   ", "Print information about the process");
  console.log();
  process.exit(1);
}

function cmd(command: string[]) {
  const start = performance.now();
  const cmd = Bun.spawnSync({ cmd: command });
  const took = performance.now() - start;

  if (cmd.exitCode != 0) {
    console.error(chalk.red.bold("[CMD]"), command.join(" "));
    console.error(chalk.red.bold("[ERROR]"), chalk.bold("Command failed"));

    const lines = cmd.stderr.toString().trim().split("\n");
    for (const line of lines) {
      console.error(chalk.red("[ERROR]"), line);
    }

    process.exit(1);
  } else if (verbose) {
    console.log(chalk.bold("[CMD]"), command.join(" "), chalk.green(took.toFixed(2), "ms"));
  }
}

let lastStepAt = 0;
let lastStep: string;

function step(name?: string) {
  if (!verbose) return;

  if (lastStep) {
    const took = performance.now() - lastStepAt;
    console.log(chalk.bold("[DEBUG]"), lastStep.padEnd(10, " "), chalk.green(took.toFixed(2), "ms"));
  }

  if (name) {
    lastStepAt = performance.now();
    lastStep = name;
  }
}

async function exec(src: string, outPath: string, args: string[], action: string, keep: boolean) {
  // FIXME: it appears that the lexing is always the slowest step (besides linking)
  // maybe rewrite it? its not that much work anyway and rewriting is probably gonna
  // be easier than changing the existing lexer
  // a few ideas: 
  // - turn the lexer into just a few functions instead of a class?
  // - do preprocessing in the same step as tokenization

  step("tokenize");
  const tokens = new Preprocessor(new Lexer(File.read(src)).lex()).preprocess();
  
  step("parse");
  const ast = new Parser(tokens).parse();
  
  step("typecheck");
  new TypeChecker(ast).typecheck();
  
  step("compile");
  const ir = new Compiler(ast).compile();

  if (action == "check") {
    step();
    return;
  }

  const path = action == "run"
    ? plib.join(tmpdir(), `stck-${randomBytes(4).toString("base64url")}`)
    : outPath;

  step("codegen");
  writeFileSync(path + ".asm", codegenFasm(ir).join("\n"));
  step();
  
  cmd(["fasm", path + ".asm"]);
  cmd([
    "gcc", path + ".o", "-o", path,
    "-fno-PIE", "-no-pie",
    ...shlex.split(process.env.LDFLAGS || ""),
    ...ir.libraries.map((x) => ["-l", x]).flat()
  ]);

  if (action == "run" || !keep) {
    unlinkSync(path + ".asm");
    unlinkSync(path + ".o");
  }

  if (action == "run") {
    // Should work, hopefully
    process.on("SIGINT", () => {});

    Bun.spawn({
      cmd: [path, ...args],
      stdio: ["inherit", "inherit", "inherit"],
      onExit(_, code, signal) {
        if (verbose) {
          console.log();
          console.log(
            chalk.bold(
              "Exited with code",
              code ? chalk.red(code) : chalk.green(code)
            )
          )
        }

        unlinkSync(path);
        if (typeof signal == "string") {
          console.error(`\n${chalk.redBright.bold(signal)}`);
          process.exit(code ?? 1);
        } else {
          process.exit(code ?? 0);
        }
      },
    });
  }
}

async function main() {
  if (!Bun.which("fasm") || !Bun.which("gcc")) {
    console.error(`The stck compiler requires ${chalk.bold("fasm")} and ${chalk.bold("gcc")} in order to work.`);
    console.error("Make sure you have both installed and they are available in PATH");
    process.exit(1);
  }

  const args = minimist(
    process.argv.slice(2),
    {
      alias: { keep: "k", verbose: "v", output: "o" },
      boolean: ["keep", "verbose"]
    }
  );

  verbose = args.verbose;

  const action = args._[0];
  if (!["run", "build", "check"].includes(action))
    printHelp();

  const path = args._[1];
  if (!path) printHelp();
  else if (!existsSync(path) || !statSync(path).isFile()) {
    console.error("File not found:", path);
    process.exit(1);
  }

  // FIXME: Providing a custom file extension appends .asm instead of replacing it
  const outPath = args.output || path.replace(/(\.stck)?$/, "");
  if (!outPath) printHelp();
  else if (!existsSync(plib.dirname(outPath))) {
    console.error("Directory not found:", outPath);
    process.exit(1);
  }

  try {
    await exec(plib.resolve(path), plib.resolve(outPath), args._.slice(2), action, args.keep);
  } catch (err) {
    if (err instanceof StckError) {
      console.error();
      console.error(err.format());
      console.error();
      process.exit(1);
    } else {
      throw err;
    }
  }
}

main();