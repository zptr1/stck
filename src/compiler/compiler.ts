import { AstKind, Const, Expr, LiteralType, Proc, Program, WordType } from "../parser";
import { INTRINSICS, Instr, Instruction, Location, formatLoc } from "../shared";
import { i32_MAX, i32_MIN, i64_MAX, i64_MIN, assertNever } from "..";
import { CompilerContext, IRProgram, createContext } from "./ir";
import { Err, StckError } from "../errors";
import chalk from "chalk";

export class Compiler {
  public readonly procs = new Map<number, Instruction[]>();
  public readonly consts = new Map<string, bigint | null>();
  public readonly memories = new Map<string, number>();

  private readonly stringIds = new Map<string, number>();
  private readonly procIds = new Map<string, number>();

  private readonly compiledProcs = new Set<string>();
  private readonly compileProcQueue: string[] = [];
  private memoryOffset: number = 0;

  constructor (
    public readonly program: Program
  ) {}

  private getProcId(name: string): number {
    if (!this.procIds.has(name))
      this.procIds.set(name, this.procIds.size);
    return this.procIds.get(name)!;
  }

  private offsetCounter: bigint = 0n;
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
        const val = this.offsetCounter;
        this.offsetCounter += stack.pop()!;
        stack.push(val);
      } else if (instr.kind == Instr._CExpr__Reset) {
        stack.push(this.offsetCounter);
        this.offsetCounter = 0n;
      } else if (instr.kind == Instr.Print) {
        console.log(chalk.cyan.bold("comptime:"), chalk.yellow.bold(stack.pop()), chalk.dim("@", formatLoc(loc)));
      } else if (instr.kind == Instr.PushMem) {
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

  private compileBody(body: Expr[], out: Instruction[], ctx: CompilerContext) {
    for (const expr of body) {
      if (expr.kind == AstKind.Literal) {
        if (expr.type == LiteralType.Str) {
          if (!this.stringIds.has(expr.value))
            this.stringIds.set(expr.value, this.stringIds.size);

          out.push({
            kind: Instr.PushStr,
            id: this.stringIds.get(expr.value)!,
            len: expr.value.length
          });
        } else if (expr.type == LiteralType.CStr) {
          expr.value += "\x00";
          if (!this.stringIds.has(expr.value))
            this.stringIds.set(expr.value, this.stringIds.size);

          out.push({
            kind: Instr.PushStr,
            id: this.stringIds.get(expr.value)!,
            len: -1
          });
        } else if (expr.type == LiteralType.Int) {
          if (expr.value > i32_MAX || expr.value < i32_MIN) {
            out.push({
              kind: Instr.Push64,
              value: expr.value
            });
          } else {
            out.push({
              kind: Instr.Push,
              value: expr.value
            });
          }
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
          } else {
            if (!this.compiledProcs.has(expr.value)) {
              this.compileProcQueue.push(expr.value);
            }

            out.push({
              kind: Instr.Call,
              id: this.getProcId(expr.value)
            });
          }
        } else if (expr.type == WordType.Constant) {
          const value = this.consts.get(expr.value)!;
          if (value > i32_MAX || value < i32_MIN) {
            out.push({
              kind: Instr.Push64,
              value
            })
          } else {
            out.push({
              kind: Instr.Push,
              value: value
            });
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
            kind: Instr.PushLocal,
            offset: ctx.bindings.get(expr.value)! * 8
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
        } else if (expr.type == WordType.Unknown) {
          throw new StckError(Err.InvalidExpr)
            .addErr(expr.loc, "unknown word")
            .addHint("likely a compiler bug?");
        } else if (expr.type == WordType.Return) {
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
      } else if (expr.kind == AstKind.While) {
        const L1 = ctx.labelCount++;
        const L2 = ctx.labelCount++;
        out.push({
          kind: Instr.Label,
          label: L1
        });

        this.compileBody(expr.condition, out, ctx);
        out.push({
          kind: Instr.JmpIfNot,
          label: L2
        });
        this.compileBody(expr.body, out, ctx);
        out.push(
          { kind: Instr.Jmp, label: L1 },
          { kind: Instr.Label, label: L2 },
        );
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
  }

  private compileProc(proc: Proc) {
    if (this.compiledProcs.has(proc.name))
      return;

    this.compiledProcs.add(proc.name);

    const instr: Instruction[] = [];
    const id = this.getProcId(proc.name);

    this.compileBody(proc.body, instr, createContext(proc.loc));
    instr.push({ kind: Instr.Ret });

    this.procs.set(id, instr);
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
      throw new StckError(Err.InvalidComptime)
        .addErr(memory.loc, "invalid memory size")
    }

    this.memoryOffset += size;
  }

  public compile(): IRProgram {
    const proc = this.program.procs.get("main");
    if (!proc) {
      throw new StckError(Err.NoMainProcedure);
    }

    this.program.consts.forEach((constant) => {
      this.compileConst(constant);
    });

    this.compileProc(proc);
    while (this.compileProcQueue.length) {
      this.compileProc(this.program.procs.get(this.compileProcQueue.shift()!)!);
    }

    return {
      procs: this.procs,
      strings: Array.from(this.stringIds.keys()),
      memorySize: this.memoryOffset
    }
  }
}