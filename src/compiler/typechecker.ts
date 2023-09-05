import { DataType, DataTypeArray, TemplateMap, compareDataTypeArrays, Location, formatLoc, INTRINSICS } from "../shared";
import { StackElement, reportError, reportErrorWithStack, reportWarning } from "../errors";
import { IRConst, IRExpr, IRMemory, IRProc, IRProgram, IRType } from "../parser/ir";
import { AstType, Expr, IProgram, IPush, ISignature, IWord } from "../parser/ast";
import { Preprocessor } from "../parser";
import chalk from "chalk";

export interface Context {
  stack: DataTypeArray;
  stackLocations: Location[];
  macroExpansionStack: IWord[];
  // ...
}

export function createContext(stack: DataTypeArray = [], stackLocations: Location[] = []): Context {
  return {
    stack,
    stackLocations,
    macroExpansionStack: []
  }
}

export class TypeChecker {
  public readonly consts: Map<string, IRConst>;
  public readonly procs: Map<string, IRProc>;
  public readonly memories: Map<string, IRMemory>;
  public readonly program: IProgram;

  constructor (preprocessor: Preprocessor) {
    this.consts = preprocessor.consts;
    this.procs = preprocessor.procs;
    this.memories = preprocessor.memories;
    this.program = preprocessor.program;
  }

  public reportErrorWithStackData(
    message: string,
    loc: Location,
    ctx: Context,
    expectedStack: DataTypeArray,
    notes: string[] = []
  ): never {
    if (expectedStack.length) {
      notes.push(chalk.greenBright.bold("Expected data:"));
      for (const e of expectedStack)
        notes.push(` - ${chalk.bold(
          typeof e == "string" ? "Any" : DataType[e])
        }`);
    }

    if (ctx.stack.length) {
      notes.push(chalk.redBright.bold("Current data on the stack:"));
      for (let i = 0; i < ctx.stack.length; i++) {
        const e = ctx.stack[i];
        notes.push(` - ${chalk.bold(
          typeof e == "string" ? "Any" : DataType[e])
        } @ ${formatLoc(ctx.stackLocations[i])}`);
      }
    }

    reportErrorWithStack(message, loc, ctx.macroExpansionStack, notes);
  }

  public validateContextStack(
    loc: Location,
    ctx: Context,
    stack: DataTypeArray,
    strictLength: boolean = true,
    suffix: string = "",
    notes: string[] = []
  ) {
    if (ctx.stack.length < stack.length) {
      this.reportErrorWithStackData(`Insufficient data on the stack ${suffix}`, loc, ctx, stack, notes);
    }

    if (strictLength) {
      if (ctx.stack.length > stack.length) {
        this.reportErrorWithStackData(`Unhandled data on the stack ${suffix}`, loc, ctx, stack, notes);
      } else if (!compareDataTypeArrays(stack, ctx.stack)) {
        this.reportErrorWithStackData(`Unexpected data on the stack ${suffix}`, loc, ctx, stack, notes);
      }
    } else {
      const currentStack = ctx.stack.slice().reverse().slice(0, stack.length);

      if (!compareDataTypeArrays(stack.slice().reverse(), currentStack)) {
        this.reportErrorWithStackData(
          `Unexpected data on the stack ${suffix}`,
          loc, ctx, stack, notes
        );
      }
    }
  }

  public handleSignature(signature: ISignature, ctx: Context, loc: Location) {
    const templates = new Map<string, DataType | string>();

    for (const type of signature.ins) {
      ctx.stackLocations.pop();
      if (typeof type == "string") {
        templates.set(type, ctx.stack.pop()!);
      } else {
        ctx.stack.pop();
      }
    }

    for (let i = signature.outs.length - 1; i >= 0; i--) {
      const type = signature.outs[i];
      ctx.stackLocations.push(loc);
      if (typeof type == "string") {
        ctx.stack.push(templates.get(type)!);
      } else {
        ctx.stack.push(type);
      }
    }
  }

  public typecheckBody(exprs: IRExpr[], ctx: Context = createContext()) {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (expr.name == "<dump-stack>") {
          console.debug(chalk.blueBright.bold("debug:"), "Current data on the stack at", chalk.gray(formatLoc(expr.loc)));

          for (let i = 0; i < ctx.stack.length; i++) {
            const e = ctx.stack[i];
            console.debug(
              chalk.blueBright.bold("debug:"),
              "-", chalk.bold(
                typeof e == "string" ? "Any" : DataType[e]
              ),
              "@", chalk.bold(formatLoc(ctx.stackLocations[i]))
            );
          }
        } else if (this.procs.has(expr.name)) {
          const proc = this.procs.get(expr.name)!;

          if (!proc.signature) {
            if (proc.unsafe) {
              reportError(
                "Call of an unsafe procedure in a safe context", expr.loc, [
                  "the unsafe procedure must have a signature defined"
                ]
              );
            } else {
              proc.signature = this.inferProcSignature(proc, [{
                loc: expr.loc,
                name: proc.name
              }]);
            }
          }

          this.validateContextStack(expr.loc, ctx, proc.signature.ins, false, "for the procedure call");
          this.handleSignature(proc.signature, ctx, expr.loc);
        } else if (this.memories.has(expr.name)) {
          ctx.stack.push(DataType.Ptr);
          ctx.stackLocations.push(expr.loc);
        } else if (INTRINSICS.has(expr.name)) {
          const intrinsic = INTRINSICS.get(expr.name)!;

          this.validateContextStack(expr.loc, ctx, intrinsic.ins, false, "for the intrinsic call");
          this.handleSignature(intrinsic, ctx, expr.loc);
        } else {
          reportError("Unknown word", expr.loc);
        }
      } else if (expr.type == IRType.While) {
        const initialStack = structuredClone(ctx.stack);

        this.typecheckBody(expr.condition, ctx);
        this.validateContextStack(expr.loc, ctx, [DataType.Bool], false, "in the condition of the loop");
        ctx.stackLocations.pop();
        ctx.stack.pop();

        this.typecheckBody(expr.body, ctx);
        this.validateContextStack(expr.loc, ctx, initialStack, true, "after a single interation of the loop");
      } else if (expr.type == IRType.If) {
        this.validateContextStack(expr.loc, ctx, [DataType.Bool], false, "for the condition");
        ctx.stackLocations.pop();
        ctx.stack.pop();

        const branches = [];

        if (expr.body.length > 0) {
          const clone = createContext(structuredClone(ctx.stack), ctx.stackLocations.slice());
          this.typecheckBody(expr.body, clone);
          branches.push(clone);
        }

        if (expr.else.length > 0) {
          const clone = createContext(structuredClone(ctx.stack), ctx.stackLocations.slice());
          this.typecheckBody(expr.else, clone);
          branches.push(clone);
        }

        if (branches.length > 1) {
          this.validateContextStack(expr.loc, branches[1], branches[0].stack, true, "after the condition", [
            "Both branches must result in the same data on the stack"
          ]);
        }

        if (branches.length > 0) {
          this.validateContextStack(expr.loc, branches[0], ctx.stack, true, "after the condition", [
            "Conditions must not change the types and the amount of elements on the stack"
          ]);
          ctx.stack = branches[0].stack;
          ctx.stackLocations = branches[0].stackLocations;
        }
      } else if (expr.type == AstType.Push) {
        if (expr.datatype == DataType.AsmBlock) {
          reportError(
            "Assembly blocks cannot be used outside of unsafe procedures", expr.loc
          );
        }

        ctx.stack.push(expr.datatype);
        ctx.stackLocations.push(expr.loc);
      } else {
        throw new Error(`Typechecking is not implemented for ${IRType[(expr as IRExpr).type]}`);
      }
    }
  }

  public typecheckProc(proc: IRProc, ctx: Context = createContext()) {
    if (proc.name == "main") {
      if (proc.signature!.ins.length > 0) {
        reportError(
          "The main procedure must not accept any data from the stack",
          proc.loc
        );
      } else if (proc.signature!.outs.length > 0) {
        reportError(
          "The main procedure must not return anything",
          proc.loc
        );
      }
    }

    this.typecheckBody(proc.body, ctx);
    this.validateContextStack(proc.loc, ctx, proc.signature!.outs, true, "after the procedure call");
  }

  public inferSignature(
    exprs: IRExpr[],
    callstack: StackElement[] = [],
    ins: DataTypeArray = [],
    outs: DataTypeArray = [],
    templates: TemplateMap = new Map()
  ): ISignature & {
    templates: TemplateMap
  } {
    for (const expr of exprs) {
      if (expr.type == IRType.Word) {
        if (this.procs.has(expr.name)) {
          const proc = this.procs.get(expr.name)!;
          if (!proc.signature) {
            if (callstack.find((x) => x.name == expr.name)) {
              reportErrorWithStack(
                "Recursive calls of procedures without signatures are not supported",
                expr.loc, callstack
              );
            } else {
              this.inferProcSignature(proc, callstack.concat(expr));
            }
          }

          const tmpl: TemplateMap = new Map();

          for (const type of proc.signature!.ins) {
            if (typeof type == "string") {
              if (outs.length) {
                tmpl.set(type, outs.pop()!);
              } else {
                tmpl.set(type, type);
                ins.push(type);
              }
            } else if (outs.length) {
              const e = outs.pop();
              if (typeof e == "string" && !templates.has(e)) {
                templates.set(e, type);
              }
            } else {
              ins.push(type);
            }
          }

          for (let i = proc.signature!.outs.length - 1; i >= 0; i--) {
            const type = proc.signature!.outs[i];
            if (typeof type == "string") {
              outs.push(tmpl.get(type)!);
            } else {
              outs.push(type);
            }
          }
        } else if (INTRINSICS.has(expr.name)) {
          const intrinsic = INTRINSICS.get(expr.name)!;
          const tmpl: TemplateMap = new Map();

          for (const type of intrinsic.ins) {
            if (typeof type == "string") {
              if (outs.length) {
                tmpl.set(type, outs.pop()!);
              } else {
                tmpl.set(type, type);
                ins.push(type);
              }
            } else if (outs.length) {
              const e = outs.pop();
              if (typeof e == "string" && !templates.has(e)) {
                templates.set(e, type);
              }
            } else {
              ins.push(type);
            }
          }

          for (let i = intrinsic.outs.length - 1; i >= 0; i--) {
            const type = intrinsic.outs[i];
            if (typeof type == "string") {
              outs.push(tmpl.get(type)!);
            } else {
              outs.push(type);
            }
          }
        }
      } else if (expr.type == IRType.While) {
        this.inferSignature(expr.condition, callstack, ins, outs);
        outs.pop();

        this.inferSignature(expr.body, callstack, ins, outs);
      } else if (expr.type == IRType.If) {
        if (outs.length) outs.pop();
        else ins.push(DataType.Bool);

        if (expr.body.length > 0) {
          this.inferSignature(expr.body, callstack, ins, outs);
        }
      } else if (expr.type == AstType.Push) {
        if (expr.datatype != DataType.AsmBlock) {
          outs.push(expr.datatype);
        }
      } else {
        throw new Error(`Typechecking is not implemented for ${IRType[(expr as IRExpr).type]}`);
      }
    }

    return {
      ins, outs, templates
    };
  }

  public inferProcSignature(proc: IRProc, callstack: StackElement[] = []): ISignature {
    if (!proc.signature) {
      if (proc.name == "main") {
        proc.signature = { ins: [], outs: [] };
      } else {
        const signature = this.inferSignature(proc.body, callstack);

        proc.signature = {
          ins: signature.ins.map(
            (x) => typeof x == "string"
              ? signature.templates.get(x) ?? x
              : x
          ),
          outs: signature.outs.map(
            (x) => typeof x == "string"
              ? signature.templates.get(x) ?? x
              : x
          )
        }
      }
    }

    return proc.signature;
  }

  public typecheckProgram(program: IRProgram) {
    program.procs.forEach((proc) => {
      if (proc.unsafe) {
        return;
      }

      const ctx = createContext();

      if (!proc.signature) {
        proc.signature = this.inferProcSignature(proc, [{
          name: proc.name,
          loc: proc.loc
        }]);
      } else if (
        proc.signature.ins.find((x) => typeof x == "string")
        || proc.signature.outs.find((x) => typeof x == "string")
      ) {
        reportError(
          "Generics in the signatures are allowed only for unsafe procedures", proc.loc
        );
      }

      for (const e of proc.signature.ins) {
        ctx.stack.push(e);
        ctx.stackLocations.push(proc.loc);
      }

      this.typecheckProc(proc, ctx);
    });
  }
}