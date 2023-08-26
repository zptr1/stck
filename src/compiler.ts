import { ByteCode, Instr, Instruction, MarkedInstr } from "./shared/instruction";
import { IRExpr, IRProc, IRProgram, IRType, IRWordKind } from "./shared/ir";
import { reportErrorWithoutLoc } from "./errors";
import { AstType } from "./shared/ast";
import { DataType } from "./shared/types";
import { INTRINSICS } from "./shared/intrinsics";

export class Compiler {
  public readonly text: Map<string, number> = new Map();
  public readonly instr: MarkedInstr[] = [];

  private readonly markers: Map<string, number> = new Map();
  private readonly compiledProcs: Set<string> = new Set();
  private readonly procQueue: string[] = [];

  private textPtr: number = 0;

  constructor(
    public readonly program: IRProgram
  ) {}

  private encodeString(str: string) {
    if (!this.text.has(str)) {
      this.text.set(str, this.textPtr);
      this.textPtr += str.length;
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
          this.instr.push([
            INTRINSICS.get(expr.name)!.instr
          ]);
        } else if (expr.kind == IRWordKind.Proc) {
          if (!this.compiledProcs.has(expr.name)) {
            this.procQueue.push(expr.name);
          }

          this.instr.push([
            Instr.Call,
            `proc-${expr.name}`
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
          this.instr.push([Instr.Push, Number(expr.value)]);
        }
      } else {
        throw new Error(`Compilation of ${IRType[(expr as IRExpr).type]} is not implemented`);
      }
    }
  }

  public compile(): ByteCode {
    if (!this.program.procs.has("main")) {
      reportErrorWithoutLoc(
        "No main procedure found",
        [], this.program.file
      );
    }

    this.procQueue.push("main");

    while (this.procQueue.length) {
      const name = this.procQueue.shift()!;
      const proc = this.program.procs.get(name)!;

      this.marker(`proc-${name}`);
      this.compiledProcs.add(name);
      this.compileBody(proc.body);
    }

    return {
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
