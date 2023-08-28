#!bun

import { printByteCode, printProgramAst, printProgramIR, printTokens } from "./src/util/prettyprint";
import { MAGIC, decodeBytecode, encodeBytecode } from "./src/encoder";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { ByteCode } from "./src/shared/instruction";
import { Preprocessor } from "./src/preprocessor";
import { File } from "./src/shared/location";
import { Compiler } from "./src/compiler";
import { Parser } from "./src/parser";
import { Lexer } from "./src/lexer";
import { VM } from "./src/vm";
import chalk from "chalk";
import plib from "path";

function compile(file: File): ByteCode {
  const tokens = new Lexer(file).collect();
  const ast = new Parser(tokens).parse();
  const preprocessor = new Preprocessor(ast);
  const ir = preprocessor.parse();

  preprocessor.typechecker.typecheckProgram(ir);

  return new Compiler(ir).compile();
}

function printHelp() {
  console.log(chalk.bold.blue("stck v0.0.1"));
  console.log();
  console.log(" ", chalk.bold("<file>"));
  console.log(" ", chalk.gray("Run a program"));
  console.log();
  console.log(" ", chalk.bold("build <file>"));
  console.log(" ", chalk.gray("Compile a program to binary"));
  console.log();
  console.log(" ", chalk.bold("debug <file> (tokens|ast|ir|bytecode)"));
  console.log(" ", chalk.gray("Debug utility"));
  console.log();
  process.exit();
}

if (process.argv.length < 3) {
  printHelp();
} else if (process.argv[2] == "build") {
  if (!process.argv[3]) printHelp();
  if (!existsSync(process.argv[3])) {
    console.error(`No such file or directory: ${process.argv[3]}`);
    process.exit(1);
  }

  const bytecode = compile(File.read(plib.resolve(process.argv[3])));
  const path = process.argv[3].replace(/(\.stck)?$/, ".stbin");

  writeFileSync(path, encodeBytecode(bytecode));

  console.log("[INFO] Compiled to", chalk.bold(plib.resolve(path)));
} else if (process.argv[2] == "debug") {
  if (!process.argv[3]) printHelp();
  if (!existsSync(process.argv[3])) {
    console.error(`No such file or directory: ${process.argv[3]}`);
    process.exit(1);
  }

  const src = readFileSync(process.argv[3]);
  const file = new File(plib.resolve(process.argv[3]), src.toString("utf-8"));

  if (process.argv[4] == "tokens") {
    printTokens(new Lexer(file).collect());
  } else if (process.argv[4] == "ast") {
    const tokens = new Lexer(file).collect();
    const ast = new Parser(tokens).parse();
    printProgramAst(ast);
  } else if (process.argv[4] == "ir") {
    const tokens = new Lexer(file).collect();
    const ast = new Parser(tokens).parse();
    const preprocessor = new Preprocessor(ast)
    const ir = preprocessor.parse();

    preprocessor.typechecker.typecheckProgram(ir);
    printProgramIR(ir);
  } else if (process.argv[4] == "bytecode") {
    if (src.subarray(0, MAGIC.length).equals(MAGIC)) {
      printByteCode(decodeBytecode(src));
    } else {
      const tokens = new Lexer(file).collect();
      const ast = new Parser(tokens).parse();
      const ir = new Preprocessor(ast).parse();
      const bytecode = new Compiler(ir).compile();

      printByteCode(bytecode);
    }
  }
} else if (!existsSync(process.argv[2])) {
  console.error(`No such file or directory: ${process.argv[2]}`);
  process.exit(1);
} else {
  const path = plib.resolve(process.argv[2]);
  const src = readFileSync(path);

  if (src.subarray(0, MAGIC.length).equals(MAGIC)) {
    new VM(decodeBytecode(src));
  } else {
    new VM(compile(new File(path, src.toString("utf-8"))));
  }
}
