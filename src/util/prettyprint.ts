import { Ast, AstType, Expr, IProgram } from "../shared/ast";
import { DataType, WordType } from "../shared/types";
import chalk from "chalk";

// A shitty utility for debugging
// Will probably be removed

function formatStr(str: string): string {
  return chalk.yellow(JSON.stringify(str));
}

function formatObj(type: DataType, obj: any): string {
  if (type == DataType.Int || type == DataType.Boolean) {
    return chalk.cyanBright(obj);
  } else if (type == DataType.Char) {
    return chalk.yellow(`'${JSON.stringify(obj).replace(/^"|"$/g, "")}'`);
  } else if (type == DataType.Str) {
    return formatStr(obj);
  } else {
    return `${obj}`;
  }
}

function formatAst(ast: Ast<any>): string {
  return (
    AstType[ast.type]
    + (
      "name" in ast
        ? ` ${formatStr(ast.name as string)}`
        : ""
    ) + chalk.gray.bold(
      ` @ ${
        ast.loc.file.formatLoc(ast.loc.span)
      }`
    )
  );
}

function printExpr(expr: Expr, padding = 1) {
  const prefix = " ".repeat(padding) + "-";

  if (expr.type == AstType.Word) {
    console.log(prefix, `Word ${chalk.bold.whiteBright(WordType[expr.wordtype])}(${formatStr(expr.value)})`);
  } else if (expr.type == AstType.Push) {
    console.log(prefix, `Push ${chalk.bold.whiteBright(DataType[expr.datatype])}(${formatObj(expr.datatype, expr.value)})`);
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

export function printProgramAst(program: IProgram) {
  for (const proc of program.procs.values()) {
    console.log(formatAst(proc));
    proc.body.forEach((x) => printExpr(x));
  }
}