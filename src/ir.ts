import { AstType, Expr, IConst, IProc, IProgram, IPush, ISignature, IWord } from "./shared/ast";
import { IRExpr, IRProc, IRProgram, IRWordKind, IRType, IRConst } from "./shared/ir";
import { StackElement, reportError, reportErrorWithStack } from "./errors";
import { DataType, compareDataTypeArrays } from "./shared/types";
import { INTRINSICS, Intrinsic } from "./shared/intrinsics";
import { Location, formatLoc } from "./shared/location";
import chalk from "chalk";

// TODO: Split this into multiple files in the future

export interface Context {
  stack: DataType[];
  stackLocations: Location[];
  macroExpansionStack: IWord[];
  // ...
}

function createContext(stack: DataType[] = [], stackLocations: Location[] = []): Context {
  return {
    stack,
    stackLocations,
    macroExpansionStack: []
  }
}

export class IR {
  public procs = new Map<string, IRProc>();
  public consts = new Map<string, IRConst>();

  constructor (
    public readonly program: IProgram
  ) {}

  private reportErrorWithStackData(message: string, loc: Location, ctx: Context, expectedStack: DataType[], notes: string[] = []): never {
    notes.push(`expected data: [${chalk.bold(expectedStack.map((x) => DataType[x]).join(", "))}]`);

    if (ctx.stack.length) {
      notes.push("current data on the stack:");
      for (let i = 0; i < ctx.stack.length; i++) {
        notes.push(` - ${chalk.bold(DataType[ctx.stack[i]])} @ ${chalk.bold(formatLoc(ctx.stackLocations[i]))}`);
      }
    } else {
      notes.push("current data on the stack: []");
    }

    reportErrorWithStack(message, loc, ctx.macroExpansionStack, notes);
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
        ctx.stackLocations.pop();
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
    suffix: string = "",
    notes: string[] = []
  ) {
    if (ctx.stack.length < stack.length) {
      this.reportErrorWithStackData(`Insufficient data on the stack ${suffix}`, loc, ctx, stack, notes);
    }

    if (strictLength) {
      if (ctx.stack.length > stack.length) {
        this.reportErrorWithStackData(`Unhandled data on the stack ${suffix}`, loc, ctx, stack, notes);
      } else if (!compareDataTypeArrays(stack, ctx.stack)) {
        this.reportErrorWithStackData(`Unexpected data on the stack ${suffix}`, loc, ctx, stack, notes);
      }
    } else {
      const currentStack = ctx.stack.slice().reverse().slice(0, stack.length);

      if (!compareDataTypeArrays(stack.slice().reverse(), currentStack)) {
        this.reportErrorWithStackData(
          `Unexpected data on the stack ${suffix}`,
          loc, ctx, stack, notes
        );
      }
    }
  }

  private typecheckBody(exprs: IRExpr[], ctx: Context) {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.name == "<dump-stack>") {
          console.debug(chalk.blueBright.bold("debug:"), "Current data on the stack at", chalk.gray(formatLoc(expr.loc)));

          for (let i = 0; i < ctx.stack.length; i++) {
            console.debug(
              chalk.blueBright.bold("debug:"),
              "-", chalk.bold(DataType[ctx.stack[i]]),
              "@", chalk.bold(formatLoc(ctx.stackLocations[i]))
            );
          }
        } else if (this.procs.has(expr.name)) {
          const proc = this.procs.get(expr.name)!;

          if (!proc.signature) {
            console.warn(
              chalk.yellow("WARN:"),
              "Call of the procedure without a signature",
              "@", chalk.bold(formatLoc(expr.loc))
            );

            console.warn(chalk.yellow("WARN:"), "(likely a compiler bug)");
            continue;
          }

          this.validateContextStack(expr.loc, ctx, proc.signature.ins, false, "for the procedure call");
          for (let i = 0; i < proc.signature.ins.length; i++) {
            ctx.stack.pop();
            ctx.stackLocations.pop();
          }

          for (let i = 0; i < proc.signature.outs.length; i++) {
            ctx.stack.push(proc.signature.outs[i]);
            ctx.stackLocations.push(expr.loc);
          }
        } else if (INTRINSICS.has(expr.name)) {
          this.handleIntrinsic(
            INTRINSICS.get(expr.name)!, ctx, expr.loc
          );
        } else {
          reportError("Unknown word", expr.loc);
        }
      } else if (expr.type == IRType.While) {
        const initialStack = structuredClone(ctx.stack);

        this.typecheckBody(expr.condition, ctx);
        this.validateContextStack(expr.loc, ctx, [DataType.Boolean], false, "in the condition of the loop");
        ctx.stackLocations.pop();
        ctx.stack.pop();

        this.typecheckBody(expr.body, ctx);
        this.validateContextStack(expr.loc, ctx, initialStack, true, "after a single interation of the loop");
      } else if (expr.type == IRType.If) {
        this.validateContextStack(expr.loc, ctx, [DataType.Boolean], false, "for the condition");
        ctx.stackLocations.pop();
        ctx.stack.pop();

        const branches = [];

        if (expr.body.length > 0) {
          const clone = createContext(structuredClone(ctx.stack), ctx.stackLocations.slice());
          this.typecheckBody(expr.body, clone);
          branches.push(clone);
        }

        if (expr.else.length > 0) {
          const clone = createContext(structuredClone(ctx.stack), ctx.stackLocations.slice());
          this.typecheckBody(expr.else, clone);
          branches.push(clone);
        }

        if (branches.length > 1) {
          this.validateContextStack(expr.loc, branches[1], branches[0].stack, false, "after the condition", [
            "Both branches must result in the same data on the stack"
          ]);
        }

        if (branches.length > 0) {
          this.validateContextStack(expr.loc, branches[0], ctx.stack, false, "after the condition");
          ctx.stack = branches[0].stack;
          ctx.stackLocations = branches[0].stackLocations;
        }
      } else if (expr.type == AstType.Push) {
        ctx.stack.push(expr.datatype);
        ctx.stackLocations.push(expr.loc);
      } else {
        throw new Error(`IR Typechecking is not implemented for ${IRType[(expr as IRExpr).type]}`);
      }
    }
  }

  private typecheckProc(proc: IRProc, ctx: Context) {
    if (proc.name == "main") {
      if (proc.signature!.ins.length > 0) {
        reportError(
          "The main procedure must not accept any data from the stack",
          proc.loc
        );
      } else if (proc.signature!.outs.length > 0) {
        reportError(
          "The main procedure must not return anything",
          proc.loc
        );
      }
    }

    this.typecheckBody(proc.body, ctx);
    this.validateContextStack(proc.loc, ctx, proc.signature!.outs, true, "after the procedure call");
  }

  private determineSignature(
    exprs: IRExpr[],
    callstack: StackElement[] = [],
    stack: DataType[] = [],
    ins: DataType[] = []
  ): [DataType[], DataType[]] {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (this.procs.has(expr.name)) {
          const proc = this.procs.get(expr.name)!;
          if (!proc.signature) {
            if (callstack.find((x) => x.name == expr.name)) {
              reportErrorWithStack(
                "Recursive calls of functions without signatures are not supported",
                expr.loc, callstack
              );
            } else {
              this.determineProcSignature(proc, callstack.concat(expr));
            }
          }

          for (const i of proc.signature!.ins) {
            if (stack.length) stack.pop();
            else ins.push(i);
          }

          for (const o of proc.signature!.outs) {
            stack.push(o);
          }
        } else if (INTRINSICS.has(expr.name)) {
          const intrinsic = INTRINSICS.get(expr.name)!;
          if (intrinsic.name == "dup") {
            if (stack.length) {
              const o = stack.pop()!;
              stack.push(o, o);
            } else {
              ins.push(DataType.Any);
              stack.push(DataType.Any, DataType.Any);
            }
          } else if (intrinsic.name == "swap") {
            if (stack.length > 1) {
              stack.push(stack.pop()!, stack.pop()!);
            } else if (stack.length > 0) {
              ins.push(DataType.Any);
              stack.push(stack.pop()!, DataType.Any);
            } else {
              ins.push(DataType.Any, DataType.Any);
              stack.push(DataType.Any, DataType.Any);
            }
          } else {
            for (const i of intrinsic.ins) {
              if (stack.length) stack.pop();
              else ins.push(i);
            }

            for (const o of intrinsic.outs) {
              stack.push(o);
            }
          }
        }
      } else if (expr.type == IRType.While) {
        this.determineSignature(expr.condition, callstack, stack, ins);
        this.determineSignature(expr.body, callstack, stack, ins);
      } else if (expr.type == IRType.If) {
        if (stack.length) stack.pop();
        else ins.push(DataType.Boolean);

        if (expr.body.length > 0) {
          this.determineSignature(expr.body, callstack, stack, ins);
        }
      } else if (expr.type == AstType.Push) {
        stack.push(expr.datatype);
      } else {
        throw new Error(`IR Typechecking is not implemented for ${IRType[(expr as IRExpr).type]}`);
      }
    }

    return [stack, ins];
  }

  private determineProcSignature(proc: IRProc, callstack: StackElement[] = []): ISignature {
    if (!proc.signature) {
      if (proc.name == "main") {
        proc.signature = { ins: [], outs: [] };
      } else {
        const [outs, ins] = this.determineSignature(proc.body, callstack);
        proc.signature = {
          ins, outs
        }
      }
    }

    return proc.signature;
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
          out.push({
            type: IRType.Word,
            kind: IRWordKind.Intrinsic,
            name: expr.value,
            loc: expr.loc
          });
        } else if (this.consts.has(expr.value)) {
          const constant = this.consts.get(expr.value)!;
          out.push({
            type: AstType.Push,
            datatype: constant.body.datatype,
            value: constant.body.value,
            loc: expr.loc
          });
        } else if (INTRINSICS.has(expr.value)) {
          out.push({
            type: IRType.Word,
            kind: IRWordKind.Intrinsic,
            name: expr.value,
            loc: expr.loc
          });
        } else {
          reportErrorWithStack(
            "Unknown word", expr.loc, ctx.macroExpansionStack
          );
        }
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
      } else if (expr.type == AstType.Push) {
        out.push(expr);
      } else {
        throw new Error(`IR Parsing is not implemented for ${AstType[(expr as Expr).type]}`);
      }
    }

    return out;
  }

  private parseConst(constant: IConst): IRConst {
    if (this.consts.has(constant.name)) {
      return this.consts.get(constant.name)!;
    }

    const ctx: Context = createContext();
    const irconst: IRConst = {
      type: IRType.Const,
      name: constant.name,
      loc: constant.loc,
      body: this.evaluateCompileTimeExpr(constant.body, ctx, constant.loc)
    }

    this.consts.set(constant.name, irconst);
    return irconst;
  }

  private parseProc(proc: IProc): IRProc {
    if (this.procs.has(proc.name)) {
      return this.procs.get(proc.name)!;
    }

    const ctx: Context = createContext();
    const irproc: IRProc = {
      type: IRType.Proc,
      signature: proc.signature,
      name: proc.name,
      loc: proc.loc,
      body: this.parseBody(proc.body, ctx)
    };

    this.procs.set(proc.name, irproc);
    return irproc;
  }

  public parse(): IRProgram {
    this.program.consts.forEach((constant) => this.parseConst(constant));
    this.program.procs.forEach((proc) => this.parseProc(proc));

    this.procs.forEach((proc) => {
      const ctx = createContext();

      if (!proc.signature) {
        proc.signature = this.determineProcSignature(proc, [{
          name: proc.name,
          loc: proc.loc
        }]);
      }

      for (const e of proc.signature.ins) {
        ctx.stack.push(e);
        ctx.stackLocations.push(proc.loc);
      }

      this.typecheckProc(proc, ctx);
    });

    return {
      procs: this.procs
    };
  }
}