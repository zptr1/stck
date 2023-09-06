import { ByteCode, Instr, Instruction, MarkedInstr, DataType, INTRINSICS } from "../shared";
import { IRExpr, IRProc, IRProgram, IRType, IRWordKind, AstType } from "../parser";
import { StackElement, reportError, reportErrorWithStack, reportErrorWithoutLoc } from "../errors";
import { ROOT_DIR } from "../const";
import plib from "path";

export class BytecodeCompiler {
  public readonly text: Map<string, number> = new Map();
  public readonly instr: MarkedInstr[] = [];

  private readonly markers: Map<string, number> = new Map();
  private readonly compiledProcs: Set<string> = new Set();
  private readonly procQueue: string[] = [];

  private progMemSize: number = 0;
  private textMemSize: number = 0;

  constructor(
    public readonly program: IRProgram
  ) {
    this.progMemSize = this.program.memorySize;
  }

  private encodeString(str: string) {
    if (!this.text.has(str)) {
      this.text.set(str, this.progMemSize + this.textMemSize);
      this.textMemSize += Buffer.from(str, "utf-8").length;
    }

    return this.text.get(str)!;
  }

  private marker(id: string = `marker-${this.markers.size}`): string {
    this.markers.set(id, this.instr.length);
    return id;
  }

  private compileBody(exprs: IRExpr[], inlineExpandStack: StackElement[] = []) {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.kind == IRWordKind.Intrinsic) {
          const intrinsic = INTRINSICS.get(expr.name)!;

          if (intrinsic.instr != Instr.Nop) {
            this.instr.push([intrinsic.instr]);
          }
        } else if (expr.kind == IRWordKind.Proc) {
          const proc = this.program.procs.get(expr.name)!;

          if (proc.inline) {
            if (inlineExpandStack.find((x) => x.name == proc.name)) {
              reportErrorWithStack(
                "Recursion is not allowed for inline procedures",
                expr.loc, inlineExpandStack
              );
            }

            this.compileBody(proc.body, inlineExpandStack.concat({
              name: proc.name,
              loc: expr.loc
            }));
          } else {
            if (!this.compiledProcs.has(expr.name)) {
              this.procQueue.push(expr.name);
            }

            this.instr.push([
              Instr.Call,
              `proc-${expr.name}`
            ]);
          }
        } else if (expr.kind == IRWordKind.Memory) {
          this.instr.push([
            Instr.Push,
            this.program.memories.get(expr.name)!.offset
          ]);
        }
      } else if (expr.type == IRType.While) {
        const start = this.marker();
        const end = this.marker();

        this.compileBody(expr.condition, inlineExpandStack);
        this.instr.push([Instr.JmpIfNot, end]);

        this.compileBody(expr.body, inlineExpandStack);
        this.instr.push([Instr.Jmp, start]);

        this.marker(end);
      } else if (expr.type == IRType.If) {
        if (expr.else.length > 0) {
          const end = this.marker();
          const els = this.marker();

          this.instr.push([Instr.JmpIfNot, els]);
          this.compileBody(expr.body, inlineExpandStack);
          this.instr.push([Instr.Jmp, end]);

          this.marker(els);
          this.compileBody(expr.else, inlineExpandStack);
          this.marker(end);
        } else {
          const end = this.marker();

          this.instr.push([Instr.JmpIfNot, end]);
          this.compileBody(expr.body, inlineExpandStack);
          this.marker(end);
        }
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.AsmBlock) {
          reportError(
            "Assembly blocks are not supported for this target",
            expr.loc
          );
        } else if (expr.datatype == DataType.Ptr) {
          this.instr.push([Instr.Push, BigInt(this.encodeString(expr.value))]);
        } else {
          this.instr.push([Instr.Push, BigInt(expr.value) ?? 0n]);
        }
      } else {
        throw new Error(`Compilation of ${IRType[(expr as IRExpr).type]} to bytecode is not implemented`);
      }
    }
  }

  public compileProc(proc: IRProc) {
    this.marker(`proc-${proc.name}`);
    this.compiledProcs.add(proc.name);
    this.compileBody(proc.body);
    this.instr.push([Instr.Ret]);
  }

  public compile(): ByteCode {
    if (!this.program.procs.has("main")) {
      reportErrorWithoutLoc(
        "No main procedure found",
        [], this.program.file
      );
    }

    this.compileProc(this.program.procs.get("main")!);
    this.instr.pop();
    this.instr.push([Instr.Halt, 0]);

    while (this.procQueue.length) {
      this.compileProc(
        this.program.procs.get(this.procQueue.shift()!)!
      );
    }

    return {
      textMemSize: this.textMemSize,
      progMemSize: this.progMemSize,
      text: [...this.text.keys()],
      instr: this.instr.map(
        (x) => x.map((y) => {
          if (typeof y == "string") {
            const marker = this.markers.get(y);
            if (typeof marker == "undefined") {
              throw new Error(`Marker not found: ${marker}`);
            }

            return marker;
          } else {
            return y;
          }
        })
      ) as Instruction[]
    }
  }
}

export class FasmCompiler {
  public readonly out: string[] = [];

  private readonly strings: string[] = [];
  private readonly compiledProcs: Set<string> = new Set();
  private readonly procIds: Map<string, number> = new Map();
  private readonly procQueue: string[] = [];

  private labelId: number = 0;
  private ident: number = 0;

  constructor(
    public readonly program: IRProgram
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

  public compileBody(exprs: IRExpr[], inlineExpandStack: StackElement[] = []) {
    this.ident += 2;

    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.kind == IRWordKind.Intrinsic) {
          const intrinsic = INTRINSICS.get(expr.name)!;
          if (intrinsic.instr != Instr.Nop) {
            // Calls a macro included from lib/core.asm
            this.push(`intrinsic_${expr.name}`);
          }
        } else if (expr.kind == IRWordKind.Proc) {
          const proc = this.program.procs.get(expr.name)!;
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
        } else if (expr.kind == IRWordKind.Memory) {
          this.push(
            `push mem+${this.program.memories.get(expr.name)!.offset}`
          );
        }
      } else if (expr.type == IRType.While) {
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
      } else if (expr.type == IRType.If) {
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
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.AsmBlock) {
          this.push(`;; begin asm block`);
          this.push(...expr.value.trim().split("\n"));
          this.push(`;; end asm block`);
        } else if (expr.datatype == DataType.Ptr) {
          this.push(`push str${this.getStrId(expr.value)}`);
        } else {
          this.push(`push ${BigInt(expr.value)}`);
        }
      } else {
        throw new Error(`Compilation of ${IRType[(expr as IRExpr).type]} to NASM is not implemented`);
      }
    }

    this.ident -= 2;
  }

  public compileProc(proc: IRProc) {
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
      `mem rb ${this.program.memorySize}`
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