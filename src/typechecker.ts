import { StackElement, reportError, reportErrorWithStack, reportWarning } from "./errors";
import { AstType, Expr, IProgram, IPush, ISignature, IWord } from "./shared/ast";
import { IRConst, IRExpr, IRProc, IRProgram, IRType } from "./shared/ir";
import { DataType, compareDataTypeArrays } from "./shared/types";
import { INTRINSICS, Intrinsic } from "./shared/intrinsics";
import { Location, formatLoc } from "./shared/location";
import { Preprocessor } from "./preprocessor";
import chalk from "chalk";

export interface Context {
  stack: DataType[];
  stackLocations: Location[];
  macroExpansionStack: IWord[];
  // ...
}

export function createContext(stack: DataType[] = [], stackLocations: Location[] = []): Context {
  return {
    stack,
    stackLocations,
    macroExpansionStack: []
  }
}

export class TypeChecker {
  public readonly consts: Map<string, IRConst>;
  public readonly procs: Map<string, IRProc>;
  public readonly program: IProgram;

  constructor (preprocessor: Preprocessor) {
    this.consts = preprocessor.consts;
    this.procs = preprocessor.procs;
    this.program = preprocessor.program;
  }

  private reportErrorWithStackData(message: string, loc: Location, ctx: Context, expectedStack: DataType[], notes: string[] = []): never {
    if (expectedStack.length) {
      notes.push(chalk.greenBright.bold("Expected data:"));
      for (const e of expectedStack)
        notes.push(` - ${chalk.bold(DataType[e])}`);

    }

    if (ctx.stack.length) {
      notes.push(chalk.redBright.bold("Current data on the stack:"));
      for (let i = 0; i < ctx.stack.length; i++) {
        notes.push(` - ${chalk.bold(DataType[ctx.stack[i]])} @ ${formatLoc(ctx.stackLocations[i])}`);
      }
    }

    reportErrorWithStack(message, loc, ctx.macroExpansionStack, notes);
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

  public handleIntrinsic(intrinsic: Intrinsic, ctx: Context, loc: Location) {
    this.validateContextStack(loc, ctx, intrinsic.ins, false, "for the intrinsic call");

    // TODO: find a better way to handle this
    if (intrinsic.name == "dup") {
      const a = ctx.stack.pop()!;
      ctx.stack.push(a, a);
      ctx.stackLocations.push(loc, loc);
    } else if (intrinsic.name == "dup2") {
      const a = ctx.stack.pop()!, b = ctx.stack.pop()!;
      ctx.stack.push(b, a, b, a);
      ctx.stackLocations.push(loc, loc);
    } else if (intrinsic.name == "rot") {
      const a = ctx.stack.pop()!,
            b = ctx.stack.pop()!,
            c = ctx.stack.pop()!;
      ctx.stack.push(b, a, c);
    } else if (intrinsic.name == "swap") {
      ctx.stack.push(ctx.stack.pop()!, ctx.stack.pop()!);
    } else if (intrinsic.name == "swap2") {
      ctx.stack.push(ctx.stack.pop()!, ctx.stack.pop()!, ctx.stack.pop()!, ctx.stack.pop()!);
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

  public evaluateCompileTimeExpr(exprs: Expr[], loc: Location, ctx: Context = createContext()): IPush {
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
          } else if (expr.value == "swap2") {
            stackValues.push(
              stackValues.pop(), stackValues.pop(), stackValues.pop(), stackValues.pop()
            );
          } else if (expr.value == "dup2") {
            const a = stackValues.pop()!, b = stackValues.pop()!;
            stackValues.push(b, a, b, a);
          } else if (expr.value == "rot") {
            const a = stackValues.pop()!,
                  b = stackValues.pop()!,
                  c = stackValues.pop()!;
            stackValues.push(b, a, c);
          } else {
            reportError("Cannot use this intrinsic in compile-time expression", expr.loc);
          }
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
      } else {
        reportError(
          `${chalk.yellow.bold(AstType[expr.type])} is not supported in compile-time expressions`,
          expr.loc
        );
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

  public typecheckBody(exprs: IRExpr[], ctx: Context = createContext()) {
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
        this.validateContextStack(expr.loc, ctx, [DataType.Bool], false, "in the condition of the loop");
        ctx.stackLocations.pop();
        ctx.stack.pop();

        this.typecheckBody(expr.body, ctx);
        this.validateContextStack(expr.loc, ctx, initialStack, true, "after a single interation of the loop");
      } else if (expr.type == IRType.If) {
        this.validateContextStack(expr.loc, ctx, [DataType.Bool], false, "for the condition");
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
          this.validateContextStack(expr.loc, branches[1], branches[0].stack, true, "after the condition", [
            "Both branches must result in the same data on the stack"
          ]);
        }

        if (branches.length > 0) {
          this.validateContextStack(expr.loc, branches[0], ctx.stack, true, "after the condition", [
            "Conditions must not change the types and the amount of elements on the stack"
          ]);
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

  public typecheckProc(proc: IRProc, ctx: Context = createContext()) {
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

  public determineSignature(
    exprs: IRExpr[],
    callstack: StackElement[] = [],
    ins: DataType[] = [],
    outs: DataType[] = [],
  ): ISignature {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (this.procs.has(expr.name)) {
          const proc = this.procs.get(expr.name)!;
          if (!proc.signature) {
            if (callstack.find((x) => x.name == expr.name)) {
              reportErrorWithStack(
                "Recursive calls of procedures without signatures are not supported",
                expr.loc, callstack
              );
            } else {
              this.determineProcSignature(proc, callstack.concat(expr));
            }
          }

          for (const i of proc.signature!.ins) {
            if (outs.length) outs.pop();
            else ins.push(i);
          }

          for (const o of proc.signature!.outs) {
            outs.push(o);
          }
        } else if (INTRINSICS.has(expr.name)) {
          const intrinsic = INTRINSICS.get(expr.name)!;

          // TODO: Try to determine DataType.Any by how it is used later
          //       e. g. `<any> <any> add` would replace these types with `<int> <int> add`

          // This would require introducing some metadata for cases like `dup add` etc

          if (intrinsic.name == "dup") {
            const o = outs.pop() ?? DataType.Any;
            outs.push(o, o);
          } else if (intrinsic.name == "swap") {
            outs.push(
              outs.pop() ?? DataType.Any,
              outs.pop() ?? DataType.Any
            );
          } else if (intrinsic.name == "dup2") {
            const a = outs.pop() ?? DataType.Any,
                  b = outs.pop() ?? DataType.Any;
            outs.push(b, a, b, a);
          } else if (intrinsic.name == "rot") {
            const a = outs.pop() ?? DataType.Any,
                  b = outs.pop() ?? DataType.Any,
                  c = outs.pop() ?? DataType.Any;
            outs.push(b, a, c);
          } else if (intrinsic.name == "swap2") {
            outs.push(
              outs.pop() ?? DataType.Any,
              outs.pop() ?? DataType.Any,
              outs.pop() ?? DataType.Any,
              outs.pop() ?? DataType.Any,
            );
          }

          for (const i of intrinsic.ins) {
            if (outs.length) {
              if (i != DataType.Any) outs.pop();
            } else ins.push(i);
          }

          for (const o of intrinsic.outs) {
            if (o != DataType.Any) outs.push(o);
          }
        }
      } else if (expr.type == IRType.While) {
        this.determineSignature(expr.condition, callstack, ins, outs);
        this.determineSignature(expr.body, callstack, ins, outs);
      } else if (expr.type == IRType.If) {
        if (outs.length) outs.pop();
        else ins.push(DataType.Bool);

        if (expr.body.length > 0) {
          this.determineSignature(expr.body, callstack, ins, outs);
        }
      } else if (expr.type == AstType.Push) {
        outs.push(expr.datatype);
      } else {
        throw new Error(`IR Typechecking is not implemented for ${IRType[(expr as IRExpr).type]}`);
      }
    }

    return {
      ins, outs
    };
  }

  public determineProcSignature(proc: IRProc, callstack: StackElement[] = []): ISignature {
    if (!proc.signature) {
      if (proc.name == "main") {
        proc.signature = { ins: [], outs: [] };
      } else {
        proc.signature = this.determineSignature(proc.body, callstack);

        if (
          proc.signature.ins.includes(DataType.Any)
          || proc.signature.outs.includes(DataType.Any)
          ) {
          // This situation occurs when `dup` or `swap` have been used without enough data on the stack.
          // TODO: Make the `determineSignature` method determine the signature more accurately.

          reportWarning(
            "The procedure has unsafe signature",
            proc.loc, [
              "No signature has been specified",
              `Determined signature: ${
                chalk.bold(proc.signature.ins.map((x) => DataType[x]).join(" "))
              } -> ${
                chalk.bold(proc.signature.outs.map((x) => DataType[x]).join(" "))
              }`
            ]
          );
        }
      }
    }

    return proc.signature;
  }

  public typecheckProgram(program: IRProgram) {
    program.procs.forEach((proc) => {
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
  }
}