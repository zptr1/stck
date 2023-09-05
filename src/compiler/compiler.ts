import { ByteCode, Instr, Instruction, MarkedInstr, DataType, INTRINSICS, formatLoc } from "../shared";
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
          const proc = this.program.procs.get(expr.name)!;

          if (proc.inline) {
            this.compileBody(proc.body);
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

  public includeBuiltins() {
    this.out.push("; begin builtins");

    /*
      // Reference implementation in C
      void print(unsigned long long n) {
        int i = 1, neg = (long long)n < 0;
        if (neg) n = -n;

        char buf[32];
        buf[31] = '\n';
        do {
          buf[32 - i++ - 1] = n % 10 + '0';
          n /= 10;
        } while (n);

        if (neg) buf[32 - i++ - 1] = '-';
        write(1, &buf[32 - i], i);
      }
    */
    this.out.push(
      "print:",
      "sub rsp, 40",
      "mov rax, rdi",
      "mov rcx, rdi",
      "mov r11, rdi",
      "neg rax",
      "mov BYTE [rsp+31], 10",
      "lea r8, [rsp+30]",
      "mov edi, 1",
      "mov r9, -3689348814741910323",
      "cmovns rcx, rax",
      ".L3:",
      "mov rax, rcx",
      "mov r10d, edi",
      "sub r8, 1",
      "mul r9",
      "mov rax, rcx",
      "add edi, 1",
      "shr rdx, 3",
      "lea rsi, [rdx+rdx*4]",
      "add rsi, rsi",
      "sub rax, rsi",
      "add eax, 48",
      "mov BYTE [r8+1], al",
      "mov rax, rcx",
      "mov rcx, rdx",
      "cmp rax, 9",
      "ja .L3",
      "test r11, r11",
      "jns .L4",
      "mov eax, 31",
      "sub eax, edi",
      "lea edi, [r10+2]",
      "cdqe",
      "mov BYTE [rsp+rax], 45",
      ".L4:",
      "mov eax, 32",
      "mov edx, edi",
      "sub eax, edi",
      "mov edi, 1",
      "cdqe",
      "lea rsi, [rsp+rax]",
      "xor eax, eax",
      "mov rax, 1",
      "syscall",
      "add rsp, 40",
      "ret",
    );

    // detect callstack overflow
    const overflowMsg = "RUNTIME ERROR: Callstack overflow\n";
    this.out.push(
      "check_callstack_overflow:",
      "mov rcx, 0",
      "mov rdx, 1",
      "mov rax, [callstack_rsp]",
      "mov rbx, [callstack]",
      "cmp rax, rbx",
      "cmovl rcx, rdx",
      "mov rax, rcx",
      "test rax, rax",
      "jz .e",
        "mov rax, 1",
        "mov rdi, 2",
        `mov rsi, str${this.getStrId(overflowMsg)}`,
        `mov rdx, ${overflowMsg.length}`,
        "syscall",
        "mov rax, 60",
        "mov rdi, 1",
        "syscall",
      ".e:",
      "ret"
    );

    this.out.push("; end builtins");
  }

  public compileIntrinsic(instr: Instr) {
    // TODO: Introduce assembly blocks and move this to `lib/core.stck` that will be automatically included into every program
    if (
      instr == Instr.Add
      || instr == Instr.Sub
      || instr == Instr.Mul
      || instr == Instr.DivMod
      || instr == Instr.Or
      || instr == Instr.And
      || instr == Instr.Xor
    ) {
      this.out.push(
        "pop rbx",
        "pop rax",
      );

      if (instr == Instr.Add) {
        this.out.push("add rax, rbx");
      } else if (instr == Instr.Sub) {
        this.out.push("sub rax, rbx");
      } else if (instr == Instr.Mul) {
        this.out.push("mul rbx");
      } else if (instr == Instr.DivMod) {
        this.out.push(
          "xor rdx, rdx",
          "div rbx",
          "push rax",
          "push rdx"
        );
      } else if (instr == Instr.Or) {
        this.out.push("or rax, rbx");
      } else if (instr == Instr.And) {
        this.out.push("and rax, rbx");
      } else if (instr == Instr.Xor) {
        this.out.push("xor rax, rbx");
      }

      if (instr != Instr.DivMod) {
        this.out.push("push rax");
      }
    } else if (
      instr == Instr.Lt
      || instr == Instr.Eq
      || instr == Instr.Gt
    ) {
      this.out.push(
        "mov rcx, 0",
        "mov rdx, 1",
        "pop rbx",
        "pop rax",
        "cmp rax, rbx"
      );

      if (instr == Instr.Lt) {
        this.out.push("cmovl rcx, rdx");
      } else if (instr == Instr.Eq) {
        this.out.push("cmove rcx, rdx");
      } else if (instr == Instr.Gt) {
        this.out.push("cmovg rcx, rdx");
      }

      this.out.push("push rcx");
    } else if (
      instr == Instr.Shl
      || instr == Instr.Shr
    ) {
      this.out.push(
        "pop rcx",
        "pop rbx"
      );

      if (instr == Instr.Shl) {
        this.out.push("shl rbx, cl");
      } else if (instr == Instr.Shr) {
        this.out.push("shr rbx, cl");
      }

      this.out.push("push rbx");
    } else if (instr == Instr.Not) {
      this.out.push(
        "pop rax",
        "not rax",
        "push rax"
      );
    } else if (instr == Instr.Dup) {
      this.out.push(
        "pop rax",
        "push rax",
        "push rax"
      );
    } else if (instr == Instr.Drop) {
      this.out.push("pop rax");
    } else if (instr == Instr.Swap) {
      this.out.push(
        "pop rax",
        "pop rbx",
        "push rax",
        "push rbx"
      );
    } else if (instr == Instr.Rot) {
      this.out.push(
        "pop rax",
        "pop rbx",
        "pop rcx",
        "push rbx",
        "push rax",
        "push rcx"
      );
    } else if (instr == Instr.Over) {
      this.out.push(
        "pop rax",
        "pop rbx",
        "push rbx",
        "push rax",
        "push rbx"
      );
    } else if (instr == Instr.Dup2) {
      this.out.push(
        "pop rax",
        "pop rbx",
        "push rbx",
        "push rax",
        "push rbx",
        "push rax",
      );
    } else if (instr == Instr.Swap2) {
      this.out.push(
        "pop rax",
        "pop rbx",
        "pop rcx",
        "pop rdx",
        "push rax",
        "push rbx",
        "push rcx",
        "push rdx"
      );
    } else if (
      instr == Instr.Write8
      || instr == Instr.Write16
      || instr == Instr.Write32
      || instr == Instr.Write64
    ) {
      this.out.push(
        "pop rax",
        "pop rbx"
      );

      if (instr == Instr.Write8) {
        this.out.push("mov [rax], bl");
      } else if (instr == Instr.Write16) {
        this.out.push("mov [rax], bx");
      } else if (instr == Instr.Write32) {
        this.out.push("mov [rax], ebx");
      } else if (instr == Instr.Write64) {
        this.out.push("mov [rax], rbx");
      }
    } else if (
      instr == Instr.Read8
      || instr == Instr.Read16
      || instr == Instr.Read32
      || instr == Instr.Read64
    ) {
      this.out.push(
        "pop rax",
        "xor rbx, rbx"
      );

      if (instr == Instr.Read8) {
        this.out.push("mov bl, [rax]");
      } else if (instr == Instr.Read16) {
        this.out.push("mov bx, [rax]");
      } else if (instr == Instr.Read32) {
        this.out.push("mov ebx, [rax]");
      } else if (instr == Instr.Read64) {
        this.out.push("mov rbx, [rax]");
      }

      this.out.push("push rbx");
    } else if (instr == Instr.Print) {
      this.out.push(
        "pop rdi",
        "call print"
      );
    } else if (instr == Instr.Puts) {
      this.out.push(
        "mov rax, 1",
        "mov rdi, 1",
        "pop rsi",
        "pop rdx",
        "syscall"
      );
    } else if (instr != Instr.Nop) {
      throw new Error(`Compilation of the instruction ${Instr[instr as Instr]} to NASM is not supported`);
    }
  }

  public compileBody(exprs: IRExpr[]) {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.kind == IRWordKind.Intrinsic) {
          this.compileIntrinsic(INTRINSICS.get(expr.name)!.instr);
        } else if (expr.kind == IRWordKind.Proc) {
          const proc = this.program.procs.get(expr.name)!;
          if (proc.inline) {
            this.compileBody(proc.body);
          } else {
            const id = this.getProcId(proc.name);
            if (!this.compiledProcs.has(proc.name)) {
              this.procQueue.push(proc.name);
            }

            this.out.push(
              "call check_callstack_overflow",
              "mov rax, rsp",
              "mov rsp, [callstack_rsp]",
              `call proc_${id}`,
              "mov [callstack_rsp], rsp",
              "mov rsp, rax"
            );
          }
        } else if (expr.kind == IRWordKind.Memory) {
          this.out.push(
            `push mem+${this.program.memories.get(expr.name)!.offset}`
          );
        }
      } else if (expr.type == IRType.While) {
        const whileLb = this.label(".while");
        const endLb   = this.label(".end");

        this.out.push(`${whileLb}:`);
        this.compileBody(expr.condition);
        this.out.push(
          "pop rax",
          "test rax, rax",
          `jz ${endLb}`
        );
        this.compileBody(expr.body);
        this.out.push(
          `jmp ${whileLb}`,
          `${endLb}:`
        );
      } else if (expr.type == IRType.If) {
        this.out.push(
          "pop rax",
          "test rax, rax"
        );

        if (expr.body.length > 0 && expr.else.length > 0) {
          const elseLb = this.label(".else");
          const endLb  = this.label(".endif");
          this.out.push(`jz ${elseLb}`);
          this.compileBody(expr.body);
          this.out.push(`jmp ${endLb}`);
          this.out.push(`${elseLb}:`);
          this.compileBody(expr.else);
          this.out.push(`${endLb}:`);
        } else if (expr.body.length > 0) {
          const lb = this.label(".endif");
          this.out.push(`jz ${lb}`);
          this.compileBody(expr.body);
          this.out.push(`${lb}:`);
        } else if (expr.else.length > 0) {
          const lb = this.label(".endif");
          this.out.push(`jnz ${lb}`);
          this.compileBody(expr.else);
          this.out.push(`${lb}:`);
        }
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.AsmBlock) {
          this.out.push(`;; begin asm block`);
          this.out.push(expr.value.trim());
          this.out.push(`;; end asm block`);
        } else if (expr.datatype == DataType.Ptr) {
          this.out.push(`push str${this.getStrId(expr.value)}`);
        } else {
          this.out.push(`push ${BigInt(expr.value)}`);
        }
      } else {
        throw new Error(`Compilation of ${IRType[(expr as IRExpr).type]} to NASM is not implemented`);
      }
    }
  }

  public compileProc(proc: IRProc) {
    if (this.compiledProcs.has(proc.name))
      return;

    const id = this.getProcId(proc.name);
    this.compiledProcs.add(proc.name);

    this.out.push(
      `proc_${id}: ;; ${proc.name} @ ${proc.loc.file.path}`,
      "sub rsp, 8",
      "mov [callstack_rsp], rsp",
      "mov rsp, rax"
    );
    this.compileBody(proc.body);
    this.out.push(
      "mov rax, rsp",
      "mov rsp, [callstack_rsp]",
      "add rsp, 8",
      "ret"
    );
  }

  public compile(): string[] {
    this.out.push(";; Compiled with stck v0.0.2\n");

    this.out.push("format ELF64 executable 3");
    this.out.push("segment readable executable");

    this.out.push(
      "_start:",
      "mov rax, callstack_end",
      "mov [callstack_rsp], rax",
      "call proc_0",
      "mov rax, 60",
      "mov rdi, 0",
      "syscall",
    );

    this.includeBuiltins();
    this.compileProc(this.program.procs.get("main")!);

    while (this.procQueue.length) {
      this.compileProc(
        this.program.procs.get(this.procQueue.shift()!)!
      );
    }

    this.out.push("segment readable writeable");

    this.out.push("callstack_rsp: rq 1");
    this.out.push("callstack:     rb 64000");
    this.out.push("callstack_end:");
    this.out.push(`mem:           rb ${this.program.memorySize}`);

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