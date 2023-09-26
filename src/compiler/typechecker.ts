import { DataType, Location, TypeFrame, frameToString, Context, INTRINSICS, cloneContext, createContext, formatLoc } from "../shared";
import { AstKind, Const, Expr, LiteralType, Proc, Program, WordType } from "../parser";
import { Err, StckError } from "../errors";
import { assertNever } from "../util";
import chalk from "chalk";

function handleSignature(
  loc: Location, ctx: Context,
  ins: TypeFrame[], outs: TypeFrame[],
  strictLength: boolean = true,
  modifyStack: boolean = true,
  suffix: string = "",
  onErr: (err: StckError) => void = ()=>{}
) {
  const cmp = ctx.stack.slice(-ins.length);
  const generics = new Map<string, TypeFrame>();

  for (let i = 0; i < ins.length; i++) {
    if (cmp.length <= i) {
      const err = new StckError(Err.InsufficientStackTypes);
      generateTypeError(
        err, ctx, generics, 0,
        frameToString(insertGenerics(ins[i], generics)),
        i
      );

      err.addErr(loc, `missing ${
        ins.slice(ctx.stack.length)
          .map((x) => frameToString(insertGenerics(x, generics)))
          .join(", ")
      } ${suffix}`);

      onErr(err);
      err.throw();
    } else if (!typeFrameEquals(ins[i], cmp[i], generics)) {
      const err = new StckError(Err.UnexpectedStackTypes);
      generateTypeError(
        err, ctx, generics,
        ctx.stack.length - ins.length,
        frameToString(insertGenerics(ins[i], generics)),
        i
      );

      err.addErr(loc, `unexpected types ${suffix}`);
      onErr(err);
      err.throw();
    }
  }

  if (strictLength && ctx.stack.length > ins.length) {
    const err = new StckError(Err.UnhandledStackTypes);
    generateTypeError(err, ctx, generics, 0, "nothing", ins.length);

    err.addErr(loc, `unhandled types ${suffix}`);
    onErr(err);
    err.throw();
  }

  if (modifyStack) {
    ctx.stack.splice(-ins.length, ins.length);
    ctx.stackLocations.splice(-ins.length, ins.length);

    for (let i = 0; i < outs.length; i++) {
      ctx.stack.push(insertGenerics(outs[i], generics));
      ctx.stackLocations.push(loc);
    }
  }
}

function generateTypeError(
  err: StckError,
  ctx: Context, generics: Map<string, TypeFrame>,
  offset: number, expected: string, failedAt: number
) {
  for (let i = offset; i < ctx.stack.length; i++) {
    const frame = frameToString(insertGenerics(ctx.stack[i], generics));
    if (i == failedAt) {
      err.addWarn(ctx.stackLocations[i], `expected ${expected} but got ${frame}`);
    } else {
      err.addNote(ctx.stackLocations[i], `${frame} introduced here`);
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
        new StckError(Err.InvalidExpr)
          .addErr(expr.loc, "assembly blocks cannot be used in safe procedures")
          .addHint("you can add `unsafe` before the procedure to make it unsafe (not recommended)")
          .throw();
      } else {
        assertNever(expr.type);
      }
    } else if (expr.kind == AstKind.Word) {
      if (expr.value == "<dump-stack>") {
        console.log(chalk.cyan.bold("debug:"), "Current types on the stack");
        for (let i = 0; i < ctx.stack.length; i++) {
          console.log("..... ", chalk.bold(frameToString(ctx.stack[i])), "@", formatLoc(ctx.stackLocations[i]));
        }
      } else if (INTRINSICS.has(expr.value)) {
        const intrinsic = INTRINSICS.get(expr.value)!;
        expr.type = WordType.Intrinsic;
        handleSignature(
          expr.loc, ctx,
          intrinsic.ins, intrinsic.outs,
          false, true, "for the intrinsic call"
        );
      } else if (this.program.procs.has(expr.value)) {
        const proc = this.program.procs.get(expr.value)!;
        expr.type = WordType.Proc;
        handleSignature(
          expr.loc, ctx,
          proc.signature.ins, proc.signature.outs,
          false, true, "for the procedure call"
        );
      } else if (ctx.bindings.has(expr.value)) {
        expr.type = WordType.Binding;
        ctx.stack.push(ctx.bindings.get(expr.value)!);
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.consts.has(expr.value)) {
        const constant = this.program.consts.get(expr.value)!;
        if (constant.type.type == DataType.Unknown) {
          new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "the constant was used before it was defined")
            .throw();
        }

        expr.type = WordType.Constant;
        ctx.stack.push(constant.type);
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.memories.has(expr.value)) {
        expr.type = WordType.Memory;
        ctx.stack.push({ type: DataType.Ptr });
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.vars.has(expr.value)) {
        expr.type = WordType.Var;
        ctx.stack.push({
          type: DataType.PtrTo,
          value: this.program.vars.get(expr.value)!.type
        });
        ctx.stackLocations.push(expr.loc);
      } else {
        new StckError(Err.InvalidExpr)
          .addErr(expr.loc, "unknown word")
          .throw();
      }
    } else if (expr.kind == AstKind.If) {
      this.validateBody(expr.condition, ctx);
      handleSignature(
        expr.loc, ctx, [{ type: DataType.Bool }], [],
        false, true, "for the condition"
      );

      if (expr.elseBranch) {
        // if and else - both branches must result in the same types on the stack
        const clone = cloneContext(ctx);

        this.validateBody(expr.body, ctx);
        this.validateBody(expr.else, clone);

        handleSignature(
          expr.loc, clone, ctx.stack, [], true, false, "for the second branch of the condition",
          (err) => {
            err.addTrace(expr.elseBranch!, "second branch starts here");
            err.addStackElements(ctx, (f) => `${f} introduced here`);
            err.addHint("both branches of the condition must result in the same types on the stack");
          }
        );
      } else {
        // only if - the branch must not modify the amount of elements or their types on the stack
        const clone = cloneContext(ctx);
        this.validateBody(expr.body, clone);
        handleSignature(
          expr.loc, clone, ctx.stack, [], true, false, "after the condition",
          (err) => err.addHint("a condition with a single branch must not alter the types on the stack")
        );
      }
    } else if (expr.kind == AstKind.While) {
      const clone = cloneContext(ctx);
      this.validateBody(expr.condition, clone);
      handleSignature(
        expr.loc, clone,
        [{ type: DataType.Bool }], [],
        false, true, "for the condition of the loop"
      );

      this.validateBody(expr.body, clone);
      handleSignature(
        expr.loc, clone, ctx.stack, [], true, false,
        "after a single iteration of the loop",
        (err) => err.addHint("loops should not modify the amount of elements or their types on the stack")
      );
    } else if (expr.kind == AstKind.Let) {
      if (ctx.stack.length < expr.bindings.length) {
        new StckError(Err.InsufficientStackTypes)
          .addStackElements(ctx, (e) => `${e} introduced here`)
          .addErr(
            expr.loc,
            expr.bindings.length > 1
              ? `takes ${expr.bindings.length} elements but got ${ctx.stack.length}`
              : "takes an element but got nothing"
          ).throw();
      }

      for (let i = expr.bindings.length - 1; i >= 0; i--) {
        const binding = expr.bindings[i];

        if (ctx.bindings.has(binding)) {
          new StckError(Err.DuplicatedDefinition)
            .addErr(
              expr.loc,
              `\`${binding}\` is already bound to ${frameToString(ctx.bindings.get(binding)!)}`
            ).throw();
        } else {
          const frame = ctx.stack.pop()!;
          ctx.stackLocations.pop();
          ctx.bindings.set(binding, frame);
        }
      }

      this.validateBody(expr.body, ctx);
    } else if (expr.kind == AstKind.Cast) {
      if (ctx.stack.length < expr.types.length) {
        new StckError(Err.InsufficientStackTypes)
          .addStackElements(ctx, (e) => `${e} introduced here`)
          .addErr(
            expr.loc,
            expr.types.length > 1
              ? `casts ${expr.types.length} elements but got ${ctx.stack.length}`
              : "casts an element but got nothing"
          ).throw();
      }

      ctx.stack.splice(-expr.types.length, expr.types.length);
      ctx.stackLocations.splice(-expr.types.length, expr.types.length);

      for (const type of expr.types) {
        ctx.stack.push(type);
        ctx.stackLocations.push(type.loc!);
      }
    } else {
      assertNever(expr);
    }
  }

  /**
   * Unsafe procedures do not get typechecked, but we still to add some type data to them
   */
  private inferUnsafeBody(body: Expr[], bindings: Set<string>) {
    for (const expr of body) {
      if (expr.kind == AstKind.Word) {
        if (INTRINSICS.has(expr.value)) {
          expr.type = WordType.Intrinsic;
        } else if (bindings.has(expr.value)) {
          expr.type = WordType.Binding;
        } else if (this.program.procs.has(expr.value)) {
          expr.type = WordType.Proc;
        } else if (this.program.consts.has(expr.value)) {
          expr.type = WordType.Constant;
        } else if (this.program.memories.has(expr.value)) {
          expr.type = WordType.Memory;
        } else if (this.program.vars.has(expr.value)) {
          expr.type = WordType.Var;
        } else {
          new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "unknown word")
            .throw();
        }
      } else if (expr.kind == AstKind.If) {
        this.inferUnsafeBody(expr.condition, bindings);
        this.inferUnsafeBody(expr.body, bindings);
        this.inferUnsafeBody(expr.else, bindings);
      } else if (expr.kind == AstKind.While) {
        this.inferUnsafeBody(expr.condition, bindings);
        this.inferUnsafeBody(expr.body, bindings);
      } else if (expr.kind == AstKind.Let) {
        for (const binding of expr.bindings)
          bindings.add(binding);
        this.inferUnsafeBody(expr.body, bindings);
        for (const binding of expr.bindings)
          bindings.delete(binding);
      }
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
    handleSignature(proc.loc, ctx, proc.signature.outs, [], true, false, "after the procedure");
  }

  private validateConst(constant: Const) {
    const ctx = createContext();
    this.validateBody(constant.body, ctx);
    handleSignature(
      constant.loc, ctx,
      [{ type: DataType.Unknown }], [],
      true, false, "for the constant",
      (err) => err.addHint("constants must result in exactly one value")
    );

    constant.type = ctx.stack.pop()!;
  }

  private validateMemory(memory: Const) {
    const ctx = createContext();
    this.validateBody(memory.body, ctx);
    handleSignature(
      memory.loc, ctx,
      [{ type: DataType.Int }], [],
      true, false, "for the memory region"
    );
  }

  public typecheck() {
    this.program.consts.forEach((constant) => this.validateConst(constant));
    this.program.memories.forEach((memory) => this.validateMemory(memory));
    this.program.procs.forEach((proc) => {
      if (proc.unsafe) {
        this.inferUnsafeBody(proc.body, new Set());
      } else {
        this.validateProc(proc);
      }
    });
  }
}
