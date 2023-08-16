import { AstType, Expr, IProc, IProgram, IPush } from "./shared/ast";
import { IRExpr, IRProc, IRProgram, IRWordKind, IRType } from "./shared/ir";
import { INTRINSICS } from "./shared/intrinsics";
import { reportError } from "./errors";

// TODO
export interface Context {
  stack: IPush[];
  // ...
}

export class IR {
  public procs = new Map<string, IRProc>();

  constructor (
    public readonly program: IProgram
  ) {}

  private parseBody(exprs: Expr[]): IRExpr[] {
    const out: IRExpr[] = [];
    for (const expr of exprs) {
      if (expr.type == AstType.Word) {
        const kind = (
          this.program.constants.has(expr.value)
            ? IRWordKind.Const
          : this.program.procs.has(expr.value)
            ? IRWordKind.Proc
          : INTRINSICS.has(expr.value)
            ? IRWordKind.Intrinsic
          : null
        );

        if (kind == null) {
          reportError("Unknown word", expr.loc);
        }

        out.push({
          type: IRType.Word,
          kind,
          name: expr.value,
          loc: expr.loc
        });
      } else if (expr.type == AstType.While) {
        out.push({
          type: IRType.While,
          condition: this.parseBody(expr.condition),
          body: this.parseBody(expr.body),
          loc: expr.loc
        });
      } else if (expr.type == AstType.If) {
        out.push({
          type: IRType.If,
          body: this.parseBody(expr.body),
          else: this.parseBody(expr.else),
          loc: expr.loc
        });
      } else {
        out.push(expr);
      }
    }

    return out;
  }

  private parseProc(proc: IProc): IRProc {
    const hproc: IRProc = {
      type: IRType.Proc,
      ins: [], outs: [], // TODO
      name: proc.name,
      loc: proc.loc,
      body: this.parseBody(proc.body)
    }

    return hproc;
  }

  public parse(): IRProgram {
    const program: IRProgram = {
      procs: new Map<string, IRProc>()
    };

    this.program.procs.forEach((proc) => {
      program.procs.set(proc.name, this.parseProc(proc));
    });

    return program;
  }
}