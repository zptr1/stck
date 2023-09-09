import { AstKind, Expr, Proc, Program, WordType } from "../parser";
import { StackElement, reportError, reportErrorWithStack } from "../errors";
import { Instr, DataType, INTRINSICS, Location } from "../shared";
import { ROOT_DIR } from "../const";
import plib from "path";

const MAX_I32 = 2 ** 31 - 1;
const MIN_I32 = ~MAX_I32;
const MAX_I64 = 2n ** 63n - 1n;
const MIN_I64 = ~MAX_I64;

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
      this.memorySize += this.program.memories.get(memory)!.value;
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

  private compileBody(exprs: Expr[], inlineExpandStack: StackElement[] = []) {
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
            if (inlineExpandStack.find((x) => x.name == proc.name)) {
              reportErrorWithStack(
                "Recursion is not allowed for inline procedures",
                expr.loc, inlineExpandStack
              )
            }

            this.compileBody(proc.body, inlineExpandStack.concat({
              name: proc.name,
              loc: expr.loc
            }));
          } else {
            const id = this.getProcId(proc.name);
            if (!this.compiledProcs.has(proc.name)) {
              this.procQueue.push(proc.name);
            }

            this.push(`call_proc ${id}`);
          }
        } else if (expr.type == WordType.Constant) {
          const constant = this.program.consts.get(expr.value)!;
          this.compilePush(constant.type as DataType, constant.value, constant.loc);
        } else if (expr.type == WordType.Memory) {
          this.push(
            `push mem+${this.getMemoryOffset(expr.value)}`
          );
        }
      } else if (expr.kind == AstKind.While) {
        const whileLb = this.label(".while");
        const endLb   = this.label(".end");

        this.push(`${whileLb}:`);
        this.compileBody(expr.condition, inlineExpandStack);
        this.push(
          "pop rax",
          "test rax, rax",
          `jz ${endLb}`
        );
        this.compileBody(expr.body, inlineExpandStack);
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
          this.compileBody(expr.body, inlineExpandStack);
          this.push(`jmp ${endLb}`);
          this.push(`${elseLb}:`);
          this.compileBody(expr.else, inlineExpandStack);
          this.push(`${endLb}:`);
        } else if (expr.body.length > 0) {
          const lb = this.label(".endif");
          this.push(`jz ${lb}`);
          this.compileBody(expr.body, inlineExpandStack);
          this.push(`${lb}:`);
        } else if (expr.else.length > 0) {
          const lb = this.label(".endif");
          this.push(`jnz ${lb}`);
          this.compileBody(expr.else, inlineExpandStack);
          this.push(`${lb}:`);
        }
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
        if (val > MAX_I64 || val < MIN_I64) {
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

    this.compileBody(proc.body);

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