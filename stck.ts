#!bun

import { existsSync, statSync, writeFileSync } from "fs";
import { Compiler, TypeChecker } from "./src/compiler";
import { Lexer, Preprocessor } from "./src/lexer";
import { codegenFasm } from "./src/codegen/fasm";
import { StckError } from "./src/errors";
import { Parser } from "./src/parser";
import { File } from "./src/shared";
import minimist from "minimist";
import { tmpdir } from "os";
import chalk from "chalk";
import plib from "path";

// TODO: I'm thinking about removing the bytecode target
const TARGET_OPTIONS = ["bytecode", "fasm"] as const;

function panic(...data: any[]): never {
  console.error(...data);
  process.exit(1);
}

function printHelp(): never {
  console.error(chalk.bold("stck v0.0.2"));
  console.error(chalk.red("usage:"));
  console.error(" ", chalk.bold("stck run"), chalk.yellow.bold("<file>"));
  console.error("   ", "Run a program");
  console.error(" ", chalk.bold("stck build"), chalk.yellow.bold("<file>"), chalk.yellow.dim("[output]"));
  console.error("   ", "Build a program");
  console.error(" ", chalk.bold("stck check"), chalk.yellow.bold("<file>"));
  console.error("   ", "Typecheck a program without running or compiling it");
  console.error();
  console.error(chalk.gray("options:"));
  console.error(" ", chalk.bold("--target, -t"), chalk.yellow.bold("<target>"));
  console.error("   ", "Change the compilation target");
  console.error("   ", "Available targets:", chalk.bold(TARGET_OPTIONS.join(", ")));
  console.error();
  process.exit(1);
}

function cmd(command: string[]) {
  const cmd = Bun.spawnSync({ cmd: command });

  if (cmd.exitCode != 0) {
    console.error(chalk.bold.white("[CMD]"), command.join(" "));
    console.error(chalk.red.bold("[ERROR]"), chalk.bold("Command failed"));

    const lines = cmd.stderr.toString().trim().split("\n");
    for (const line of lines) {
      console.error(chalk.red("[ERROR]"), line);
    }

    process.exit(1);
  }
}

function exec(path: string, outPath: string, target: string, action: string) {
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

    // TODO: Make `codegenFasm` a generator and use bun's API to append to a file
    writeFileSync(path + ".asm", codegenFasm(ir).join("\n"));
    cmd(["fasm", path + ".asm"]);

    if (action == "run") {
      Bun.spawn({
        cmd: [path], stdio: ["inherit", "inherit", "inherit"],
        onExit(_, code, signal) {
          if (typeof signal == "string") {
            console.error(`\n${chalk.redBright.bold(signal)}`);
            process.exit(code ?? 1);
          } else {
            process.exit(code ?? 0);
          }
        },
      });
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