#!bun

import { BytecodeCompiler, decodeBytecode, encodeBytecode, isBytecode } from "./src/compiler";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { Parser, Preprocessor } from "./src/parser";
import { Lexer } from "./src/lexer";
import { File } from "./src/shared";
import { log } from "./src/util";
import { VM } from "./src/vm";
import minimist from "minimist";
import chalk from "chalk";
import plib from "path";

const TARGET_OPTIONS = ["bytecode", "fasm"];

function panic(...data: any[]): never {
  console.error(...data);
  process.exit(1);
}

function printHelp() {
  console.log(chalk.bold("stck v0.0.2"));
  console.log(chalk.red("usage:"), "stck <file>");
  console.log(chalk.gray("options:"));

  const options = [
    ["--target", "<target>", `specify the compilation target (${TARGET_OPTIONS.join("/")})`],
    ["--build",  "[output]", "build the program"],
    ["--verbose", "",        "more verbose output"]
  ];

  const namePadding = Math.max(...options.map((x) => x[0].length));
  const argsPadding = Math.max(...options.map((x) => x[1].length));

  for (const option of options) {
    console.log(
      "",
      chalk.white(
        option[0].slice(0, 2)
        + chalk.bold.whiteBright(option[0][2])
        + option[0].slice(3)
        + " ".repeat(namePadding - option[0].length)
      ),
      chalk.gray.bold(
        option[1].padEnd(argsPadding, " ")
      ),
      option[2]
    );
  }
}

function main() {
  const args = minimist(process.argv.slice(2));

  const path = args._[0];
  const target: string = args.target || args.t || "bytecode";
  const build = args.build ?? args.b ?? false;

  log.verbose = !!(args.verbose ?? args.v ?? false);

  if (!path) {
    printHelp();
    process.exit(1);
  } else if (!TARGET_OPTIONS.includes(target)) {
    panic("Available targets:", TARGET_OPTIONS.join(", "));
  } else if (!existsSync(path) || !statSync(path).isFile()) {
    panic(`Unknown file - ${path}`);
  }

  const source = readFileSync(path);
  if (isBytecode(source) && !build) {
    log.info(`Running ${plib.resolve(path)}`);
    new VM(decodeBytecode(source));
    return;
  }

  const file = new File(plib.resolve(path), source.toString("utf-8"));

  log.timeit("Parsing");

  const tokens = new Lexer(file).collect();
  const ast = new Parser(tokens).parse();
  const preprocessor = new Preprocessor(ast);
  const program = preprocessor.parse();

  log.timeit("Typechecking");
  preprocessor.typechecker.typecheckProgram(program);

  log.timeit("Compiling");

  if (target == "bytecode") {
    const bytecode = new BytecodeCompiler(program).compile();
    log.end();

    if (build) {
      const out = file.path.replace(/(\.stck)?$/, ".stckb");
      writeFileSync(out, encodeBytecode(bytecode));
      log.info(`Compiled to ${out}`);
    } else {
      log.info(`Running ${file.path}`);
      new VM(bytecode);
    }
  } else if (target == "fasm") {
    throw new Error("Not implemented");
  } else {
    throw new Error("unreachable");
  }
}

main();