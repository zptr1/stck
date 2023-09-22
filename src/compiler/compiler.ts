import { AstKind, Const, Expr, LiteralType, Proc, Program, WordType } from "../parser";
import { INTRINSICS, Instr, Instruction, Location, formatLoc, frameToString, sizeOf } from "../shared";
import { CompilerContext, IRProgram, createContext } from "./ir";
import { i32_MAX, i32_MIN, i64_MAX, i64_MIN } from "../const";
import { Err, StckError } from "../errors";
import { assertNever } from "../util";
import chalk from "chalk";

export class Compiler {
  public readonly instr: Instruction[] = [];
  public readonly consts: Map<string, bigint | null> = new Map();
  public readonly memories: Map<string, number> = new Map();
  public readonly strings: Map<string, number> = new Map();

  private readonly labels: Map<number, number> = new Map();
  private readonly compiledProcs: Set<string> = new Set();
  private readonly compileProcQueue: string[] = [];
  private memoryOffset: number = 0;

  constructor (
    public readonly program: Program
  ) {}

  private label(id?: number): number {
    if (id == undefined) {
      this.labels.set(this.labels.size, -1);
      return this.labels.size;
    } else {
      this.labels.set(id, this.instr.length);
      this.instr.push({
        kind: Instr.Label,
        label: id
      });

      return id;
    }
  }

  private cexprCounter: bigint = 0n;

  private evaluate(loc: Location, instructions: Instruction[]): any {
    const stack: bigint[] = [];

    for (const instr of instructions) {
      if (instr.kind == Instr.Push || instr.kind == Instr.Push64) {
        stack.push(BigInt(instr.value));
      } else if (instr.kind == Instr.Add) {
        stack.push(stack.pop()! + stack.pop()!);
      } else if (instr.kind == Instr.Mul) {
        stack.push(stack.pop()! * stack.pop()!);
      } else if (instr.kind == Instr.Eq) {
        stack.push(BigInt(stack.pop()! == stack.pop()!));
      } else if (instr.kind == Instr.Neq) {
        stack.push(BigInt(stack.pop()! != stack.pop()!));
      } else if (instr.kind == Instr.Sub) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs - rhs);
      } else if (instr.kind == Instr.DivMod) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs / rhs, lhs % rhs);
      } else if (instr.kind == Instr.Lt) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs < rhs));
      } else if (instr.kind == Instr.Gt) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs > rhs));
      } else if (instr.kind == Instr.LtEq) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs <= rhs));
      } else if (instr.kind == Instr.GtEq) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs >= rhs));
      } else if (instr.kind == Instr.Shl) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs << rhs);
      } else if (instr.kind == Instr.Shr) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs >> rhs);
      } else if (instr.kind == Instr.And) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs & rhs);
      } else if (instr.kind == Instr.Or) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs | rhs);
      } else if (instr.kind == Instr.Xor) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs ^ rhs);
      } else if (instr.kind == Instr.Not) {
        stack.push(~stack.pop()!);
      } else if (instr.kind == Instr.Drop) {
        stack.pop();
      } else if (instr.kind == Instr.Swap) {
        stack.push(stack.pop()!, stack.pop()!);
      } else if (instr.kind == Instr.Dup) {
        const a = stack.pop()!;
        stack.push(a, a);
      } else if (instr.kind == Instr._CExpr__Offset) {
        const val = this.cexprCounter;
        this.cexprCounter += stack.pop()!;
        stack.push(val);
      } else if (instr.kind == Instr._CExpr__Reset) {
        stack.push(this.cexprCounter);
        this.cexprCounter = 0n;
      } else if (instr.kind == Instr.Print) {
        console.log(chalk.cyan.bold("debug:"), chalk.yellow(stack.pop()), "@", formatLoc(loc), "(comptime expr)");
      } else if (instr.kind == Instr.PushMem) {
        new StckError("invalid compile-time expression")
          .add(Err.Error, loc, "memories are not allowed here")
          .throw();
      } else if (instr.kind == Instr.Call) {
        new StckError("invalid compile-time expression")
          .add(Err.Error, loc, "procedure calls are not allowed here")
          .throw();
      } else {
        new StckError("invalid compile-time expression")
          .add(Err.Error, loc, `cannot use ${Instr[instr.kind]} here`)
          .throw();
      }
    }

    return stack.pop();
  }

  private compileExpr(expr: Expr, ctx: CompilerContext, out: Instruction[]) {
    if (expr.kind == AstKind.Literal) {
      if (expr.type == LiteralType.Str) {
        if (!this.strings.has(expr.value))
          this.strings.set(expr.value, this.strings.size);

        out.push({
          kind: Instr.PushStr,
          id: this.strings.get(expr.value)!,
          len: expr.value.length
        });
      } else if (expr.type == LiteralType.CStr) {
        expr.value += "\x00";
        if (!this.strings.has(expr.value))
          this.strings.set(expr.value, this.strings.size);

        out.push({
          kind: Instr.PushStr,
          id: this.strings.get(expr.value)!,
          // Empty strings are disallowed by the lexer,
          // so we can use this trick to tell that it is a C-string
          // without a separate instruction type
          len: 0
        });
      } else if (expr.type == LiteralType.Int) {
        if (expr.value > i32_MAX || expr.value < i32_MIN) {
          if (expr.value > i64_MAX || expr.value < i64_MIN) {
            new StckError("invalid literal")
              .add(Err.Error, expr.loc, `the integer is too big for i64`)
              .throw();
          }

          out.push({
            kind: Instr.Push64,
            value: BigInt(expr.value)
          });
        } else {
          out.push({
            kind: Instr.Push,
            value: Number(expr.value)
          });
        }
      } else if (expr.type == LiteralType.Bool) {
        out.push({
          kind: Instr.Push,
          value: expr.value ? 1 : 0
        });
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
        if (proc.inline) {
          const idx = ctx.inlineExpansionStack.findIndex((x) => x.name == proc.name);
          if (idx > -1) {
            const err = new StckError("recursive inline procedure expansion");
            for (let i = idx; i < ctx.inlineExpansionStack.length; i++) {
              const expansion = ctx.inlineExpansionStack[i];
              if (expansion.name == proc.name) {
                err.add(Err.Note, expansion.loc, `first expansion of ${proc.name}`);
              } else {
                err.add(Err.Trace, expansion.loc, `${ctx.inlineExpansionStack[i - 1]?.name} lead to this expansion`);
              }
            }

            err.add(Err.Error, expr.loc, `${proc.name} expanded again here`);
            err.throw();
          }

          ctx.inlineExpansionStack.push({
            loc: expr.loc,
            name: proc.name
          });

          this.compileBody(proc.body, out, ctx);
          ctx.inlineExpansionStack.pop();
        } else {
          if (!this.compiledProcs.has(expr.value)) {
            this.compileProcQueue.push(expr.value);
          }

          out.push({
            kind: Instr.Call,
            name: expr.value
          });
        }
      } else if (expr.type == WordType.Constant) {
        const value = this.consts.get(expr.value)!;
        if (value < i32_MAX && value > i32_MIN) {
          out.push({
            kind: Instr.Push,
            value: Number(value)
          });
        } else {
          out.push({
            kind: Instr.Push64,
            value
          })
        }
      } else if (expr.type == WordType.Memory) {
        if (!this.memories.has(expr.value))
          this.compileMemory(this.program.memories.get(expr.value)!);

        out.push({
          kind: Instr.PushMem,
          offset: this.memories.get(expr.value)!
        });
      } else if (expr.type == WordType.Binding) {
        out.push({
          kind: Instr.PushBind,
          element: ctx.bindings.get(expr.value)!
        });
      } else if (expr.type == WordType.Var) {
        const variable = this.program.vars.get(expr.value)!;
        if (!this.memories.has(variable.name)) {
          this.memories.set(variable.name, this.memoryOffset);
          this.memoryOffset += variable.size;
        }

        out.push({
          kind: Instr.PushMem,
          offset: this.memories.get(variable.name)!
        });
      } else if (expr.type != WordType.Unknown) {
        assertNever(expr.type);
      }
    } else if (expr.kind == AstKind.If) {
      this.compileBody(expr.condition, out, ctx);

      const L1 = this.label();
      out.push({
        kind: Instr.JmpIfNot,
        label: L1
      });

      this.compileBody(expr.body, out, ctx);

      if (expr.else.length) {
        const L2 = this.label();
        out.push({
          kind: Instr.Jmp,
          label: L2
        });
        this.label(L1);

        this.compileBody(expr.else, out, ctx);
        this.label(L2);
      } else {
        this.label(L1);
      }
    } else if (expr.kind == AstKind.While) {
      const L1 = this.label();
      const L2 = this.label();
      this.label(L1);

      this.compileBody(expr.condition, out, ctx);
      out.push({
        kind: Instr.JmpIfNot,
        label: L2
      });
      this.compileBody(expr.body, out, ctx);
      out.push({
        kind: Instr.Jmp,
        label: L1
      });
      this.label(L2);
    } else if (expr.kind == AstKind.Let) {
      for (const binding of expr.bindings) {
        ctx.bindings.set(binding, ctx.bindings.size);
      }

      out.push({
        kind: Instr.Bind,
        count: expr.bindings.length
      });

      this.compileBody(expr.body, out, ctx);

      out.push({
        kind: Instr.Unbind,
        count: expr.bindings.length
      });

      for (const binding of expr.bindings) {
        ctx.bindings.delete(binding);
      }
    } else if (expr.kind != AstKind.Cast) {
      assertNever(expr);
    }
  }

  private compileBody(body: Expr[], out: Instruction[], ctx: CompilerContext) {
    for (const expr of body)
      this.compileExpr(expr, ctx, out);
  }

  private compileProc(proc: Proc) {
    if (this.compiledProcs.has(proc.name))
      return;

    this.compiledProcs.add(proc.name);
    this.instr.push({
      kind: Instr.EnterProc,
      name: proc.name
    });

    this.compileBody(proc.body, this.instr, createContext(proc.loc));
    this.instr.push({ kind: Instr.Ret });
  }

  private compileConst(constant: Const) {
    const instr: Instruction[] = [];
    this.consts.set(constant.name, null);
    this.compileBody(constant.body, instr, createContext(constant.loc));
    this.consts.set(constant.name, this.evaluate(constant.loc, instr));
  }

  private compileMemory(memory: Const) {
    const instr: Instruction[] = [];
    this.memories.set(memory.name, this.memoryOffset);
    this.compileBody(memory.body, instr, createContext(memory.loc));
    const size = Number(this.evaluate(memory.loc, instr));
    if (size < 1 || !Number.isSafeInteger(size)) {
      new StckError("invalid compile-time expression")
        .add(Err.Error, memory.loc, "invalid memory size")
        .throw();
    }

    this.memoryOffset += size;
  }

  public compile(): IRProgram {
    const proc = this.program.procs.get("main");
    if (!proc) {
      throw new Error("no main procedure");
    }

    this.program.consts.forEach((constant) => {
      this.compileConst(constant);
    });

    this.compileProc(proc);
    while (this.compileProcQueue.length) {
      this.compileProc(this.program.procs.get(this.compileProcQueue.shift()!)!);
    }

    return {
      instr: this.instr,
      strings: this.strings,
      memorySize: this.memoryOffset
    }
  }
}