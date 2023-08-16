import { printProgramAst, printProgramIR } from "./src/util/prettyprint";
import { File } from "./src/shared/location";
import { Parser } from "./src/parser";
import { Lexer } from "./src/lexer";
import { existsSync } from "fs";
import { IR } from "./src/ir";
import chalk from "chalk";
import plib from "path";

async function run(file: File) {
  console.log("[INFO] Running", chalk.gray(file.path));
  console.log("[INFO] Tokenizing");

  const lexer = new Lexer(file);
  const tokens = lexer.collect();

  console.log("[INFO] Parsing");
  const ast = new Parser(tokens).parse();
  const ir = new IR(ast).parse();

  // todo: compilation and execution

  console.debug("[DEBUG] AST");
  printProgramAst(ast);

  console.debug("[DEBUG] IR");
  printProgramIR(ir);
}

if (process.argv.length < 3) {
  console.log("stck v0.0.1");
  console.error(`Usage: ... <file>`);
} else if (!existsSync(process.argv[2])) {
  console.error(`No such file or directory: ${process.argv[2]}`);
} else {
  run(File.read(plib.resolve(process.argv[2])));
}
