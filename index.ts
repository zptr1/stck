import { printByteCode } from "./src/util/prettyprint";
import { Preprocessor } from "./src/preprocessor";
import { File } from "./src/shared/location";
import { Compiler } from "./src/compiler";
import { Parser } from "./src/parser";
import { Lexer } from "./src/lexer";
import { existsSync } from "fs";
import { VM } from "./src/vm";
import chalk from "chalk";
import plib from "path";

async function run(file: File) {
  console.log("[INFO] Running", chalk.gray(file.path));
  console.log("[INFO] Parsing");

  const lexer = new Lexer(file);
  const tokens = lexer.collect();
  const ast = new Parser(tokens).parse();

  console.log("[INFO] Generating IR");
  const preprocessor = new Preprocessor(ast);
  const ir = preprocessor.parse();

  console.log("[INFO] Typechecking");
  preprocessor.typechecker.typecheckProgram(ir);

  console.log("[INFO] Compiling");
  const bytecode = new Compiler(ir).compile();

  console.debug("[DEBUG] Compiled bytecode:");
  printByteCode(bytecode);

  console.log("[INFO] Running");

  new VM(bytecode);
}

if (process.argv.length < 3) {
  console.log("stck v0.0.1");
  console.error(`Usage: ... <file>`);
} else if (!existsSync(process.argv[2])) {
  console.error(`No such file or directory: ${process.argv[2]}`);
} else {
  run(File.read(plib.resolve(process.argv[2])));
}
