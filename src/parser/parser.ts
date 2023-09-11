import { AstKind, Condition, Expr, IProc, IProgram, Let, Proc, Program, While, WordType } from "./ast";
import { tokenToDataType, Location, formatLoc, INTRINSICS } from "../shared";
import { Token, Tokens } from "../lexer";
import { reportError } from "../errors";
import chalk from "chalk";
import { checkUniqueDefinition } from ".";

const tokenFmt = chalk.yellowBright.bold;

export class Parser {
  public readonly program: Program;
  private readonly procs: Map<string, IProc>;

  private tokens: Token[] = [];
  private cursor: number = 0;

  constructor(program: IProgram) {
    this.procs = program.procs;
    this.program = {
      file: program.file,
      consts: program.consts,
      memories: program.memories,
      procs: new Map()
    };
  }

  private next(): Token {
    return this.tokens[this.cursor++];
  }

  private parseExpr(token: Token, loc: Location, bindings: Set<string>): Expr {
    if (token.kind == Tokens.If) {
      return this.parseConditionBlock(token.loc, bindings);
    } else if (token.kind == Tokens.While) {
      return this.parseWhileBlock(token.loc, bindings);
    } else if (token.kind == Tokens.Let) {
      return this.parseLetBlock(token.loc, bindings);
    } else if (token.kind == Tokens.Word) {
      const type = (
        INTRINSICS.has(token.value)
          ? WordType.Intrinsic
        : this.procs.has(token.value)
          ? WordType.Proc
        : this.program.consts.has(token.value)
          ? WordType.Constant
        : this.program.memories.has(token.value)
          ? WordType.Memory
        : bindings.has(token.value)
          ? WordType.Binding
        : null
      );

      if (type == null) {
        reportError("Invalid or unknown word", token.loc);
      }

      return {
        kind: AstKind.Word, type,
        value: token.value,
        loc: token.loc
      };
    } else if (
      token.kind == Tokens.Int
      || token.kind == Tokens.Str
      || token.kind == Tokens.CStr
      || token.kind == Tokens.Boolean
      || token.kind == Tokens.AsmBlock
    ) {
      return {
        kind: AstKind.Push,
        type: tokenToDataType(token.kind),
        value: token.value,
        loc: token.loc
      };
    } else {
      reportError(
        `Unexpected ${tokenFmt(token.kind)}`, token.loc,
        [`block starts at ${chalk.bold(formatLoc(loc))}`]
      );
    }
  }

  private parseConditionBlock(loc: Location, bindings: Set<string>): Condition {
    const condition: Condition = {
      kind: AstKind.If, loc,
      body: [], else: [],
    }

    while (true) {
      const token = this.next();
      if (token.kind == Tokens.End) return condition;
      else if (token.kind == Tokens.Else) break;
      else condition.body.push(this.parseExpr(token, loc, bindings));
    }

    while (true) {
      const token = this.next();
      if (token.kind == Tokens.End) break;
      else if (token.kind == Tokens.ChainedIf) {
        condition.else.push(this.parseConditionBlock(token.loc, bindings));
        break;
      } else condition.else.push(this.parseExpr(token, loc, bindings));
    }

    return condition;
  }

  private parseWhileBlock(loc: Location, bindings: Set<string>): While {
    const loop: While = {
      kind: AstKind.While, loc,
      condition: [],
      body: [],
    }

    while (true) {
      const token = this.next();
      if (token.kind == Tokens.Do) break;
      else loop.condition.push(this.parseExpr(token, loc, bindings));
    }

    loop.body = this.parseBody(loc, bindings);
    return loop;
  }

  private parseLetBlock(loc: Location, bindings: Set<string>): Let {
    const binding: Let = {
      kind: AstKind.Let, loc,
      bindings: [],
      body: []
    }

    while (true) {
      const token = this.next();
      if (token.kind == Tokens.Word) {
        checkUniqueDefinition(
          token.value,
          this.procs,
          this.program.consts,
          this.program.memories,
          bindings, token.loc
        );

        binding.bindings.push(token.value);
        bindings.add(token.value);
      } else if (token.kind == Tokens.Do) {
        break;
      } else {
        reportError(
          `Expected ${tokenFmt("<word>")} or ${tokenFmt("do")} but got ${tokenFmt(token.kind)}`,
          token.loc
        );
      }
    }

    binding.body = this.parseBody(loc, bindings);

    for (const b of binding.bindings)
      bindings.delete(b);

    return binding;
  }

  private parseBody(loc: Location, bindings: Set<string>): Expr[] {
    const body: Expr[] = [];

    while (true) {
      const token = this.next();

      if (token && token.kind != Tokens.End) {
        body.push(this.parseExpr(token, loc, bindings));
      } else break;
    }

    return body;
  }

  public parseProc(proc: IProc): Proc {
    this.tokens = proc.body;
    this.cursor = 0;

    const body = this.parseBody(proc.loc, new Set());

    return {
      kind: AstKind.Proc,
      name: proc.name,
      signature: proc.signature,
      loc: proc.loc,
      unsafe: proc.unsafe,
      inline: proc.inline,
      body
    }
  }

  public parse(): Program {
    this.procs.forEach((proc) => {
      this.program.procs.set(proc.name, this.parseProc(proc));
    });

    return this.program;
  }
}