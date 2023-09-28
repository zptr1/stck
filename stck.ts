#!bun

import { Compiler, TypeChecker, codegenFasm } from "./src/compiler";
import { existsSync, statSync, writeFileSync } from "fs";
import { Lexer, Preprocessor } from "./src/lexer";
import { tmpdir, platform } from "os";
import { Parser } from "./src/parser";
import { File } from "./src/shared";
import minimist from "minimist";
import chalk from "chalk";
import plib from "path";
import { StckError } from "./src/errors";

const ERROR = chalk.red.bold("[ERROR]");
const INFO  = chalk.bold.green("[INFO]");
const WARN  = chalk.yellow.bold("[WARN]");

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
  console.log();
  process.exit(1);
}

function cmd(command: string[]) {
  const cmd = Bun.spawnSync({ cmd: command });

  if (cmd.exitCode != 0) {
    console.error(chalk.bold.white("[CMD]"), command.join(" "));
    console.error(ERROR, chalk.bold("Command failed"));

    const lines = cmd.stderr.toString().trim().split("\n");
    for (const line of lines) {
      console.error(chalk.red("[ERROR]"), line);
    }

    process.exit(1);
  }
}

function exec(path: string, outPath: string, target: string, action: string) {
  // OOP in a nutshell
  const ast = new Parser(
    new Preprocessor(
      new Lexer(File.read(path)).lex()
    ).preprocess()
  ).parse();

  new TypeChecker(ast).typecheck();
  const ir = new Compiler(ast).compile();

  if (target == "fasm") {
    const path = action == "run"
      ? plib.join(tmpdir(), "stck-tmp")
      : outPath;

    writeFileSync(path + ".asm", codegenFasm(ir).join("\n"));
    cmd(["fasm", path + ".asm"]);

    if (action == "run") {
      console.log(INFO, "Running");

      Bun.spawn({
        cmd: [path], stdio: ["inherit", "inherit", "inherit"],
        onExit(_, code, signal) {
          if (typeof signal == "string") {
            console.error(ERROR, "Process exited with", chalk.bold(signal));
            process.exit(code ?? 1);
          } else {
            process.exit(code ?? 0);
          }
        },
      });
    } else {
      console.log(INFO, "Compiled to", chalk.bold(path));
    }
  } else {
    throw new Error(`this target (${target}) is not implemented yet`);
  }
}

function main() {
  const args = minimist(process.argv.slice(2));

  const action = args._[0];
  if (action != "run" && action != "build" && action != "check")
    printHelp();

  const path = args._[1];
  if (!path) printHelp();
  else if (!existsSync(path) || !statSync(path).isFile())
    panic("File not found:", path);

  // TODO: Providing a custom file extension will append .asm instead of replacing it
  const outPath = args._[2] || path.replace(/(\.stck)?$/, "");
  if (!outPath) printHelp();
  else if (!existsSync(plib.dirname(outPath)))
    panic("Directory not found:", outPath);

  const target = args.target || args.t || "fasm";
  if (!TARGET_OPTIONS.includes(target))
    panic("Available targets:", TARGET_OPTIONS.join(", "));

  try {
    exec(plib.resolve(path), plib.resolve(outPath), target, action);
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