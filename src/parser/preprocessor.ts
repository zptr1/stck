import { IRExpr, IRProc, IRProgram, IRWordKind, IRType, IRConst, IRMemory } from "./ir";
import { AstType, Expr, IConst, IMemory, IProc, IProgram, IWord } from "./ast";
import { reportError, reportErrorWithStack } from "../errors";
import { INTRINSICS, formatLoc, DataType } from "../shared";
import { TypeChecker } from "../compiler";
import chalk from "chalk";

/**
 * Converts the program to IR. Also expands macros and evaluates compile-time expressions
 */
export class Preprocessor {
  public readonly procs = new Map<string, IRProc>();
  public readonly consts = new Map<string, IRConst>();
  public readonly memories = new Map<string, IRMemory>();
  public readonly typechecker: TypeChecker;

  private memorySize: number = 0;

  constructor (
    public readonly program: IProgram
  ) {
    this.typechecker = new TypeChecker(this);
  }

  private expandMacro(expr: IWord, stack: IWord[]): IRExpr[] {
    const macro = this.program.macros.get(expr.value)!;

    if (stack.find((x) => x.value == macro.name)) {
      reportErrorWithStack(
        "recursive macro expansion", expr.loc, stack, [
          `macro ${chalk.bold(expr.value)} expanded again at ${chalk.gray.bold(formatLoc(expr.loc))}`
        ]
      );
    }

    stack.push(expr);
    const body = this.parseBody(macro.body, stack);
    stack.pop();

    return body;
  }

  private parseBody(exprs: Expr[], macroExpansionStack: IWord[] = []): IRExpr[] {
    const out: IRExpr[] = [];
    for (const expr of exprs) {
      if (expr.type == AstType.Word) {
        if (this.program.macros.has(expr.value)) {
          const body = this.expandMacro(expr, macroExpansionStack);
          for (const expr of body)
            out.push(expr);

          continue;
        } else if (this.consts.has(expr.value)) {
          const constant = this.consts.get(expr.value)!;
          if (constant.body.datatype == DataType.Str) {
            out.push({
              type: AstType.Push,
              datatype: DataType.Int,
              value: constant.body.value.length,
              loc: expr.loc
            });

            out.push({
              type: AstType.Push,
              datatype: DataType.Ptr,
              value: constant.body.value,
              loc: expr.loc
            });
          } else {
            out.push({
              type: AstType.Push,
              datatype: constant.body.datatype,
              value: constant.body.value,
              loc: expr.loc
            });
          }
        } else if (this.memories.has(expr.value)) {
          out.push({
            type: IRType.Word,
            kind: IRWordKind.Memory,
            name: expr.value,
            loc: expr.loc
          });
        } else if (this.program.procs.has(expr.value)) {
          out.push({
            type: IRType.Word,
            kind: IRWordKind.Proc,
            name: expr.value,
            loc: expr.loc
          });
        } else if (INTRINSICS.has(expr.value)) {
          out.push({
            type: IRType.Word,
            kind: IRWordKind.Intrinsic,
            name: expr.value,
            loc: expr.loc
          });
        } else {
          reportErrorWithStack(
            "Unknown word", expr.loc, macroExpansionStack
          );
        }
      } else if (expr.type == AstType.While) {
        out.push({
          type: IRType.While,
          condition: this.parseBody(expr.condition, macroExpansionStack),
          body: this.parseBody(expr.body, macroExpansionStack),
          loc: expr.loc
        });
      } else if (expr.type == AstType.If) {
        out.push({
          type: IRType.If,
          body: this.parseBody(expr.body, macroExpansionStack),
          else: this.parseBody(expr.else, macroExpansionStack),
          loc: expr.loc
        });
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.Str) {
          out.push({
            type: AstType.Push,
            datatype: DataType.Int,
            value: expr.value.length,
            loc: expr.loc
          });

          out.push({
            type: AstType.Push,
            datatype: DataType.Ptr,
            value: expr.value,
            loc: expr.loc
          });
        } else {
          out.push(expr);
        }
      } else {
        throw new Error(`Preprocessing is not implemented for ${AstType[(expr as Expr).type]}`);
      }
    }

    return out;
  }

  private parseConst(constant: IConst): IRConst {
    if (this.consts.has(constant.name)) {
      return this.consts.get(constant.name)!;
    }

    const irconst: IRConst = {
      type: IRType.Const,
      name: constant.name,
      loc: constant.loc,
      body: this.typechecker.evaluateCompileTimeExpr(constant.body, constant.loc)
    }

    this.consts.set(constant.name, irconst);
    return irconst;
  }

  private parseMemory(memory: IMemory): IRMemory {
    if (this.memories.has(memory.name)) {
      return this.memories.get(memory.name)!;
    }

    const body = this.typechecker.evaluateCompileTimeExpr(memory.body, memory.loc);
    if (body.datatype != DataType.Int) {
      reportError(
        "Memory sizes must be integers", memory.loc, [
          `Expected Int but got ${
            typeof body.datatype == "string" ? "Any" : DataType[body.datatype]
          }`
        ]
      );
    }

    const irmemory: IRMemory = {
      type: IRType.Memory,
      name: memory.name,
      size: body.value,
      offset: this.memorySize,
      loc: memory.loc
    }

    this.memorySize += body.value;
    this.memories.set(memory.name, irmemory);

    return irmemory;
  }

  private parseProc(proc: IProc): IRProc {
    if (this.procs.has(proc.name)) {
      return this.procs.get(proc.name)!;
    }

    const irproc: IRProc = {
      type: IRType.Proc,
      signature: proc.signature,
      name: proc.name,
      loc: proc.loc,
      inline: proc.inline,
      body: this.parseBody(proc.body)
    };

    this.procs.set(proc.name, irproc);
    return irproc;
  }

  public parse(): IRProgram {
    this.program.consts.forEach((constant) => this.parseConst(constant));
    this.program.memories.forEach((memory) => this.parseMemory(memory));
    this.program.procs.forEach((proc) => this.parseProc(proc));

    return {
      file: this.program.file,
      procs: this.procs,
      memories: this.memories,
      memorySize: this.memorySize
    };
  }
}