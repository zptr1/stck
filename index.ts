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
  console.log(chalk.gray(`[INFO] Running ${file.path}`));
  console.log(chalk.gray("[DEBUG] Parsing"));

  const lexer = new Lexer(file);
  const tokens = lexer.collect();
  const ast = new Parser(tokens).parse();
  const preprocessor = new Preprocessor(ast);
  const ir = preprocessor.parse();

  console.log(chalk.gray("[DEBUG] Typechecking"));
  preprocessor.typechecker.typecheckProgram(ir);

  console.log(chalk.gray("[DEBUG] Compiling"));
  const bytecode = new Compiler(ir).compile();

  // console.debug("[DEBUG] Compiled bytecode:");
  // printByteCode(bytecode);

  console.log(chalk.gray("[DEBUG] Running"));

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
