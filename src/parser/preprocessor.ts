import { DataType, DataTypeArray, File, INTRINSICS, Location, formatLoc, tokenToDataType } from "../shared";
import { Context, createContext, handleSignature, validateContextStack } from "../compiler";
import { StackElement, reportError, reportErrorWithStack, reportErrorWithoutLoc, reportWarning } from "../errors";
import { AstKind, Const, IProc, IProgram, Proc } from ".";
import { Lexer, Token, Tokens } from "../lexer";
import { ROOT_DIR } from "../const";
import { existsSync } from "fs";
import chalk from "chalk";
import plib from "path";

const tokenFmt = chalk.yellow.bold;

export function checkUniqueDefinition(
  name: string,
  procs: Map<string, IProc | Proc>,
  consts: Map<string, Const>,
  memories: Map<string, Const>,
  bindings: Set<string>,
  loc: Location
) {
  if (procs.has(name)) {
    const proc = procs.get(name)!;
    reportError(
      "A procedure with the same name is already defined", loc,
      [`originally defined here ${chalk.bold(formatLoc(proc.loc))}`]
    );
  } else if (consts.has(name)) {
    const constant = consts.get(name)!;
    reportError(
      "A constant with the same name is already defined", loc,
      [`originally defined here ${chalk.bold(formatLoc(constant.loc))}`]
    );
  } else if (memories.has(name)) {
    const memory = memories.get(name)!;
    reportError(
      "A memory region with the same name is already defined", loc,
      [`originally defined here ${chalk.bold(formatLoc(memory.loc))}`]
    );
  } else if (bindings.has(name)) {
    reportError("A binding with the same name is already defined", loc);
  } else if (INTRINSICS.has(name)) {
    reportError(
      "An intrinsic with the same name already exists",
      loc
    );
  }
}

export class Preprocessor {
  public readonly tokens: Token[] = [];
  public readonly macros: Map<string, Token[]> = new Map();
  public readonly program: IProgram;

  private includedFiles = new Set<string>();
  private includeDepth: number = 0;

  private lastToken: Token | undefined = undefined;

  constructor(tokens: Token[]) {
    this.tokens = tokens.reverse();

    if (tokens.length == 0) {
      reportErrorWithoutLoc("The file is empty");
    }

    const file = this.tokens[0].loc.file;
    this.includedFiles.add(file.path);
    this.include(plib.join(ROOT_DIR, "lib/prelude.stck"), file);

    this.program = {
      file,
      procs: new Map(),
      consts: new Map(),
      memories: new Map()
    }
  }

  private next(): Token {
    return (
      this.lastToken = this.tokens.pop()!
    );
  }

  private peek(): Token | undefined {
    return this.tokens.at(-1);
  }

  private isEnd(): boolean {
    return this.tokens.length == 0;
  }

  private nextOf(kind: Tokens): Token {
    if (this.isEnd()) reportError(
      `Expected ${tokenFmt(kind)} but got ${tokenFmt("EOF")}`,
      this.lastToken!.loc
    );

    const token = this.next();
    if (token.kind != kind) reportError(
      `Expected ${tokenFmt(kind)} but got ${tokenFmt(token.kind)}`,
      token.loc
    );

    return token;
  }

  private checkUniqueDefinition(name: string, loc: Location) {
    checkUniqueDefinition(
      name,
      this.program.procs,
      this.program.consts,
      this.program.memories,
      new Set(),
      loc
    );
  }

  private evaluateIntrinsic(name: string, loc: Location, ctx: Context, stack: any[]) {
    if (name == "add") {
      stack.push(stack.pop() + stack.pop());
    } else if (name == "mul") {
      stack.push(stack.pop() * stack.pop());
    } else if (name == "sub") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs - rhs);
    } else if (name == "divmod") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs / rhs);
      stack.push(lhs % rhs);
    } else if (name == "eq") {
      stack.push(BigInt(stack.pop() == stack.pop()));
    } else if (name == "neq") {
      stack.push(BigInt(stack.pop() != stack.pop()));
    } else if (name == "lt") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(BigInt(lhs > rhs));
    } else if (name == "gt") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(BigInt(lhs < rhs));
    } else if (name == "lteq") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(BigInt(lhs > rhs || lhs == rhs));
    } else if (name == "gteq") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(BigInt(lhs < rhs || lhs == rhs));
    } else if (name == "shl") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs << rhs);
    } else if (name == "shr") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs >> rhs);
    } else if (name == "not") {
      stack.push(~stack.pop());
    } else if (name == "or") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs | rhs);
    } else if (name == "and") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs & rhs);
    } else if (name == "xor") {
      const rhs = stack.pop(), lhs = stack.pop();
      stack.push(lhs ^ rhs);
    } else if (name == "dup") {
      const a = stack.pop();
      stack.push(a, a);
    } else if (name == "drop") {
      stack.pop();
    } else if (name == "swap") {
      stack.push(stack.pop(), stack.pop());
    } else if (name == "2swap") {
      stack.push(
        stack.pop(), stack.pop(),
        stack.pop(), stack.pop(),
      );
    } else if (name == "rot") {
      const a = stack.pop(), b = stack.pop(), c = stack.pop();
      stack.push(b, a, c);
    } else if (name == "over") {
      const a = stack.pop(), b = stack.pop();
      stack.push(b, a, b);
    } else if (name == "2dup") {
      const a = stack.pop(), b = stack.pop();
      stack.push(b, a, b, a);
    } else if (name == "<dump-stack>") {
      console.log(
        chalk.blueBright.bold("debug:"),
        "Current values on the stack"
      );

      for (let i = 0; i < stack.length; i++) {
        const loc = ctx.stackLocations[i];
        const type = ctx.stack[i];
        const val = stack[i];

        console.debug(
          chalk.blueBright.bold("debug:"),
          "-", `${
            chalk.bold(
              typeof type == "string"
                ? "Any"
                : DataType[type]
            )
          }(${
            typeof val == "string"
              ? chalk.yellow(JSON.stringify(val))
              : chalk.cyan(val)
          })`, "@", chalk.bold(formatLoc(loc))
        );
      }
    } else {
      reportError(
        "This intrinsic cannot be used in compile-time expressions",
        loc
      );
    }
  }

  private constOffset: number = 0;

  private evaluateConstant(name: string, start: Location): Const {
    const ctx = createContext();
    const stack: any[] = [];

    while (!this.isEnd()) {
      const token = this.next();

      if (token.kind == Tokens.Word) {
        if (INTRINSICS.has(token.value)) {
          const intrinsic = INTRINSICS.get(token.value)!;

          validateContextStack(token.loc, ctx, intrinsic.ins, false, "for the intrinsic call");
          handleSignature(intrinsic, ctx, token.loc);
          this.evaluateIntrinsic(token.value, token.loc, ctx, stack);
        } else if (this.program.consts.has(token.value)) {
          const constant = this.program.consts.get(token.value)!;
          stack.push(constant.value);
          ctx.stack.push(constant.type);
          ctx.stackLocations.push(token.loc);
        } else if (token.value == "offset") {
          validateContextStack(token.loc, ctx, [DataType.Int], false, "for `offset`");

          const offset = this.constOffset;
          this.constOffset += Number(stack.pop()!);
          stack.push(BigInt(offset));

          ctx.stackLocations.pop();
          ctx.stackLocations.push(token.loc);
        } else if (token.value == "reset") {
          stack.push(BigInt(this.constOffset));
          ctx.stack.push(DataType.Int);
          ctx.stackLocations.push(token.loc);
          this.constOffset = 0;
        } else {
          reportError("Unknown word in the compile-time expression", token.loc);
        }
      } else if (
        token.kind == Tokens.Int
        || token.kind == Tokens.Boolean
        || token.kind == Tokens.Str
        || token.kind == Tokens.CStr
      ) {
        if (token.kind == Tokens.Int) {
          stack.push(BigInt(token.value));
        } else {
          stack.push(token.value);
        }

        ctx.stack.push(tokenToDataType(token.kind));
        ctx.stackLocations.push(token.loc);
      } else if (token.kind == Tokens.End) {
        validateContextStack(token.loc, ctx, ["any"], true, "for the constant");
        break;
      } else {
        reportError(
          `${tokenFmt(token.kind)} cannot be used in compile-time expressions`,
          token.loc
        );
      }
    }

    const type = ctx.stack.pop()!;
    const value = stack.pop()!;

    if (typeof type == "string") {
      throw new Error(`Compile time expression resulted in an invalid output`);
    }

    return {
      kind: AstKind.Const,
      name, type, value,
      loc: start
    }
  }

  public readBody(isMacro: boolean = false): Token[] {
    const macroExpansionStack: StackElement[] = [];
    const depth: Token[] = [this.lastToken!];
    const body: Token[] = [];

    while (!this.isEnd()) {
      const token = this.next();

      if (token.kind == Tokens.Word) {
        if (isMacro && token.value == "\\") {
          body.push(this.next());
        } else if (this.macros.has(token.value)) {
          const tokens = this.macros.get(token.value)!.slice().reverse();

          if (macroExpansionStack.find((x) => x.name == token.value)) {
            reportErrorWithStack(
              "Recursive macro expansion",
              token.loc, macroExpansionStack
            );
          }

          this.tokens.push({
            kind: Tokens.EOF,
            loc: token.loc
          });

          macroExpansionStack.push({
            name: token.value,
            loc: token.loc
          });

          for (const token of tokens)
            this.tokens.push(token);
        } else {
          body.push(token);
        }
      } else if (token.kind == Tokens.Assert) {
        const message = this.nextOf(Tokens.Str);
        const expr = this.evaluateConstant("assert", token.loc);
        if (expr.type != DataType.Bool) {
          reportError(
            `assert expression must result in a boolean (got ${DataType[expr.type]} instead)`,
            token.loc
          );
        }

        if (!expr.value) {
          reportError(
            message.value,
            token.loc
          );
        }
      } else if (
        token.kind == Tokens.While
        || token.kind == Tokens.If
        || token.kind == Tokens.Let
      ) {
        body.push(token);
        depth.push(token);
      } else if (
        token.kind == Tokens.Do
        || token.kind == Tokens.Else
        || token.kind == Tokens.ChainedIf
      ) {
        // for better error reporting
        depth.pop();
        depth.push(token);
        body.push(token);
      } else if (token.kind == Tokens.End) {
        if (depth.length > 1) {
          body.push(token);
          depth.pop();
        } else if (isMacro) {
          body.push(token);
        } else {
          return body;
        }
      } else if (token.kind == Tokens.EndPre && isMacro) {
        return body;
      } else if (token.kind == Tokens.EOF && macroExpansionStack.length) {
        macroExpansionStack.pop();
      } else {
        body.push(token);
      }
    }

    reportError("Unclosed block", depth.at(-1)!.loc);
  }

  public readProcSignature(end: Tokens[]): [DataTypeArray, Tokens] {
    const types: DataTypeArray = [];

    while (true) {
      const token = this.next();
      if (end.includes(token.kind)) {
        return [types, token.kind];
      } else if (token.kind == Tokens.Word) {
        if (token.value == "int") {
          types.push(DataType.Int);
        } else if (token.value == "ptr") {
          types.push(DataType.Ptr);
        } else if (token.value == "bool") {
          types.push(DataType.Bool);
        } else if (token.value.length == 1) { // template
          types.push(token.value);
        } else {
          reportError("Unknown type", token.loc);
        }
      } else {
        reportError(
          `Unexpected ${tokenFmt(token.kind)} in the procedure signature`,
          token.loc
        );
      }
    }
  }

  public readProc(inline: boolean, unsafe: boolean): IProc {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    const proc: IProc = {
      kind: AstKind.Proc,
      name: name.value,
      inline, unsafe,
      loc: name.loc,
      body: []
    }

    if (this.peek()?.kind == Tokens.SigIns) {
      this.next();
      const [ins, end] = this.readProcSignature([Tokens.Do, Tokens.SigOuts]);

      proc.signature = { ins: [], outs: [] };
      proc.signature.ins = ins;

      if (end == Tokens.SigOuts) {
        proc.signature.outs = this.readProcSignature([Tokens.Do])[0];
      }
    } else if (this.peek()?.kind == Tokens.SigOuts) {
      this.next();
      proc.signature = { ins: [], outs: [] };
      proc.signature.outs = this.readProcSignature([Tokens.Do])[0];
    } else if (this.peek()?.kind == Tokens.Do) {
      proc.signature = { ins: [], outs: [] };
      this.next();
    } else {
      reportWarning(
        "Signature inference is deprecated and will be removed in the future", proc.loc, [
          "You should define a signature for this procedure"
        ]
      );
    }

    proc.body = this.readBody();

    return proc;
  }

  public include(path: string, parent: File) {
    if (this.includedFiles.has(path)) return;
    this.includedFiles.add(path);

    const file = parent.child(path);
    const tokens = new Lexer(file).collect().reverse();

    this.includeDepth++;
    for (const tok of tokens)
      this.tokens.push(tok);
  }

  public preprocess(): IProgram {
    let inlineProc = false;
    let unsafeProc = false;

    while (!this.isEnd()) {
      const token = this.next();

      if (
        (inlineProc || unsafeProc)
        && token.kind != Tokens.Proc
        && token.kind != Tokens.Unsafe
        && token.kind != Tokens.Inline
      ) {
        reportError(
          `Expected ${tokenFmt("proc")} but got ${tokenFmt(token.kind)}`,
          token.loc
        );
      }

      if (token.kind == Tokens.Include) {
        const tok = this.nextOf(Tokens.Str);

        const paths = tok.value.startsWith(".") ? [
          plib.join(plib.dirname(token.loc.file.path), tok.value + ".stck")
        ] : [
          plib.join(ROOT_DIR, "lib", tok.value + ".stck"),
          plib.join(process.cwd(), "lib", tok.value + ".stck"),
        ];

        const path = paths.find((x) => existsSync(x));
        if (!path) reportError(
          "Unresolved import", tok.loc
        );

        this.include(plib.resolve(path), token.loc.file);
      } else if (token.kind == Tokens.Macro) {
        const name = this.nextOf(Tokens.Word);
        const body = this.readBody(true);

        this.macros.set(name.value, body);
      } else if (token.kind == Tokens.Proc) {
        const proc = this.readProc(inlineProc, unsafeProc);
        inlineProc = false;
        unsafeProc = false;

        this.program.procs.set(proc.name, proc);
      } else if (token.kind == Tokens.Unsafe) {
        unsafeProc = true;
      } else if (token.kind == Tokens.Inline) {
        inlineProc = true;
      } else if (token.kind == Tokens.Const) {
        const name = this.nextOf(Tokens.Word);
        this.checkUniqueDefinition(name.value, name.loc);

        this.program.consts.set(
          name.value, this.evaluateConstant(name.value, token.loc)
        );
      } else if (token.kind == Tokens.Memory) {
        const name = this.nextOf(Tokens.Word);
        this.checkUniqueDefinition(name.value, name.loc);

        const memory = this.evaluateConstant(name.value, token.loc);
        if (memory.type != DataType.Int) {
          reportError(
            `Memory sizes must be integers (got ${DataType[memory.type]} instead)`,
            token.loc
          );
        }

        this.program.memories.set(name.value, memory);
      } else if (token.kind == Tokens.Assert) {
        const message = this.nextOf(Tokens.Str);
        const expr = this.evaluateConstant("assert", token.loc);
        if (expr.type != DataType.Bool) {
          reportError(
            `assert expression must result in a boolean (got ${DataType[expr.type]} instead)`,
            token.loc
          );
        }

        if (!expr.value) {
          reportError(
            message.value,
            token.loc
          );
        }
      } else if (token.kind == Tokens.EOF) {
        if (unsafeProc || inlineProc) {
          reportError(
            `Expected ${tokenFmt("proc")} but got ${tokenFmt("EOF")}`,
            this.lastToken!.loc
          );
        }

        if (this.includeDepth) {
          this.includeDepth--;
        } else {
          break;
        }
      } else {
        reportError(
          `Unexpected token ${tokenFmt(token.kind)} at top level`,
          token.loc
        )
      }
    }

    return this.program;
  }
}