#!bun

import { BytecodeCompiler, FasmCompiler, TypeChecker, decodeBytecode, encodeBytecode, isBytecode } from "./src/compiler";
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "fs";
import { Parser, Preprocessor } from "./src/parser";
import { Lexer } from "./src/lexer";
import { File } from "./src/shared";
import { VM } from "./src/vm";
import minimist from "minimist";
import chalk from "chalk";
import plib from "path";
import { tmpdir } from "os";

const INFO = chalk.bold.green("[INFO]");
const CMD  = chalk.bold.white("[CMD]");

function trace(...msg: any[]) {
  process.stdout.moveCursor(0, -1);
  process.stdout.cursorTo(0);
  process.stdout.clearLine(0);
  console.log(...msg);
}

const TARGET_OPTIONS = ["bytecode", "fasm"];

function panic(...data: any[]): never {
  console.error(...data);
  process.exit(1);
}

function printHelp(): never {
  console.log(chalk.bold("stck v0.0.2"));
  console.log(chalk.red("usage:"));
  console.log("", chalk.bold("stck run"), chalk.yellow.bold("<file>"));
  console.log(" ", "Run a program");
  console.log("", chalk.bold("stck build"), chalk.yellow.bold("<file>"), chalk.yellow.dim("[output]"));
  console.log(" ", "Build a program");
  console.log();
  console.log(chalk.gray("options:"));
  console.log("", chalk.bold("--target, -t"), chalk.yellow.bold("<target>"));
  console.log(" ", "Change the compilation target");
  console.log(" ", "Available targets:", chalk.bold(TARGET_OPTIONS.join(", ")));
  console.log("", chalk.bold("--unsafe"));
  console.log(" ", "Disable typechecking");
  console.log();
  process.exit(1);
}

function cmd(command: string[]) {
  trace(CMD, command.join(" "));
  const cmd = Bun.spawnSync({ cmd: command });

  if (cmd.exitCode != 0) {
    console.error(chalk.red.bold("[ERROR]"), chalk.bold("Command failed"));

    const lines = cmd.stderr.toString().trim().split("\n");
    for (const line of lines) {
      console.error(chalk.red("[ERROR]"), line);
    }

    process.exit(1);
  }
}

function main() {
  const args = minimist(process.argv.slice(2));

  const action = args._[0] as ("build" | "run");
  if (action != "build" && action != "run")
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

  const source = readFileSync(path);

  // `trace` moves the cursor to one line above, so an empty line should be printed before it
  console.log();

  if (action == "run" && isBytecode(source)) {
    trace(INFO, "Running");
    new VM(decodeBytecode(source));
    return;
  }

  const file = new File(
    plib.resolve(path),
    source.toString("utf-8")
  );

  trace(INFO, "Parsing");

  const tokens = new Lexer(file).collect();
  const preprocessed = new Preprocessor(tokens).preprocess();
  const program = new Parser(preprocessed).parse();

  if (args.unsafe) {
    trace(chalk.yellow.bold("[WARN]"), "Skipping typechecking\n");
  } else {
    trace(INFO, "Typechecking");
    new TypeChecker(program).typecheck();
  }

  trace(INFO, "Compiling");
  if (target == "bytecode") {
    const out = new BytecodeCompiler(program).compile();

    if (action == "build") {
      writeFileSync(outPath + ".stbin", encodeBytecode(out));
      trace(INFO, "Compiled to", chalk.bold(outPath + ".stbin"));
    } else {
      trace(INFO, "Running");
      new VM(out);
    }
  } else if (target == "fasm") {
    const out = new FasmCompiler(program).compile();

    if (action == "build") {
      writeFileSync(outPath + ".asm", out.join("\n"));
      cmd(["fasm", outPath + ".asm"]);

      trace(INFO, "Compiled to", chalk.bold(plib.resolve(outPath)));
    } else if (action == "run") {
      const path = plib.join(tmpdir(), "stck-temp");

      writeFileSync(path + ".asm", out.join("\n"));
      cmd(["fasm", path + ".asm"]);

      trace(INFO, "Running");

      Bun.spawnSync({
        stdio: ["inherit", "inherit", "inherit"],
        cmd: [path],
        onExit(_, code, sig) {
          if (typeof sig == "string" && sig == "SIGSEGV") {
            console.error("Segmentation fault");
            process.exit(1);
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