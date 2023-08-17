import { AstType, Expr, IConst, IProc, IProgram, IPush, IWord } from "./shared/ast";
import { IRExpr, IRProc, IRProgram, IRWordKind, IRType, IRConst } from "./shared/ir";
import { DataType, compareDataTypeArrays } from "./shared/types";
import { INTRINSICS, Intrinsic } from "./shared/intrinsics";
import { Location, formatLoc } from "./shared/location";
import { reportError, reportErrorWithMacroExpansionStack, reportWarning } from "./errors";
import chalk from "chalk";

// TODO: Split this into multiple files in the future

export interface Context {
  stack: DataType[];
  stackLocations: Location[];

  macroExpansionStack: IWord[];
  branches: Context[];
  // ...
}

export class IR {
  public procs = new Map<string, IRProc>();
  public consts = new Map<string, IRConst>();

  constructor (
    public readonly program: IProgram
  ) {}

  private reportErrorWithStackData(message: string, loc: Location, ctx: Context, expectedStack: DataType[]): never {
    const notes = [];

    notes.push(`expected data: [${chalk.bold(expectedStack.map((x) => DataType[x]).join(", "))}]`);

    if (ctx.stack.length) {
      notes.push("current data on the stack:");
      for (let i = 0; i < ctx.stack.length; i++) {
        notes.push(` - ${chalk.bold(DataType[ctx.stack[i]])} @ ${chalk.bold(formatLoc(ctx.stackLocations[i]))}`);
      }
    } else {
      notes.push("current data on the stack: []");
    }

    reportErrorWithMacroExpansionStack(message, loc, ctx.macroExpansionStack, notes);
  }

  private evaluateCompileTimeExpr(exprs: Expr[], ctx: Context, loc: Location): IPush {
    const stackValues: any[] = [];

    for (const expr of exprs) {
      if (expr.type == AstType.Word) {
        if (INTRINSICS.has(expr.value)) {
          this.handleIntrinsic(INTRINSICS.get(expr.value)!, ctx, expr.loc);

          if (expr.value == "add") {
            const rhs = stackValues.pop(), lhs = stackValues.pop();
            stackValues.push(lhs + rhs);
          } else if (expr.value == "sub") {
            const rhs = stackValues.pop(), lhs = stackValues.pop();
            stackValues.push(lhs - rhs);
          } else if (expr.value == "mul") {
            const rhs = stackValues.pop(), lhs = stackValues.pop();
            stackValues.push(lhs * rhs);
          } else if (expr.value == "divmod") {
            const rhs = stackValues.pop(), lhs = stackValues.pop();
            stackValues.push(Math.floor(lhs / rhs));
            stackValues.push(lhs % rhs);
          } else if (expr.value == "lt") {
            const rhs = stackValues.pop(), lhs = stackValues.pop();
            stackValues.push(lhs < rhs);
          } else if (expr.value == "eq") {
            const rhs = stackValues.pop(), lhs = stackValues.pop();
            stackValues.push(lhs == rhs);
          } else if (expr.value == "gt") {
            const rhs = stackValues.pop(), lhs = stackValues.pop()!;
            stackValues.push(lhs > rhs);
          } else if (expr.value == "dup") {
            const a = stackValues.pop();
            stackValues.push(a, a);
          } else if (expr.value == "drop") {
            stackValues.pop();
          } else if (expr.value == "swap") {
            stackValues.push(stackValues.pop(), stackValues.pop());
          } else {
            reportError("Cannot use this intrinsic in compile-time expression", expr.loc);
          }
        } else if (this.consts.has(expr.value)) {
          const constant = this.consts.get(expr.value)!;
          ctx.stack.push(constant.body.datatype);
          ctx.stackLocations.push(expr.loc);
          stackValues.push(constant.body.value);
        } else if (this.program.consts.has(expr.value)) {
          reportError("That constant is not defined yet", expr.loc);
        } else if (this.program.procs.has(expr.value)) {
          reportError("Cannot use procedures in compile-time expressions", expr.loc);
        } else if (this.program.macros.has(expr.value)) {
          reportError("Cannot use macros in compile-time expressions", expr.loc);
        } else {
          reportError("Unknown word", expr.loc);
        }
      } else if (expr.type == AstType.Push) {
        stackValues.push(expr.value);
        ctx.stack.push(expr.datatype);
        ctx.stackLocations.push(expr.loc);
      }
    }

    if (stackValues.length < 0) {
      this.reportErrorWithStackData(
        "Compile time expression resulted in nothing",
        loc, ctx, [DataType.Any]
      );
    } else if (stackValues.length > 1) {
      this.reportErrorWithStackData(
        "Compile time expression resulted in multiple values on the stack",
        loc, ctx, [DataType.Any]
      );
    }

    return {
      type: AstType.Push,
      datatype: ctx.stack.pop()!,
      value: stackValues.pop()!,
      loc: ctx.stackLocations.pop()!
    }
  }

  private expandMacro(expr: IWord, ctx: Context): IRExpr[] {
    const macro = this.program.macros.get(expr.value)!;

    if (ctx.macroExpansionStack.find((x) => x.value == macro.name)) {
      const stack = ctx.macroExpansionStack.map(
        (x) => `macro ${chalk.bold(x.value)} expanded at ${chalk.gray(formatLoc(x.loc))}`
      );

      stack.push(`macro ${chalk.bold(expr.value)} expanded again at ${chalk.gray.bold(formatLoc(expr.loc))}`);

      reportError("recursive macro expansion", expr.loc, stack.reverse());
    }

    ctx.macroExpansionStack.push(expr);
    const body = this.parseBody(macro.body, ctx);
    ctx.macroExpansionStack.pop();

    return body;
  }

  private handleIntrinsic(intrinsic: Intrinsic, ctx: Context, loc: Location) {
    this.validateContextStack(loc, ctx, intrinsic.ins, false, "for the intrinsic call");

    // TODO: find a better way to handle this
    if (intrinsic.name == "dup") {
      const x = ctx.stack.pop()!;
      ctx.stack.push(x, x);
      ctx.stackLocations.push(loc, loc);
    } else if (intrinsic.name == "swap") {
      ctx.stack.push(ctx.stack.pop()!, ctx.stack.pop()!);
    } else {
      for (let i = 0; i < intrinsic.ins.length; i++) {
        ctx.stack.pop();
      }

      for (let i = 0; i < intrinsic.outs.length; i++) {
        ctx.stack.push(intrinsic.outs[i]);
        ctx.stackLocations.push(loc);
      }
    }
  }

  private validateContextStack(
    loc: Location,
    ctx: Context,
    stack: DataType[],
    strictLength: boolean = true,
    suffix: string = ""
  ) {
    if (ctx.stack.length < stack.length) {
      this.reportErrorWithStackData(`Insufficient data on the stack ${suffix}`, loc, ctx, stack);
    }

    if (strictLength) {
      if (ctx.stack.length > stack.length) {
        this.reportErrorWithStackData(`Unhandled data on the stack ${suffix}`, loc, ctx, stack);
      } else if (!compareDataTypeArrays(stack, ctx.stack)) {
        this.reportErrorWithStackData(`Unexpected data on the stack ${suffix}`, loc, ctx, stack);
      }
    } else {
      const currentStack = ctx.stack.slice().reverse().slice(0, stack.length);

      if (!compareDataTypeArrays(stack.slice().reverse(), currentStack)) {
        this.reportErrorWithStackData(
          `Unexpected data on the stack ${suffix}`,
          loc, ctx, stack
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
        } else if (this.consts.has(expr.value)) {
          const constant = this.consts.get(expr.value)!;

          ctx.stack.push(constant.body.datatype);
          ctx.stackLocations.push(expr.loc);

          out.push({
            type: AstType.Push,
            datatype: constant.body.datatype,
            value: constant.body.value,
            loc: expr.loc
          });
        } else if (INTRINSICS.has(expr.value)) {
          const intrinsic = INTRINSICS.get(expr.value)!;
          this.handleIntrinsic(intrinsic, ctx, expr.loc);

          out.push({
            type: IRType.Word,
            kind: IRWordKind.Intrinsic,
            name: expr.value,
            loc: expr.loc
          });
        } else {
          reportErrorWithMacroExpansionStack(
            "Unknown word", expr.loc, ctx.macroExpansionStack
          );
        }
      } else if (expr.type == AstType.While) {
        const types = structuredClone(ctx.stack);

        const condition = this.parseBody(expr.condition, ctx);
        this.validateContextStack(expr.loc, ctx, [DataType.Boolean], false, "in the condition of the loop");
        ctx.stackLocations.pop();
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
        ctx.stackLocations.push(expr.loc);
        out.push(expr);
      } else {
        throw `${AstType[(expr as Expr).type]} -> IR: not implemented`;
      }
    }

    return out;
  }

  private parseConst(constant: IConst): IRConst {
    if (this.consts.has(constant.name)) {
      return this.consts.get(constant.name)!;
    }

    const ctx: Context = {
      stack: [],
      stackLocations: [],
      macroExpansionStack: [],
      branches: []
    }

    return {
      type: IRType.Const,
      name: constant.name,
      loc: constant.loc,
      body: this.evaluateCompileTimeExpr(constant.body, ctx, constant.loc)
    }
  }

  private parseProc(proc: IProc): IRProc {
    if (this.procs.has(proc.name)) {
      return this.procs.get(proc.name)!;
    }

    const ctx: Context = {
      stack: [],
      stackLocations: [],
      macroExpansionStack: [],
      branches: []
    }

    return {
      type: IRType.Proc,
      ins: [], outs: [], // TODO
      name: proc.name,
      loc: proc.loc,
      body: this.parseBody(proc.body, ctx)
    };
  }

  public parse(): IRProgram {
    this.program.consts.forEach((constant) => {
      this.consts.set(constant.name, this.parseConst(constant));
    });

    this.program.procs.forEach((proc) => {
      this.procs.set(proc.name, this.parseProc(proc));
    });

    return {
      procs: this.procs
    };
  }
}