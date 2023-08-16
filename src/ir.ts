import { IRExpr, IRProc, IRProgram, IRWordKind, IRType } from "./shared/ir";
import { AstType, Expr, IProc, IProgram, IWord } from "./shared/ast";
import { DataType, compareDataTypeArrays } from "./shared/types";
import { INTRINSICS } from "./shared/intrinsics";
import { Location } from "./shared/location";
import { reportError } from "./errors";
import chalk from "chalk";

export interface Context {
  stack: DataType[];
  macroExpansionStack: IWord[];
  branches: Context[];
  // ...
}

export class IR {
  public procs = new Map<string, IRProc>();

  constructor (
    public readonly program: IProgram
  ) {}

  private reportErrorWithStackData(message: string, loc: Location, currentStack: DataType[], expectedStack: DataType[]): never {
    // TODO: report where the data was introduced
    reportError(message, loc, [
      `current data on the stack: [${chalk.bold(currentStack.map((x) => DataType[x]).join(", "))}]`,
      `expected data: [${chalk.bold(expectedStack.map((x) => DataType[x]).join(", ") || "")}]`
    ]);
  }

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

  private validateContextStack(
    loc: Location,
    ctx: Context,
    stack: DataType[],
    strictLength: boolean = true,
    suffix: string = ""
  ) {
    if (ctx.stack.length < stack.length) {
      this.reportErrorWithStackData(`Insufficient data on the stack ${suffix}`, loc, ctx.stack, stack);
    }

    if (strictLength) {
      if (ctx.stack.length > stack.length) {
        this.reportErrorWithStackData(`Unhandled data on the stack ${suffix}`, loc, ctx.stack, stack);
      } else if (!compareDataTypeArrays(stack, ctx.stack)) {
        this.reportErrorWithStackData(`Unexpected data on the stack ${suffix}`, loc, ctx.stack, stack);
      }
    } else {
      const currentStack = ctx.stack.slice().reverse().slice(0, stack.length);

      if (!compareDataTypeArrays(stack.slice().reverse(), currentStack)) {
        this.reportErrorWithStackData(
          `Unexpected data on the stack ${suffix}`,
          loc, ctx.stack, stack
        );
      }
    }
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
        } else if (this.program.procs.has(expr.value)) {
          console.warn("/src/ir.ts -> IR -> parseBody: procedure typechecking is not implemented yet");
          // IDEA: Optional procedure signature declaration
          // Syntax: `def <procedure-name> <...ins> :: <...outs>`
          // Example:
          /*
            def is-nice int :: bool
            proc is-nice
              69 =
            end
          */

          out.push({
            type: IRType.Word,
            kind: IRWordKind.Intrinsic,
            name: expr.value,
            loc: expr.loc
          });
        } else if (this.program.constants.has(expr.value)) {
          // TODO: constants are not implemented yet
        } else if (INTRINSICS.has(expr.value)) {
          const intrinsic = INTRINSICS.get(expr.value)!;
          this.validateContextStack(expr.loc, ctx, intrinsic.ins, false, "for the intrinsic call");

          // TODO: find a better way to handle this
          if (intrinsic.name == "dup") {
            const x = ctx.stack.pop()!;
            ctx.stack.push(x, x);
          } else if (intrinsic.name == "swap") {
            ctx.stack.push(ctx.stack.pop()!, ctx.stack.pop()!);
          } else {
            for (let i = 0; i < intrinsic.ins.length; i++) {
              ctx.stack.pop();
            }

            ctx.stack.push(...intrinsic.outs);
          }

          out.push({
            type: IRType.Word,
            kind: IRWordKind.Intrinsic,
            name: expr.value,
            loc: expr.loc
          });
        } else {
          reportError("Unknown word", expr.loc);
        }
      } else if (expr.type == AstType.While) {
        const types = structuredClone(ctx.stack);

        const condition = this.parseBody(expr.condition, ctx);
        this.validateContextStack(expr.loc, ctx, [DataType.Boolean], false, "in the condition of the loop");
        ctx.stack.pop();

        const body = this.parseBody(expr.body, ctx);
        this.validateContextStack(expr.loc, ctx, types, true, "after a single interation of the loop");

        out.push({
          type: IRType.While,
          condition, body,
          loc: expr.loc
        });
      } else if (expr.type == AstType.If) {
        console.warn("/src/ir.ts -> IR -> parseBody: `if` typechecking is not implemented yet");

        out.push({
          type: IRType.If,
          body: this.parseBody(expr.body, ctx),
          else: this.parseBody(expr.else, ctx),
          loc: expr.loc
        });
      } else if (expr.type == AstType.Push) {
        ctx.stack.push(expr.datatype);
        out.push(expr);
      } else {
        throw `${AstType[(expr as Expr).type]} -> IR: not implemented`;
      }
    }

    return out;
  }

  private parseProc(proc: IProc): IRProc {
    const ctx: Context = {
      stack: [],
      macroExpansionStack: [],
      branches: []
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