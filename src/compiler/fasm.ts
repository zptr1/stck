import { AstKind, Expr, Proc, Program, WordType } from "../parser";
import { StackElement, reportError, reportErrorWithStack } from "../errors";
import { Instr, DataType, INTRINSICS, Location } from "../shared";
import { ROOT_DIR } from "../const";
import plib from "path";
import { CompilerContext } from ".";

const MAX_I32 = 2 ** 31 - 1;
const MIN_I32 = ~MAX_I32;
const MAX_U64 = 2n ** 64n - 1n;
const MIN_U64 = ~MAX_U64;

export class FasmCompiler {
  public readonly out: string[] = [];

  private readonly strings: string[] = [];
  private readonly memoryOffsets: Map<string, number> = new Map();
  private readonly compiledProcs: Set<string> = new Set();
  private readonly procIds: Map<string, number> = new Map();
  private readonly procQueue: string[] = [];

  private memorySize: number = 0;
  private labelId: number = 0;
  private ident: number = 0;

  constructor(
    public readonly program: Program
  ) {}

  private label(prefix: string = "label"): string {
    return `${prefix}_${this.labelId++}`;
  }

  private getStrId(str: string): number {
    const idx = this.strings.indexOf(str);
    return idx == -1
      ? this.strings.push(str) - 1
      : idx;
  }

  private getMemoryOffset(memory: string): number {
    if (!this.memoryOffsets.has(memory)) {
      this.memoryOffsets.set(memory, this.memorySize);
      this.memorySize += Number(this.program.memories.get(memory)!.value);
    }

    return this.memoryOffsets.get(memory)!;
  }

  private getProcId(proc: string): number {
    if (!this.procIds.has(proc))
      this.procIds.set(proc, this.procIds.size);
    return this.procIds.get(proc)!;
  }

  private push(...lines: string[]) {
    const tab = " ".repeat(this.ident);
    for (const line of lines) {
      this.out.push(tab + line);
    }
  }

  private compileBody(exprs: Expr[], ctx: CompilerContext) {
    this.ident += 2;

    for (const expr of exprs) {
      if (expr.kind == AstKind.Word) {
        if (expr.type == WordType.Intrinsic) {
          const intrinsic = INTRINSICS.get(expr.value)!;
          if (intrinsic.instr != Instr.Nop) {
            // Calls a macro included from lib/core.asm
            this.push(`intrinsic_${expr.value}`);
          }
        } else if (expr.type == WordType.Proc) {
          const proc = this.program.procs.get(expr.value)!;
          if (proc.inline) {
            if (ctx.inlineExpansionStack.find((x) => x.name == proc.name)) {
              reportErrorWithStack(
                "Recursion is not allowed for inline procedures",
                expr.loc, ctx.inlineExpansionStack
              )
            }

            this.push(`;; begin inline proc \`${proc.name}\``);

            ctx.inlineExpansionStack.push({
              name: proc.name,
              loc: expr.loc
            });

            this.compileBody(proc.body, ctx);
            ctx.inlineExpansionStack.pop();

            this.push(`;; end inline proc`);
          } else {
            const id = this.getProcId(proc.name);
            if (!this.compiledProcs.has(proc.name)) {
              this.procQueue.push(proc.name);
            }

            this.push(`call_proc ${id} ;; ${proc.name}`);
          }
        } else if (expr.type == WordType.Constant) {
          const constant = this.program.consts.get(expr.value)!;
          this.compilePush(constant.type as DataType, constant.value, constant.loc);
        } else if (expr.type == WordType.Binding) {
          this.push(
            "mov rax, rbp",
            `add rax, ${(
              ctx.bindings.size - ctx.bindings.get(expr.value)! - 1
            ) * 8}`,
            "push QWORD [rax]"
          );
        } else if (expr.type == WordType.Memory) {
          this.push(
            `push mem+${this.getMemoryOffset(expr.value)}`
          );
        }
      } else if (expr.kind == AstKind.While) {
        const whileLb = this.label(".while");
        const endLb   = this.label(".end");

        this.push(`${whileLb}:`);
        this.compileBody(expr.condition, ctx);
        this.push(
          "pop rax",
          "test rax, rax",
          `jz ${endLb}`
        );
        this.compileBody(expr.body, ctx);
        this.push(
          `jmp ${whileLb}`,
          `${endLb}:`
        );
      } else if (expr.kind == AstKind.If) {
        this.push(
          "pop rax",
          "test rax, rax"
        );

        if (expr.body.length > 0 && expr.else.length > 0) {
          const elseLb = this.label(".else");
          const endLb  = this.label(".endif");
          this.push(`jz ${elseLb}`);
          this.compileBody(expr.body, ctx);
          this.push(`jmp ${endLb}`);
          this.push(`${elseLb}:`);
          this.compileBody(expr.else, ctx);
          this.push(`${endLb}:`);
        } else if (expr.body.length > 0) {
          const lb = this.label(".endif");
          this.push(`jz ${lb}`);
          this.compileBody(expr.body, ctx);
          this.push(`${lb}:`);
        } else if (expr.else.length > 0) {
          const lb = this.label(".endif");
          this.push(`jnz ${lb}`);
          this.compileBody(expr.else, ctx);
          this.push(`${lb}:`);
        }
      } else if (expr.kind == AstKind.Let) {
        this.push(";; begin let binding");
        this.push(`sub rbp, ${8 * expr.bindings.length}`);

        for (let i = expr.bindings.length - 1; i >= 0; i--) {
          ctx.bindings.set(expr.bindings[i], ctx.bindings.size);
          this.push(
            "pop rax",
            `mov [rbp+${i * 8}], rax`
          );
        }

        this.compileBody(expr.body, ctx);

        this.push(`add rbp, ${8 * expr.bindings.length}`);
        this.push(";; end let binding");

        for (const binding of expr.bindings)
          ctx.bindings.delete(binding);
      } else if (expr.kind == AstKind.Push) {
        this.compilePush(expr.type as DataType, expr.value, expr.loc);
      } else {
        throw new Error(`Compilation of ${AstKind[(expr as Expr).kind]} to NASM is not implemented`);
      }
    }

    this.ident -= 2;
  }

  private compilePush(type: DataType, value: any, loc: Location) {
    if (type == DataType.AsmBlock) {
      this.push(";; begin asm block");
      for (const line of value.trim().split("\n"))
        this.push(line);
      this.push(";; end asm block");
    } else if (type == DataType.Str) {
      this.push(`push ${value.length}`);
      this.push(`push str${this.getStrId(value)}`);
    } else if (type == DataType.CStr) {
      this.push(`push str${
        this.getStrId(value + "\x00")
      }`);
    } else {
      const val = BigInt(value);
      if (val > MAX_I32 || val < MIN_I32) {
        if (val > MAX_U64 || val < MIN_U64) {
          reportError(
            "The integer is too big", loc, [
              "must be in range (-i64..i64)"
            ]
          );
        }

        this.push(
          `mov rax, ${val}`,
          "push rax"
        );
      } else {
        this.push(`push ${val}`);
      }
    }
  }

  public compileProc(proc: Proc) {
    if (this.compiledProcs.has(proc.name))
      return;

    const id = this.getProcId(proc.name);
    this.compiledProcs.add(proc.name);

    this.out.push(
      `proc_${id}: ;; ${proc.name} @ ${proc.loc.file.path}`,
      "swap_stack_pointers"
    );

    this.compileBody(proc.body, {
      inlineExpansionStack: [],
      bindings: new Map()
    });

    this.out.push(
      "swap_stack_pointers",
      "ret",
      ""
    );
  }

  public compile(): string[] {
    // TODO: Linking?

    this.out.push(
      ";; Compiled with stck v0.0.2\n",
      "format ELF64 executable 3",
      `include "${plib.join(ROOT_DIR, "lib/core.asm")}"`,
    );

    this.out.push("");
    this.out.push("segment readable executable");

    this.compileProc(this.program.procs.get("main")!);

    while (this.procQueue.length) {
      this.compileProc(
        this.program.procs.get(this.procQueue.shift()!)!
      );
    }

    this.out.push("");
    this.out.push(
      "segment readable writeable",
      `mem rb ${this.memorySize}`
    );

    for (let i = 0; i < this.strings.length; i++) {
      this.out.push(`str${i} db ${
        this.strings[i].split("").map(
          (x) => x.charCodeAt(0)
        ).join(",")
      }`);
    }

    return this.out;
  }
}