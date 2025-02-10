import { Assert, AstKind, Const, Expr, LiteralType, Proc, Program, WordType } from "../parser";
import { INTRINSICS, Instr, Instruction, Location, Size, formatLoc } from "../shared";
import { IRContext, IRProc, IRProgram, createContext } from "./ir";
import { i32_MAX, i32_MIN, assertNever } from "../misc";
import { Err, StckError } from "../errors";
import chalk from "chalk";

export class Compiler {
  public readonly procs = new Map<number, IRProc>();
  public readonly consts = new Map<string, bigint | null>();
  public readonly memories = new Map<string, number>();

  private readonly stringIds = new Map<string, number>();
  private readonly procIds = new Map<string, number>()
    .set("<load>", 0)
    .set("main", 1);
  
  private readonly compiledProcs = new Set<string>();
  private readonly compileProcQueue: string[] = [];
  
  private readonly extern = new Set<string>();
  private readonly libraries = new Set<string>();

  private memorySize: number = 0;

  constructor (
    public readonly program: Program
  ) {}

  private getProcId(name: string): number {
    if (!this.procIds.has(name))
      this.procIds.set(name, this.procIds.size);
    return this.procIds.get(name)!;
  }

  private getStrId(str: string): number {
    if (!this.stringIds.has(str))
      this.stringIds.set(str, this.stringIds.size);
    return this.stringIds.get(str)!;
  }

  private offsetCounter: bigint = 0n;
  private evaluate(loc: Location, instructions: Instruction[]): any {
    const stack: bigint[] = [];
    const infix = (cb: (lhs: bigint, rhs: bigint) => bigint) => {
      const rhs = stack.pop()!, lhs = stack.pop()!;
      return cb(lhs, rhs);
    }

    // TODO: make this nicer
    for (const instr of instructions) {
      if (instr.kind == Instr.Push || instr.kind == Instr.PushBigInt) {
        stack.push(BigInt(instr.value));
      } else if (instr.kind == Instr.Add) stack.push(stack.pop()! + stack.pop()!);
      else if (instr.kind == Instr.Mul) stack.push(stack.pop()! * stack.pop()!);
      else if (instr.kind == Instr.Eq) stack.push(BigInt(stack.pop()! == stack.pop()!));
      else if (instr.kind == Instr.Neq) stack.push(BigInt(stack.pop()! != stack.pop()!));
      else if (instr.kind == Instr.Sub) stack.push(infix((a, b) => a - b));
      else if (instr.kind == Instr.Lt) stack.push(infix((a, b) => BigInt(a < b)));
      else if (instr.kind == Instr.Gt) stack.push(infix((a, b) => BigInt(a > b)));
      else if (instr.kind == Instr.LtEq) stack.push(infix((a, b) => BigInt(a <= b)));
      else if (instr.kind == Instr.GtEq) stack.push(infix((a, b) => BigInt(a >= b)));
      else if (instr.kind == Instr.Shl) stack.push(infix((a, b) => a << b));
      else if (instr.kind == Instr.Shr) stack.push(infix((a, b) => a >> b));
      else if (instr.kind == Instr.And) stack.push(infix((a, b) => a & b));
      else if (instr.kind == Instr.Or) stack.push(infix((a, b) => a | b));
      else if (instr.kind == Instr.Xor) stack.push(infix((a, b) => a ^ b));
      else if (instr.kind == Instr.Not) stack.push(~stack.pop()!);
      else if (instr.kind == Instr.Drop) stack.pop();
      else if (instr.kind == Instr.Swap) stack.push(stack.pop()!, stack.pop()!);
      else if (instr.kind == Instr.DivMod) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs / rhs, lhs % rhs);
      } else if (instr.kind == Instr.Dup) {
        const a = stack.pop()!;
        stack.push(a, a);
      } else if (instr.kind == Instr.Offset) {
        const val = this.offsetCounter;
        this.offsetCounter += stack.pop()!;
        stack.push(val);
      } else if (instr.kind == Instr.Reset) {
        stack.push(this.offsetCounter);
        this.offsetCounter = 0n;
      } else if (instr.kind == Instr.Print) {
        console.log(chalk.cyan.bold("comptime:"), chalk.yellow.bold(stack.pop()), chalk.dim("@", formatLoc(loc)));
      } else if (instr.kind == Instr.PushAddr) {
        throw new StckError(Err.InvalidComptime)
          .addErr(loc, "memories are not allowed here");
      } else if (instr.kind == Instr.Call) {
        throw new StckError(Err.InvalidComptime)
          .addErr(loc, "procedure calls are not allowed here");
      } else {
        throw new StckError(Err.InvalidComptime)
          .addErr(loc, `cannot use ${Instr[instr.kind]} here`);
      }
    }

    return stack.pop();
  }

  private evalBody(body: Expr[], loc: Location) {
    const instr: Instruction[] = [];
    this.compileBody(body, instr, createContext());

    return this.evaluate(loc, instr);
  }

  // TODO: automatically inline procedures that were used only once or are too small
  private inlineProc(proc: Proc, expr: Expr, out: Instruction[], ctx: IRContext) {
    const idx = ctx.inlineExpansionStack.findIndex((x) => x.name == proc.name);
    if (idx > -1) {
      const err = new StckError(Err.RecursiveInlineProcExpansion);
      for (let i = idx; i < ctx.inlineExpansionStack.length; i++) {
        const expansion = ctx.inlineExpansionStack[i];
        if (expansion.name == proc.name) {
          err.addNote(expansion.loc, `first expansion of ${proc.name}`);
        } else {
          err.addTrace(expansion.loc, `${ctx.inlineExpansionStack[i - 1]?.name} lead to this expansion`);
        }
      }

      err.addErr(expr.loc, `${proc.name} expanded again here`);
      throw err;
    }

    ctx.inlineExpansionStack.push({
      loc: expr.loc,
      name: proc.name
    });

    this.compileBody(proc.body, out, ctx);
    ctx.inlineExpansionStack.pop();
  }

  private compileBody(body: Expr[], out: Instruction[], ctx: IRContext) {
    for (const expr of body) {
      if (expr.kind == AstKind.Literal) {
        if (expr.type == LiteralType.Str) {
          out.push({
            kind: Instr.PushStr,
            id: this.getStrId(expr.value + "\x00"),
            len: new TextEncoder().encode(expr.value).length
          });
        } else if (expr.type == LiteralType.CStr) {
          out.push({
            kind: Instr.PushStr,
            id: this.getStrId(expr.value + "\x00"),
            len: -1
          });
        } else if (expr.type == LiteralType.Int) {
          out.push(
            expr.value > i32_MAX || expr.value < i32_MIN ? {
              kind: Instr.PushBigInt,
              value: expr.value
            } : {
              kind: Instr.Push,
              size: Size.Long,
              value: expr.value
            }
          );
        } else if (expr.type == LiteralType.Assembly) {
          out.push({
            kind: Instr.AsmBlock,
            value: expr.value
          });
        } else {
          assertNever(expr.type);
        }
      } else if (expr.kind == AstKind.Word) {
        if (expr.type == WordType.Intrinsic) {
          const intrinsic = INTRINSICS.get(expr.value)!;
          if (intrinsic.instr != Instr.Nop) {
            out.push({ kind: intrinsic.instr } as any);
          }
        } else if (expr.type == WordType.Proc) {
          const proc = this.program.procs.get(expr.value)!;
          if (proc.name == "<load>") {
            throw new StckError(Err.InvalidExpr)
              .addErr(expr.loc, "cannot call this procedure")
              .addHint("<load> is a special procedure and cannot be called");
          } else if (proc.inline) {
            this.inlineProc(proc, expr, out, ctx);
          } else {
            if (!this.compiledProcs.has(expr.value)) {
              this.compileProcQueue.push(expr.value);
            }

            out.push({
              kind: Instr.Call,
              id: this.getProcId(expr.value)
            });
          }
        } else if (expr.type == WordType.Extern) {
          const extern = this.program.externs.get(expr.value)!;
          
          this.extern.add(extern.symbol);
          this.libraries.add(extern.library);

          out.push({
            kind: Instr.CallExtern,
            name: extern.symbol,
            argc: extern.signature.ins.length,
            hasOutput: extern.signature.outs.length > 0
          });
        } else if (expr.type == WordType.Constant) {
          const value = this.consts.get(expr.value)!;
          out.push(
            value > i32_MAX || value < i32_MIN ? {
              kind: Instr.PushBigInt,
              value
            } : {
              kind: Instr.Push,
              size: Size.Long,
              value,
            }
          );
        } else if (expr.type == WordType.Memory) {
          if (!this.memories.has(expr.value))
            this.compileMemory(this.program.memories.get(expr.value)!);

          out.push({
            kind: Instr.PushAddr,
            offset: this.memories.get(expr.value)!
          });
        } else if (expr.type == WordType.LocalMemory) {
          out.push({
            kind: Instr.PushLocalAddr,
            offset: ctx.memories.get(expr.value)!
          });
        } else if (expr.type == WordType.Binding) {
          out.push({
            kind: Instr.PushLocal,
            offset: ctx.bindings.get(expr.value)! * 8
          });
        } else if (expr.type == WordType.Var) {
          const variable = this.program.vars.get(expr.value)!;
          if (!this.memories.has(variable.name)) {
            this.memories.set(variable.name, this.memorySize);
            this.memorySize += variable.size;
          }

          out.push({
            kind: Instr.PushAddr,
            offset: this.memories.get(variable.name)!
          });
        } else if (expr.type == WordType.Unknown) {
          throw new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "unknown word")
            .addHint("likely a compiler bug?");
        } else if (expr.type == WordType.Return) {
          if (ctx.memorySize) {
            out.push({ kind: Instr.Dealloc, size: ctx.memorySize });
          }

          out.push({ kind: Instr.Ret });
        } else {
          assertNever(expr.type);
        }
      } else if (expr.kind == AstKind.If) {
        this.compileBody(expr.condition, out, ctx);

        const L1 = ctx.labelCount++;
        out.push({
          kind: Instr.JmpIfNot,
          label: L1
        });

        this.compileBody(expr.body, out, ctx);

        if (expr.else.length) {
          const L2 = ctx.labelCount++;
          out.push(
            { kind: Instr.Jmp, label: L2 },
            { kind: Instr.Label, label: L1 },
          );

          this.compileBody(expr.else, out, ctx);
          out.push({
            kind: Instr.Label,
            label: L2
          });
        } else {
          out.push({
            kind: Instr.Label,
            label: L1
          });
        }
      } else if (expr.kind == AstKind.Loop) {
        const L1 = ctx.labelCount++;
        const L2 = ctx.labelCount++;

        out.push({ kind: Instr.Label, label: L1 });

        this.compileBody(expr.condition, out, ctx);
        out.push({ kind: Instr.JmpIfNot, label: L2 });

        this.compileBody(expr.body, out, ctx);
        out.push(
          { kind: Instr.Jmp, label: L1 },
          { kind: Instr.Label, label: L2 },
        );
      } else if (expr.kind == AstKind.Binding) {
        for (const [binding, idx] of ctx.bindings)
          ctx.bindings.set(binding, idx + expr.bindings.length);

        for (let i = 0; i < expr.bindings.length; i++)
          ctx.bindings.set(expr.bindings[i], i);

        out.push({
          kind: Instr.Bind,
          count: expr.bindings.length
        });

        this.compileBody(expr.body, out, ctx);

        out.push({
          kind: Instr.Dealloc,
          size: expr.bindings.length * 8
        });

        for (const binding of expr.bindings) ctx.bindings.delete(binding);
        for (const [binding, idx] of ctx.bindings) {
          ctx.bindings.set(binding, idx - expr.bindings.length);
        }
      } else if (expr.kind != AstKind.Cast) {
        assertNever(expr);
      }
    }
  }

  private compileProc(proc: Proc) {
    if (this.compiledProcs.has(proc.name))
      return;

    this.compiledProcs.add(proc.name);

    const instr: Instruction[] = [];
    const id = this.getProcId(proc.name);
    const ctx = createContext();

    if (proc.memories.size) {
      for (const memory of proc.memories.values()) {
        const size = Number(this.evalBody(memory.body, memory.loc));
        if (size < 1 || size > 1e8) {
          throw new StckError(Err.InvalidComptime)
            .addErr(memory.loc, "invalid memory size");
        }
        
        ctx.memories.set(memory.name, ctx.memorySize);
        ctx.memorySize += size;
      }

      instr.push({ kind: Instr.Alloc, size: ctx.memorySize });
    }

    this.compileBody(proc.body, instr, ctx);

    if (ctx.memorySize) {
      instr.push({ kind: Instr.Dealloc, size: ctx.memorySize });
    }

    if (proc.name == "main" && !proc.signature.outs.length) {
      // the typechecker forces the main procedure to return either nothing or an integer
      // the integer on top of the stack is used as an exit code, so we need to push 0 if no exit code is provided
      instr.push({
        kind: Instr.Push,
        size: Size.Long,
        value: 0n
      });
    }

    instr.push({ kind: Instr.Ret });
    this.procs.set(id, {
      name: proc.name, loc: proc.loc,
      argc: proc.signature.ins.length,
      retc: proc.signature.outs.length,
      instr
    });
  }

  private compileConst(constant: Const) {
    this.consts.set(constant.name, null);
    this.consts.set(constant.name, this.evalBody(constant.body, constant.loc));
  }

  private compileMemory(memory: Const) {
    const size = Number(this.evalBody(memory.body, memory.loc));
    if (size < 1 || size > 1e8) {
      throw new StckError(Err.InvalidComptime)
        .addErr(memory.loc, "invalid memory size");
    }
    
    this.memories.set(memory.name, this.memorySize);
    this.memorySize += size;
  }

  private compileAssert(assert: Assert) {
    if (!this.evalBody(assert.body, assert.loc)) {
      throw new StckError(Err.AssertionFailed)
        .addErr(assert.loc, assert.message);
    }
  }

  public compile(): IRProgram {
    if (!this.program.procs.has("main")) {
      throw new StckError(Err.NoMainProcedure);
    }

    this.program.consts.forEach((constant) => this.compileConst(constant));
    this.program.assertions.forEach((assert) => this.compileAssert(assert));

    this.compileProc(this.program.procs.get("<load>")!);
    this.compileProc(this.program.procs.get("main")!);

    while (this.compileProcQueue.length) {
      this.compileProc(this.program.procs.get(this.compileProcQueue.shift()!)!);
    }

    return {
      procs: this.procs,
      strings: Array.from(this.stringIds.keys()),
      libraries: Array.from(this.libraries),
      extern: Array.from(this.extern),
      memorySize: this.memorySize,
    };
  }
}