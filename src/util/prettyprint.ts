import { Ast, AstType, Expr, IProgram, WordType } from "../shared/ast";
import { DataType } from "../shared/types";
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

function formatExpr(expr: Expr): string {
  if (expr.type == AstType.Word) {
    return `Word ${chalk.bold.whiteBright(WordType[expr.wordtype])}(${formatStr(expr.value)})`;
  } else if (expr.type == AstType.Push) {
    return `Push ${chalk.bold.whiteBright(DataType[expr.datatype])}(${formatObj(expr.datatype, expr.value)})`
  } else if (expr.type == AstType.If) {
    return [
      chalk.bold("If"),
      ...(expr.body.map((x) => `   * ${formatExpr(x)}`)),
      chalk.bold("   Else"),
      ...(expr.else.map((x) => `   * ${formatExpr(x)}`))
    ].join("\n");
  } else if (expr.type == AstType.While) {
    return [
      chalk.bold("While"),
      ...(expr.condition.map((x) => `   * ${formatExpr(x)}`)),
      chalk.bold("   Do"),
      ...(expr.body.map((x) => `   * ${formatExpr(x)}`))
    ].join("\n");
  } else {
    return AstType[(expr as Expr).type];
    //                   ^^^^^^^ stoopid typescript
  }
}

export function printProgramAst(program: IProgram) {
  for (const proc of program.procs.values()) {
    console.log(formatAst(proc));

    for (const expr of proc.body) {
      console.log(` - ${formatExpr(expr)}`);
    }
  }
}