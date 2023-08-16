import { AstType, Expr, IProc, IProgram, IPush, IWord } from "./shared/ast";
import { IRExpr, IRProc, IRProgram, IRWordKind, IRType } from "./shared/ir";
import { INTRINSICS } from "./shared/intrinsics";
import { reportError } from "./errors";
import chalk from "chalk";

// TODO
export interface Context {
  stack: IPush[];
  macroExpansionStack: IWord[];
  // ...
}

export class IR {
  public procs = new Map<string, IRProc>();

  constructor (
    public readonly program: IProgram
  ) {}

  private expandMacro(expr: IWord, ctx: Context): IRExpr[] {
    const macro = this.program.macros.get(expr.value)!;

    if (ctx.macroExpansionStack.find((x) => x.value == macro.name)) {
      const stack = ctx.macroExpansionStack.map(
        (x) => `macro ${chalk.bold(x.value)} expanded at ${chalk.gray(x.loc.file.formatLoc(x.loc.span))}`
      );

      stack.push(`macro ${chalk.bold(expr.value)} expanded again at ${
        chalk.gray.bold(expr.loc.file.formatLoc(expr.loc.span))
      }`);

      reportError("recursive macro expansion", expr.loc, stack.reverse());
    }

    ctx.macroExpansionStack.push(expr);
    const body = this.parseBody(macro.body, ctx);
    ctx.macroExpansionStack.pop();

    return body;
  }

  private parseBody(exprs: Expr[], ctx: Context): IRExpr[] {
    const out: IRExpr[] = [];
    for (const expr of exprs) {
      if (expr.type == AstType.Word) {
        if (this.program.macros.has(expr.value)) {
          const body = this.expandMacro(expr, ctx);
          for (const expr of body)
            out.push(expr);

          continue;
        }

        const kind = (
          this.program.constants.has(expr.value)
            ? IRWordKind.Const
          : this.program.procs.has(expr.value)
            ? IRWordKind.Proc
          : INTRINSICS.has(expr.value)
            ? IRWordKind.Intrinsic
          : null
        );

        if (kind == null) {
          reportError("Unknown word", expr.loc);
        }

        out.push({
          type: IRType.Word,
          kind,
          name: expr.value,
          loc: expr.loc
        });
      } else if (expr.type == AstType.While) {
        out.push({
          type: IRType.While,
          condition: this.parseBody(expr.condition, ctx),
          body: this.parseBody(expr.body, ctx),
          loc: expr.loc
        });
      } else if (expr.type == AstType.If) {
        out.push({
          type: IRType.If,
          body: this.parseBody(expr.body, ctx),
          else: this.parseBody(expr.else, ctx),
          loc: expr.loc
        });
      } else {
        out.push(expr);
      }
    }

    return out;
  }

  private parseProc(proc: IProc): IRProc {
    const ctx: Context = {
      stack: [],
      macroExpansionStack: []
    }

    const hproc: IRProc = {
      type: IRType.Proc,
      ins: [], outs: [], // TODO
      name: proc.name,
      loc: proc.loc,
      body: this.parseBody(proc.body, ctx)
    }

    return hproc;
  }

  public parse(): IRProgram {
    const program: IRProgram = {
      procs: new Map<string, IRProc>()
    };

    this.program.procs.forEach((proc) => {
      program.procs.set(proc.name, this.parseProc(proc));
    });

    return program;
  }
}