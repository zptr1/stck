import { IRExpr, IIR, IRProgram, IRWordKind, IRType, IAst, AstType, Expr, IProgram } from "../parser";
import { formatLoc, DataType, ByteCode, Instr } from "../shared";
import { Token } from "../lexer";
import chalk from "chalk";

// A shitty utility for debugging
// Will probably be removed

function formatStr(str: string): string {
  return chalk.yellow(JSON.stringify(str));
}

function formatObj(obj: any): string {
  return (
    typeof obj == "string"
      ? formatStr(obj)
    : typeof obj == "number" || typeof obj == "boolean"
      ? chalk.cyanBright(obj)
    : `${obj}`
  );
}

function formatAst(ast: IAst<any>): string {
  return (
    AstType[ast.type]
    + (
      "name" in ast
        ? ` ${formatStr(ast.name as string)}`
        : ""
    ) + chalk.gray.bold(` @ ${formatLoc(ast.loc)}`)
  );
}

function formatIR(hir: IIR<any>): string {
  return (
    IRType[hir.type]
    + (
      "name" in hir
        ? ` ${formatStr(hir.name as string)}`
        : ""
    ) + chalk.gray.bold(` @ ${formatLoc(hir.loc)}`)
  );
}

function printExpr(expr: Expr, padding = 1) {
  const prefix = " ".repeat(padding) + "-";

  if (expr.type == AstType.Word) {
    console.log(prefix, `Word ${formatStr(expr.value)}`);
  } else if (expr.type == AstType.Push) {
    console.log(prefix, `Push ${chalk.bold.whiteBright(
      typeof expr.datatype == "string"
        ? expr.datatype
        : DataType[expr.datatype]
    )}(${formatObj(expr.value)})`);
  } else if (expr.type == AstType.If) {
    console.log(prefix, chalk.bold("If"));
    expr.body.forEach((x) => printExpr(x, padding + 2));

    if (expr.else.length > 0) {
      console.log(prefix, chalk.bold("Else"));
      expr.else.forEach((x) => printExpr(x, padding + 2));
    }
  } else if (expr.type == AstType.While) {
    console.log(prefix, chalk.bold("While"));
    expr.condition.forEach((x) => printExpr(x, padding + 2));
    console.log(prefix, chalk.bold("Do"));
    expr.body.forEach((x) => printExpr(x, padding + 2));
  } else {
    console.log(prefix, AstType[(expr as Expr).type]);
  }
}

function printIRExpr(expr: IRExpr, padding = 1) {
  const prefix = " ".repeat(padding) + "-";

  if (expr.type == IRType.Word) {
    console.log(prefix, `Word ${chalk.bold(IRWordKind[expr.kind])}(${formatStr(expr.name)})`);
  } else if (expr.type == AstType.Push) {
    console.log(prefix, `Push ${chalk.bold.whiteBright(
      typeof expr.datatype == "string"
        ? expr.datatype
        : DataType[expr.datatype]
    )}(${formatObj(expr.value)})`);
  } else if (expr.type == IRType.If) {
    console.log(prefix, chalk.bold("If"));
    expr.body.forEach((x) => printIRExpr(x, padding + 2));

    if (expr.else.length > 0) {
      console.log(prefix, chalk.bold("Else"));
      expr.else.forEach((x) => printIRExpr(x, padding + 2));
    }
  } else if (expr.type == IRType.While) {
    console.log(prefix, chalk.bold("While"));
    expr.condition.forEach((x) => printIRExpr(x, padding + 2));
    console.log(prefix, chalk.bold("Do"));
    expr.body.forEach((x) => printIRExpr(x, padding + 2));
  } else {
    console.log(prefix, IRType[(expr as IRExpr).type]);
  }
}

export function printProgramAst(program: IProgram) {
  for (const proc of program.macros.values()) {
    console.log(formatAst(proc));
    proc.body.forEach((x) => printExpr(x));
  }

  for (const proc of program.procs.values()) {
    console.log(formatAst(proc));
    proc.body.forEach((x) => printExpr(x));
  }
}

export function printProgramIR(program: IRProgram) {
  for (const proc of program.procs.values()) {
    console.log(formatIR(proc));
    if (proc.signature) {
      console.log(
        chalk.gray("Signature:"),
        `[${proc.signature.ins.map(
          (x) => typeof x == "string" ? x : DataType[x]
        ).join(", ")}]`,
        "->",
        `[${proc.signature.outs.map(
          (x) => typeof x == "string" ? x : DataType[x]
        ).join(", ")}]`
      );
    }
    proc.body.forEach((x) => printIRExpr(x));
  }
}

export function printByteCode(bytecode: ByteCode) {
  console.log(chalk.gray("text:"));

  let addr = 0;
  const text = bytecode.text.map(
    (x) => [((addr += x.length) - x.length).toString(16), x]
  );

  const addrPadding = Math.max(...text.map((x) => x[0].length));
  for (const [addr, str] of text) {
    console.log(" ", chalk.green(`0x${addr.padStart(addrPadding, "0")}`), formatStr(str));
  }

  console.log(chalk.gray("instr:"));

  const instrPadding = Math.max(
    ...bytecode.instr.map((_, i) => i.toString().length)
  );

  for (let i = 0; i < bytecode.instr.length; i++) {
    const instr = bytecode.instr[i];
    console.log(
      " ",
      chalk.bold.whiteBright(i.toString().padStart(instrPadding, " ")),
      chalk.bold.yellow(Instr[instr[0]]),
      instr.slice(1).map((x) => chalk.cyan(x)).join(", ")
    );
  }
}

export function printTokens(tokens: Token[]) {
  for (const token of tokens) {
    console.log(
      chalk.gray("-"),
      chalk.bold(token.kind) + (
        typeof token.value != "undefined"
          ? `(${formatObj(token.value)})`
          : ""
      ),
      chalk.gray(
        `@ ${token.loc.span[0]}..${token.loc.span[1]}`
      ),
    );
  }
}