#!bun

import { File, Parser, Compiler, TypeChecker, Lexer, Preprocessor, StckError, codegenFasm } from "./src";
import { existsSync, statSync, unlinkSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import minimist from "minimist";
import { tmpdir } from "os";
import chalk from "chalk";
import plib from "path";

function printHelp(): never {
  console.log(chalk.bold("stck"));
  console.log(chalk.red("usage:"));
  console.log(" ", chalk.bold("stck run"), chalk.yellow.bold("<file>"));
  console.log("   ", "Run a program");
  console.log(" ", chalk.bold("stck build"), chalk.yellow.bold("<file>"), chalk.yellow.dim("[output]"));
  console.log("   ", "Build a program");
  console.log(" ", chalk.bold("stck check"), chalk.yellow.bold("<file>"));
  console.log("   ", "Typecheck a program without running or compiling it");
  console.log();
  console.log(chalk.gray("options:"));
  console.log(" ", chalk.bold("--keep, -k"));
  console.log("   ", "Keep the .asm and .o files");
  console.log();
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

function exec(src: string, outPath: string, action: string, keep: boolean) {
  const ast = new Parser(
    new Preprocessor(
      new Lexer(File.read(src)).lex()
    ).preprocess()
  ).parse();

  new TypeChecker(ast).typecheck();
  const ir = new Compiler(ast).compile();

  if (action == "check")
    return;

  const path = action == "run"
    ? plib.join(tmpdir(), `stck-${randomBytes(4).toString("base64url")}`)
    : outPath;

  writeFileSync(path + ".asm", codegenFasm(ir).join("\n"));
  cmd(["fasm", path + ".asm"]);

  // TODO: Support LDFLAGS
  cmd(
    [
      "gcc", path + ".o", "-o", path,
      "-fno-PIE", "-no-pie",
      "-fuse-ld=mold",
      "-L", process.cwd()
    ].concat(ir.libraries.map((x) => ["-l", x]).flat())
  );

  if (!keep) {
    unlinkSync(path + ".asm");
    unlinkSync(path + ".o");
  }

  if (action == "run") {
    Bun.spawn({
      cmd: [path], stdio: ["inherit", "inherit", "inherit"],
      onExit(_, code, signal) {
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

function main() {
  const args = minimist(process.argv.slice(2));

  const action = args._[0];
  if (action != "run" && action != "build" && action != "check")
    printHelp();

  const path = args._[1];
  if (!path) printHelp();
  else if (!existsSync(path) || !statSync(path).isFile()) {
    console.error("File not found:", path);
    process.exit(1);
  }

  // TODO: Providing a custom file extension will append .asm instead of replacing it
  const outPath = args._[2] || path.replace(/(\.stck)?$/, "");
  if (!outPath) printHelp();
  else if (!existsSync(plib.dirname(outPath))) {
    console.error("Directory not found:", outPath);
    process.exit(1);
  }

  try {
    exec(plib.resolve(path), plib.resolve(outPath), action, args.keep || args.k);
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