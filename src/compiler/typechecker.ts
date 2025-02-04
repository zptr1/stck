import { DataType, Location, TypeFrame, frameToString, Context, INTRINSICS, cloneContext, createContext, formatLoc } from "../shared";
import { Assert, AstKind, Const, Expr, LiteralType, Proc, Program, WordType } from "../parser";
import { Err, StckError } from "../errors";
import { assertNever } from "../misc";
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
      throw err;
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
      throw err;
    }
  }

  if (strictLength && ctx.stack.length > ins.length) {
    const err = new StckError(Err.UnhandledStackTypes);
    generateTypeError(err, ctx, generics, 0, "nothing", ins.length);

    err.addErr(loc, `unhandled types ${suffix}`);
    onErr(err);
    throw err;
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
  for (let i = Math.max(offset, 0); i < ctx.stack.length; i++) {
    const frame = frameToString(insertGenerics(ctx.stack[i], generics));
    if (i == failedAt) {
      err.addWarn(ctx.stackLocations[i], `got ${frame} but expected ${expected}`);
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
    };
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
      } else if (expr.type == LiteralType.Int || expr.type == LiteralType.BigInt) {
        ctx.stack.push({ type: DataType.Int });
      } else if (expr.type == LiteralType.Assembly) {
        throw new StckError(Err.InvalidExpr)
          .addErr(expr.loc, "assembly blocks cannot be used in safe procedures")
          .addHint("you can add `unsafe` before the procedure to make it unsafe (not recommended)");
      } else {
        assertNever(expr.type);
      }
    } else if (expr.kind == AstKind.Word) {
      const name = expr.value;

      if (name == "<dump-stack>") {
        expr.type = WordType.Intrinsic;
        console.log(chalk.cyan.bold("debug:"), "Current types on the stack");
        for (let i = 0; i < ctx.stack.length; i++) {
          console.log("..... ", chalk.bold(frameToString(ctx.stack[i])), "@", formatLoc(ctx.stackLocations[i]));
        }
      } else if (expr.type == WordType.Return) {
        if (ctx.returnTypes) {
          expr.type = WordType.Return;
          handleSignature(expr.loc, ctx, ctx.returnTypes, [], true, false, "after the procedure");
        } else {
          throw new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "cannot use return here");
        }
      } else if (INTRINSICS.has(name)) {
        const intrinsic = INTRINSICS.get(name)!;
        expr.type = WordType.Intrinsic;
        handleSignature(
          expr.loc, ctx,
          intrinsic.ins, intrinsic.outs,
          false, true, "for the intrinsic call"
        );
      } else if (ctx.bindings.has(name)) {
        expr.type = WordType.Binding;
        ctx.stack.push(ctx.bindings.get(name)!);
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.procs.has(name)) {
        const proc = this.program.procs.get(name)!;
        expr.type = WordType.Proc;
        handleSignature(
          expr.loc, ctx,
          proc.signature.ins, proc.signature.outs,
          false, true, "for the procedure call"
        );
      } else if (this.program.externs.has(name)) {
        const extern = this.program.externs.get(name)!;
        expr.type = WordType.Extern;
        handleSignature(
          expr.loc, ctx,
          extern.signature.ins, extern.signature.outs,
          false, true, "for the extern call"
        );
      } else if (this.program.consts.has(name)) {
        const constant = this.program.consts.get(name)!;
        if (constant.type.type == DataType.Unknown) {
          throw new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "the constant was used before it was defined");
        }

        expr.type = WordType.Constant;
        ctx.stack.push(constant.type);
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.memories.has(name)) {
        expr.type = WordType.Memory;
        ctx.stack.push({ type: DataType.Ptr });
        ctx.stackLocations.push(expr.loc);
      } else if (this.program.vars.has(name)) {
        expr.type = WordType.Var;
        ctx.stack.push({
          type: DataType.PtrTo,
          value: this.program.vars.get(name)!.type
        });
        ctx.stackLocations.push(expr.loc);
      } else {
        throw new StckError(Err.InvalidExpr)
          .addErr(expr.loc, "unknown word");
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
          expr.elseBranch, clone, ctx.stack, [], true, false,
          "for the second branch of the condition",
          (err) => {
            err.addTrace(expr.loc, "condition starts here");
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
        (err) => err.addHint("loops should not alter the types on the stack")
      );
    } else if (expr.kind == AstKind.Let) {
      if (ctx.stack.length < expr.bindings.length) {
        throw new StckError(Err.InsufficientStackTypes)
          .addStackElements(ctx, (e) => `${e} introduced here`)
          .addErr(
            expr.loc,
            expr.bindings.length > 1
              ? `takes ${expr.bindings.length} elements but got ${ctx.stack.length}`
              : "takes an element but got nothing"
          );
      }

      for (let i = expr.bindings.length - 1; i >= 0; i--) {
        const binding = expr.bindings[i];

        if (ctx.bindings.has(binding)) {
          throw new StckError(Err.DuplicatedDefinition)
            .addErr(
              expr.loc,
              `\`${binding}\` is already bound to ${frameToString(ctx.bindings.get(binding)!)}`
            );
        } else {
          const frame = ctx.stack.pop()!;
          ctx.stackLocations.pop();
          ctx.bindings.set(binding, frame);
        }
      }

      this.validateBody(expr.body, ctx);
    } else if (expr.kind == AstKind.Cast) {
      if (ctx.stack.length < expr.types.length) {
        throw new StckError(Err.InsufficientStackTypes)
          .addStackElements(ctx, (e) => `${e} introduced here`)
          .addErr(
            expr.loc,
            expr.types.length > 1
              ? `casts ${expr.types.length} elements but got ${ctx.stack.length}`
              : "casts an element but got nothing"
          );
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
        if (INTRINSICS.has(expr.value)) expr.type = WordType.Intrinsic;
        else if (bindings.has(expr.value)) expr.type = WordType.Binding;
        else if (this.program.procs.has(expr.value)) expr.type = WordType.Proc;
        else if (this.program.consts.has(expr.value)) expr.type = WordType.Constant;
        else if (this.program.memories.has(expr.value)) expr.type = WordType.Memory;
        else if (this.program.vars.has(expr.value)) expr.type = WordType.Var;
        else if (this.program.externs.has(expr.value)) expr.type = WordType.Extern;
        else {
          throw new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "unknown word");
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
    const ctx = createContext(proc);
    if (!proc.inline) {
      ctx.returnTypes = proc.signature.outs;
    }

    if (proc.name == "main") {
      if (proc.inline) {
        throw new StckError(Err.InvalidProc)
          .addErr(proc.loc, "the main procedure cannot be inlined");
      } else if (proc.signature.ins.length) {
        throw new StckError(Err.InvalidProc)
          .addWarn(proc.signature.ins[0].loc!, "cannot accept anything")
          .addErr(proc.loc, "invalid signature for the main procedure");
      } else if (proc.signature.outs.length && proc.signature.outs[0].type != DataType.Int) {
        throw new StckError(Err.InvalidProc)
          .addWarn(proc.signature.outs[0].loc!, `expected int but got ${frameToString(proc.signature.outs[0])}`)
          .addErr(proc.loc, "invalid signature for the main procedure");
      } else if (proc.signature.outs.length > 1) {
        throw new StckError(Err.InvalidProc)
        .addWarn(proc.signature.outs[1].loc!, "cannot return more than 1 value")
        .addErr(proc.loc, "invalid signature for the main procedure");
      }
    }

    for (const frame of proc.signature.ins) {
      ctx.stack.push(frame);
      ctx.stackLocations.push(frame.loc ?? proc.loc);
    }

    this.validateBody(proc.body, ctx);
    handleSignature(proc.loc, ctx, proc.signature.outs, [], true, false, "after the procedure");
  }

  private validateConst(constant: Const) {
    const ctx = createContext(constant);
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
    const ctx = createContext(memory);
    this.validateBody(memory.body, ctx);
    handleSignature(
      memory.loc, ctx,
      [{ type: DataType.Int }], [],
      true, false, "for the memory region"
    );
  }

  private validateAssert(assert: Assert) {
    const ctx = createContext(assert);
    this.validateBody(assert.body, ctx);
    handleSignature(
      assert.loc, ctx,
      [{ type: DataType.Bool }], [],
      true, false,
      "for the assertion"
    );
  }

  public typecheck() {
    this.program.consts.forEach((constant) => this.validateConst(constant));
    this.program.assertions.forEach((assert) => this.validateAssert(assert));
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
