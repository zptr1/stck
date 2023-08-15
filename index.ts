import { printProgramAst } from "./src/util/prettyprint";
import { File } from "./src/shared/location";
import { Parser } from "./src/parser";
import { Lexer } from "./src/lexer";
import chalk from "chalk";
import plib from "path";

async function run(file: File) {
  console.log("[INFO] Running", chalk.gray(plib.resolve(file.path)));
  console.log("[INFO] Tokenizing");

  const lexer = new Lexer(file);
  const tokens = lexer.collect();

  console.log("[INFO] Parsing");
  const parser = new Parser(tokens);
  const ast = parser.parse();

  // todo: compilation and execution

  printProgramAst(ast);
}

run(File.read("test.stck"));