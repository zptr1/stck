import { ByteCode, Instr, Instruction, MarkedInstr, DataType, INTRINSICS } from "../shared";
import { IRExpr, IRProc, IRProgram, IRType, IRWordKind, AstType } from "../parser";
import { reportErrorWithoutLoc } from "../errors";

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

  private compileBody(exprs: IRExpr[]) {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.kind == IRWordKind.Intrinsic) {
          const intrinsic = INTRINSICS.get(expr.name)!;

          if (intrinsic.instr != Instr.Nop) {
            this.instr.push([intrinsic.instr]);
          }
        } else if (expr.kind == IRWordKind.Proc) {
          if (!this.compiledProcs.has(expr.name)) {
            this.procQueue.push(expr.name);
          }

          this.instr.push([
            Instr.Call,
            `proc-${expr.name}`
          ]);
        } else if (expr.kind == IRWordKind.Memory) {
          this.instr.push([
            Instr.Push,
            this.program.memories.get(expr.name)!.offset
          ]);
        }
      } else if (expr.type == IRType.While) {
        const start = this.marker();
        const end = this.marker();

        this.compileBody(expr.condition);
        this.instr.push([Instr.JmpIfNot, end]);

        this.compileBody(expr.body);
        this.instr.push([Instr.Jmp, start]);

        this.marker(end);
      } else if (expr.type == IRType.If) {
        if (expr.else.length > 0) {
          const end = this.marker();
          const els = this.marker();

          this.instr.push([Instr.JmpIfNot, els]);
          this.compileBody(expr.body);
          this.instr.push([Instr.Jmp, end]);

          this.marker(els);
          this.compileBody(expr.else);
          this.marker(end);
        } else {
          const end = this.marker();

          this.instr.push([Instr.JmpIfNot, end]);
          this.compileBody(expr.body);
          this.marker(end);
        }
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.Ptr) {
          this.instr.push([Instr.Push, this.encodeString(expr.value)]);
        } else {
          this.instr.push([Instr.Push, Number(expr.value) ?? 0]);
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
  private readonly procQueue: string[] = [];

  private labelIncrement: number = 0;

  constructor(
    public readonly program: IRProgram
  ) {}

  private label(prefix: string = "label"): string {
    return `${prefix}_${this.labelIncrement++}`;
  }

  private encodeString(str: string): number {
    const idx = this.strings.indexOf(str);
    return idx == -1
      ? this.strings.push(str) - 1
      : idx;
  }

  public includeBuiltins() {
    this.out.push("; beigin builtins");

    // print intrinsic
    // definitely not stolen from somewhere idk
    this.out.push(
      "print:",
      "  mov r9, -3689348814741910323",
      "  sub rsp, 40",
      "  mov BYTE [rsp+31], 10",
      "  lea rcx, [rsp+30]",
      ".L2:",
      "  mov rax, rdi",
      "  lea r8, [rsp+32]",
      "  mul r9",
      "  mov rax, rdi",
      "  sub r8, rcx",
      "  shr rdx, 3",
      "  lea rsi, [rdx+rdx*4]",
      "  add rsi, rsi",
      "  sub rax, rsi",
      "  add eax, 48",
      "  mov BYTE [rcx], al",
      "  mov rax, rdi",
      "  mov rdi, rdx",
      "  mov rdx, rcx",
      "  sub rcx, 1",
      "  cmp rax, 9",
      "  ja  .L2",
      "  lea rax, [rsp+32]",
      "  mov edi, 1",
      "  sub rdx, rax",
      "  xor eax, eax",
      "  lea rsi, [rsp+32+rdx]",
      "  mov rdx, r8",
      "  mov rax, 1",
      "  syscall",
      "  add     rsp, 40",
      "  ret",
    );

    this.out.push("; end builtins");
  }

  public compileIntrinsic(instr: Instr) {
    if (
      instr == Instr.Add
      || instr == Instr.Sub
      || instr == Instr.Mul
    ) {
      const op = (
        instr == Instr.Add
          ? "add"
        : instr == Instr.Sub
          ? "sub"
        : instr == Instr.Mul
          ? "mul"
        : ""
      );

      this.out.push(
        "pop rax",
        "pop rbx",
        `${op} rax, rbx`,
        "push rax"
      );
    }
  }

  public compileBody(exprs: IRExpr[]) {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.kind == IRWordKind.Intrinsic) {
          this.compileIntrinsic(INTRINSICS.get(expr.name)!.instr);
        } else if (expr.kind == IRWordKind.Proc) {
          throw new Error("TODO");
        } else if (expr.kind == IRWordKind.Memory) {
          throw new Error("TODO");
        }
      } else if (expr.type == IRType.While) {
        throw new Error("TODO");
      } else if (expr.type == IRType.If) {
        throw new Error("TODO");
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.Ptr) {
          this.out.push(`push str${this.encodeString(expr.value)}`);
        } else {
          this.out.push(`push ${Number(expr.value) ?? 0}`);
        }
      } else {
        throw new Error(`Compilation of ${IRType[(expr as IRExpr).type]} to NASM is not implemented`);
      }
    }
  }

  public compileProc(proc: IRProc) {
    this.compiledProcs.add(proc.name);
    this.compileBody(proc.body);
    this.out.push("ret");
  }

  public compile(): string[] {
    this.out.push(";; Compiled with stck v0.0.2\n");

    this.out.push("format ELF64 executable 3");
    this.out.push("segment readable executable");

    this.includeBuiltins();
    this.compileProc(this.program.procs.get("main")!);

    this.out.pop();
    this.out.push("mov rax, 60");
    this.out.push("mov rdi, 0");
    this.out.push("syscall");

    while (this.procQueue.length) {
      this.compileProc(
        this.program.procs.get(this.procQueue.shift()!)!
      );
    }

    this.out.push("segment readable writeable");

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