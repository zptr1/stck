import { DataType, Location, TypeFrame, frameToString, Context, INTRINSICS, cloneContext, createContext, formatLoc } from "../shared";
import { AstKind, Const, Expr, LiteralType, Proc, Program, WordType } from "../parser";
import { reportError, reportErrorWithStackData } from "../errors";
import { assertNever } from "../util";
import chalk from "chalk";

function handleSignature(
  loc: Location, ctx: Context,
  ins: TypeFrame[], outs: TypeFrame[],
  strictLength: boolean = true,
  suffix: string = "", notes: string[] = []
) {
  if (ctx.stack.length < ins.length) {
    reportErrorWithStackData(`Insufficient data on the stack ${suffix}`, loc, ctx, ins, notes);
  } else if (strictLength && ctx.stack.length > ins.length) {
    reportErrorWithStackData(`Unhandled data on the stack ${suffix}`, loc, ctx, ins, notes);
  }

  const cmp = ctx.stack.slice(-ins.length);
  const generics = new Map<string, TypeFrame>();

  for (let i = 0; i < ins.length; i++) {
    if (!typeFrameEquals(ins[i], cmp[i], generics)) {
      // TODO: highlight which type frame did not match?
      reportErrorWithStackData(
        `Unexpected data on the stack ${suffix}`,
        loc, ctx, ins.map((x) => insertGenerics(x, generics)), notes
      );
    }
  }

  ctx.stack.splice(-ins.length, ins.length);
  ctx.stackLocations.splice(-ins.length, ins.length);

  for (let i = 0; i < outs.length; i++) {
    ctx.stack.push(insertGenerics(outs[i], generics));
    ctx.stackLocations.push(loc);
  }
}

/// `handleSignature`, except it does not modify the data on the stack and used only to validate the stack
function validateStack(
  loc: Location, ctx: Context, stack: TypeFrame[],
  strictLength: boolean, suffix: string = "", notes: string[] = []
) {
  if (ctx.stack.length < stack.length) {
    reportErrorWithStackData(`Insufficient data on the stack ${suffix}`, loc, ctx, stack, notes);
  } else if (strictLength && ctx.stack.length > stack.length) {
    reportErrorWithStackData(`Unhandled data on the stack ${suffix}`, loc, ctx, stack, notes);
  }

  const cmp = ctx.stack.slice(-stack.length);
  const generics = new Map<string, TypeFrame>();

  for (let i = 0; i < stack.length; i++) {
    if (!typeFrameEquals(stack[i], cmp[i], generics)) {
      // TODO: highlight which type frame did not match?
      reportErrorWithStackData(
        `Unexpected data on the stack ${suffix}`,
        loc, ctx, stack, notes
      );
    }
  }
}

function typeFrameEquals(frame: TypeFrame, cmp: TypeFrame, generics: Map<string, TypeFrame>): boolean {
  if (frame.type == DataType.Generic) {
    if (frame.value.type == DataType.Unknown) {
      if (generics.has(frame.label)) {
        return typeFrameEquals(generics.get(frame.label)!, cmp, generics);
      } else {
        generics.set(frame.label, cmp);
        return true;
      }
    } else {
      if (!generics.has(frame.label))
        generics.set(frame.label, frame.value);

      return typeFrameEquals(frame.value, cmp, generics);
    }
  } else if (frame.type == DataType.PtrTo) {
    return (
      cmp.type == DataType.PtrTo
      && typeFrameEquals(frame.value, cmp.value, generics)
    )
  } else if (frame.type == DataType.Unknown || cmp.type == DataType.Unknown) {
    // TODO: ?
    return true;
  } else {
    return frame.type == cmp.type;
  }
}

function insertGenerics(frame: TypeFrame, generics: Map<string, TypeFrame>): TypeFrame {
  if (frame.type == DataType.Generic && frame.value.type == DataType.Unknown) {
    const value = generics.get(frame.label);
    return value ?? frame;
  } else if (frame.type == DataType.PtrTo) {
    return {
      type: frame.type,
      loc: frame.loc,
      value: insertGenerics(frame.value, generics)
    }
  } else {
    return frame;
  }
}

export class TypeChecker {
  constructor (
    public readonly program: Program
  ) {}

  private validateExpr(expr: Expr, ctx: Context) {
    if (expr.kind == AstKind.Literal) {
      ctx.stackLocations.push(expr.loc)

      if (expr.type == LiteralType.Str) {
        ctx.stack.push({ type: DataType.Int }, { type: DataType.Ptr });
        ctx.stackLocations.push(expr.loc);
      } else if (expr.type == LiteralType.CStr) {
        ctx.stack.push({ type: DataType.Ptr });
      } else if (expr.type == LiteralType.Int) {
        ctx.stack.push({ type: DataType.Int });
      } else if (expr.type == LiteralType.Bool) {
        ctx.stack.push({ type: DataType.Bool });
      } else if (expr.type == LiteralType.Assembly) {
        reportError(
          "Assembly blocks cannot be used in safe procedures",
          expr.loc
        );
      } else {
        assertNever(expr.type);
      }
    } else if (expr.kind == AstKind.Word) {
      if (expr.value == "<dump-stack>") {
        console.log(chalk.cyan.bold("debug:"), "Current data on the stack");
        for (let i = 0; i < ctx.stack.length; i++) {
          console.log("..... ", chalk.bold(frameToString(ctx.stack[i])), "@", formatLoc(ctx.stackLocations[i]));
        }
      } else if (INTRINSICS.has(expr.value)) {
        const intrinsic = INTRINSICS.get(expr.value)!;
        expr.type = WordType.Intrinsic;
        handleSignature(
          expr.loc, ctx,
          intrinsic.ins, intrinsic.outs,
          false, "for the intrinsic call"
        );
      } else if (this.program.procs.has(expr.value)) {
        const proc = this.program.procs.get(expr.value)!;
        expr.type = WordType.Proc;
        handleSignature(
          expr.loc, ctx,
          proc.signature.ins, proc.signature.outs,
          false, "for the procedure call"
        );
      } else if (ctx.bindings.has(expr.value)) {
        expr.type = WordType.Binding;
        ctx.stack.push(ctx.bindings.get(expr.value)!);
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.consts.has(expr.value)) {
        const constant = this.program.consts.get(expr.value)!;
        if (constant.type.type == DataType.Unknown) {
          reportError("This constant is not defined yet", expr.loc);
        }

        expr.type = WordType.Constant;
        ctx.stack.push(constant.type);
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.memories.has(expr.value)) {
        expr.type = WordType.Memory;
        ctx.stack.push({ type: DataType.Ptr });
        ctx.stackLocations.push(expr.loc);
      } else {
        reportError("Unknown word", expr.loc);
      }
    } else if (expr.kind == AstKind.If) {
      this.validateBody(expr.condition, ctx);
      handleSignature(
        expr.loc, ctx, [{ type: DataType.Bool }], [],
        false, "for the condition"
      );

      if (expr.elseBranch) {
        // if and else - both branches must result in the same data on the stack
        const clone = cloneContext(ctx);

        this.validateBody(expr.body, ctx);
        this.validateBody(expr.else, clone);

        validateStack(expr.loc, clone, ctx.stack, true, "after the condition", [
          "both branches of the condition must result in the same data on the stack"
        ]);
      } else {
        // only if - the branch must not modify the amount of elements or their types on the stack
        const clone = cloneContext(ctx);
        this.validateBody(expr.body, clone);
        validateStack(expr.loc, clone, ctx.stack, true, "after the condition", [
          "the condition must not change the amount of elements or their types on the stack"
        ]);
      }
    } else if (expr.kind == AstKind.While) {
      const clone = cloneContext(ctx);
      this.validateBody(expr.condition, clone);
      handleSignature(
        expr.loc, clone,
        [{ type: DataType.Bool }], [],
        false, "for the condition of the loop"
      );

      this.validateBody(expr.body, clone);
      validateStack(
        expr.loc, clone, ctx.stack, true,
        "after a single iteration of te loop", [
          "loops should not modify the amount of elements or their types on the stack"
        ]
      );
    } else if (expr.kind == AstKind.Let) {
      for (let i = expr.bindings.length - 1; i >= 0; i--) {
        const binding = expr.bindings[i];

        if (ctx.bindings.has(binding)) {
          reportError(
            `The binding ${chalk.bold(binding)} is already defined`,
            expr.loc
          );
        } else {
          const frame = ctx.stack.pop();
          ctx.stackLocations.pop();

          if (!frame) {
            reportErrorWithStackData(
              "Insufficient data on the stack for the let binding", expr.loc, ctx, [], [
                `the let binding takes ${expr.bindings.length} elements`,
                `${ctx.stack.length} elements were provided`
              ]
            );
          }

          ctx.bindings.set(binding, frame);
        }
      }

      this.validateBody(expr.body, ctx);
    } else if (expr.kind == AstKind.Cast) {
      if (ctx.stack.length < expr.types.length) {
        reportErrorWithStackData(
          "Insufficient data on the stack for type casting",
          expr.loc, ctx, []
        );
      }

      ctx.stack.splice(-expr.types.length, expr.types.length);
      ctx.stackLocations.splice(-expr.types.length, expr.types.length);

      for (let i = expr.types.length - 1; i >= 0; i--) {
        ctx.stack.push(expr.types[i]);
        ctx.stackLocations.push(expr.loc);
      }
    } else {
      assertNever(expr);
    }
  }

  private validateBody(body: Expr[], ctx: Context) {
    for (const expr of body)
      this.validateExpr(expr, ctx);
  }

  private validateProc(proc: Proc) {
    const ctx = createContext();

    for (const frame of proc.signature.ins) {
      ctx.stack.push(frame);
      ctx.stackLocations.push(frame.loc ?? proc.loc);
    }

    this.validateBody(proc.body, ctx);
    validateStack(proc.loc, ctx, proc.signature.outs, true, "after the procedure");
  }

  private validateConst(constant: Const) {
    const ctx = createContext();
    this.validateBody(constant.body, ctx);

    if (ctx.stack.length < 0) {
      reportError("Constant resulted in no value", constant.loc);
    } else if (ctx.stack.length > 1) {
      reportErrorWithStackData("Constant resulted in multiple values", constant.loc, ctx, []);
    }

    constant.type = ctx.stack.pop()!;
  }

  private validateMemory(memory: Const) {
    const ctx = createContext();
    this.validateBody(memory.body, ctx);
    validateStack(
      memory.loc, ctx,
      [{ type: DataType.Int }],
      true
    );
  }

  public typecheck() {
    this.program.consts.forEach((constant) => this.validateConst(constant));
    this.program.memories.forEach((memory) => this.validateMemory(memory));
    this.program.procs.forEach((proc) => {
      if (!proc.unsafe) {
        this.validateProc(proc);
      }
    });
  }
}
