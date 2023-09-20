import { AstKind, Condition, Const, Expr, Let, LiteralType, Proc, Program, While, WordType } from "./ast";
import { DataType, Location, TypeFrame } from "../shared";
import { Token, Tokens } from "../lexer";
import { reportError } from "../errors";
import chalk from "chalk";

export class Parser {
  public readonly procs = new Map<string, Proc>();
  public readonly consts = new Map<string, Const>();
  public readonly memories = new Map<string, Const>();

  private readonly lastToken: Token;

  constructor (
    private readonly tokens: Token[]
  ) {
    tokens.reverse();
    this.lastToken = tokens[0];
  }

  private next() {
    return this.tokens.pop()!;
  }

  private nextOf(kind: Tokens) {
    const token = this.next();
    if (!token || token.kind != kind) reportError(
      `Expected ${chalk.yellow.bold(kind)} but got ${chalk.yellow.bold(token?.kind ?? "EOF")}`,
      token?.loc ?? this.lastToken.loc
    );

    return token;
  }

  private checkUniqueDefinition(name: string, loc: Location) {
    if (this.procs.has(name)) {
      reportError("A procedure with the same name is already defined", loc);
    } else if (this.consts.has(name)) {
      reportError("A constant with the same name is already defined", loc);
    } else if (this.memories.has(name)) {
      reportError("A memory region with the same name is already defined", loc);
    }
  }

  private parseExpr(token: Token): Expr {
    if (
      token.kind == Tokens.Int
      || token.kind == Tokens.Boolean
      || token.kind == Tokens.Str
      || token.kind == Tokens.CStr
      || token.kind == Tokens.AsmBlock
    ) {
      return {
        kind: AstKind.Literal, loc: token.loc,
        type: (
          token.kind == Tokens.Int        ? LiteralType.Int
          : token.kind == Tokens.Boolean  ? LiteralType.Bool
          : token.kind == Tokens.Str      ? LiteralType.Str
          : token.kind == Tokens.CStr     ? LiteralType.CStr
          : token.kind == Tokens.AsmBlock ? LiteralType.Assembly
          : 0
        ),
        value: token.value
      }
    } else if (token.kind == Tokens.Word) {
      return {
        kind: AstKind.Word, loc: token.loc,
        type: WordType.Unknown,
        value: token.value
      }
    } else if (token.kind == Tokens.Cast) {
      return {
        kind: AstKind.Cast, loc: token.loc,
        types: this.parseSignature([Tokens.End])[0]
      };
    } else if (token.kind == Tokens.If) {
      return this.parseCondition(token.loc);
    } else if (token.kind == Tokens.While) {
      return this.parseLoop(token.loc);
    } else if (token.kind == Tokens.Let) {
      return this.parseBinding(token.loc);
    } else {
      reportError("Unexpected token", token.loc);
    }
  }

  private parseCondition(loc: Location): Condition {
    const condition: Condition = {
      kind: AstKind.If, loc,
      condition: [],
      body: [],
      else: [],
      elseBranch: false
    }

    while (true) {
      const token = this.next();

      if (!token) {
        reportError("Unclosed block", loc);
      } else if (token.kind == Tokens.Do) {
        loc = token.loc;
        break;
      } else {
        condition.condition.push(this.parseExpr(token));
      }
    }

    while (true) {
      const token = this.next();

      if (!token) {
        reportError("Unclosed block", loc);
      } else if (token.kind == Tokens.Else) {
        condition.else = this.parseBody(token.loc);
        condition.elseBranch = true;
        break;
      } else if (token.kind == Tokens.ElseIf) {
        condition.else.push(this.parseCondition(token.loc));
        condition.elseBranch = true;
        break;
      } else if (token.kind == Tokens.End) {
        break;
      } else {
        condition.body.push(this.parseExpr(token));
      }
    }

    return condition;
  }

  private parseLoop(loc: Location): While {
    const loop: While = {
      kind: AstKind.While, loc,
      condition: [],
      body: []
    }

    while (true) {
      const token = this.next();

      if (!token) {
        reportError("Unclosed block", loc);
      } else if (token.kind == Tokens.Do) {
        loop.body = this.parseBody(token.loc);
        break;
      } else {
        loop.condition.push(this.parseExpr(token));
      }
    }

    return loop;
  }

  private parseBinding(loc: Location): Let {
    const binding: Let = {
      kind: AstKind.Let, loc,
      bindings: [],
      body: []
    }

    while (true) {
      const token = this.next();

      if (!token) {
        reportError("Unclosed block", loc);
      } else if (token.kind == Tokens.Do) {
        binding.body = this.parseBody(token.loc);
        break;
      } else if (token.kind == Tokens.Word) {
        binding.bindings.push(token.value);
      } else {
        reportError("Unexpected token", token.loc);
      }
    }

    return binding;
  }

  private parseBody(loc: Location, constant: boolean = false): Expr[] {
    const body: Expr[] = [];

    while (this.tokens.length) {
      const token = this.next();

      if (token.kind == Tokens.End) {
        return body;
      } else if (
        constant && (
          token.kind == Tokens.Str
          || token.kind == Tokens.CStr
          || token.kind == Tokens.AsmBlock
          || token.kind == Tokens.If
          || token.kind == Tokens.While
        )
      ) {
        reportError(
          `Cannot use ${chalk.yellow.bold(token.kind)} in a compile-time expression`,
          token.loc
        );
      } else {
        body.push(this.parseExpr(token));
      }
    }

    reportError("Unclosed block", loc);
  }

  private parseSignature(end: Tokens[], unsafe: boolean = false): [TypeFrame[], Token] {
    const signature: TypeFrame[] = [];

    while (this.tokens.length) {
      const token = this.next();

      if (token.kind == Tokens.Word) {
        if (token.value == "int") {
          signature.push({
            type: DataType.Int,
            loc: token.loc
          });
        } else if (token.value == "bool") {
          signature.push({
            type: DataType.Bool,
            loc: token.loc
          });
        } else if (token.value == "ptr") {
          signature.push({
            type: DataType.Ptr,
            loc: token.loc
          });
        } else if (token.value == "ptr-to") {
          const type = signature.pop();
          if (!type) {
            reportError("Expected a type for `ptr-to`", token.loc);
          }

          signature.push({
            type: DataType.PtrTo,
            loc: token.loc,
            value: type
          });
        } else if (token.value == "unknown") {
          if (!unsafe) {
            reportError("The `unknown` type is allowed only in unsafe procedures", token.loc);
          }

          signature.push({
            type: DataType.Unknown,
            loc: token.loc
          });
        } else if (token.value.startsWith("<") && token.value.endsWith(">")) {
          if (!unsafe) {
            reportError("Custom generics are allowed only in unsafe procedures", token.loc);
          }

          signature.push({
            type: DataType.Generic, loc: token.loc,
            label: token.value.slice(1, -1),
            value: { type: DataType.Unknown }
          });
        } else {
          reportError(
            "Unknown type",
            token.loc
          );
        }
      } else if (end.includes(token.kind)) {
        return [signature, token];
      } else {
        reportError("Unexpected token in the type signature", token.loc);
      }
    }

    reportError("Unexpected EOF", this.lastToken.loc);
  }

  private parseProc(loc: Location, inline: boolean, unsafe: boolean) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    const proc: Proc = {
      kind: AstKind.Proc, loc,
      name: name.value,
      signature: { ins: [], outs: [] },
      inline, unsafe,
      body: [],
    }

    // TODO: Find a better way to do this
    const token = this.next();
    if (token.kind == Tokens.SigIns) {
      const [types, end] = this.parseSignature([Tokens.Do, Tokens.SigOuts], unsafe);
      proc.signature.ins = types;

      if (end.kind == Tokens.SigOuts) {
        const [types, end] = this.parseSignature([Tokens.Do], unsafe);
        proc.signature.outs = types;
        proc.body = this.parseBody(end.loc);
      } else {
        proc.body = this.parseBody(end.loc);
      }
    } else if (token.kind == Tokens.SigOuts) {
      const [types, end] = this.parseSignature([Tokens.Do], unsafe);
      proc.signature.outs = types;
      proc.body = this.parseBody(end.loc);
    } else if (token.kind == Tokens.Do) {
      proc.body = this.parseBody(token.loc);
    } else {
      reportError(
        "Unexpected token in the procedure declaration",
        token.loc
      );
    }

    this.procs.set(proc.name, proc);
  }

  private parseConst(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    this.consts.set(name.value, {
      kind: AstKind.Const, loc,
      name: name.value,
      body: this.parseBody(name.loc, true),
      type: { type: DataType.Unknown }
    });
  }

  private parseMemory(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    this.memories.set(name.value, {
      kind: AstKind.Const, loc,
      name: name.value,
      body: this.parseBody(name.loc, true),
      type: { type: DataType.Int }
    });
  }

  public parse(): Program {
    let inlineProc = false;
    let unsafeProc = false;

    while (this.tokens.length) {
      const token = this.next();

      if (token.kind == Tokens.Proc) {
        this.parseProc(token.loc, inlineProc, unsafeProc);
        inlineProc = false;
        unsafeProc = false;
      } else if (token.kind == Tokens.Inline) {
        inlineProc = true;
      } else if (token.kind == Tokens.Unsafe) {
        unsafeProc = true;
      } else if (inlineProc || unsafeProc) {
        reportError("Unexpected token in the procedure declaration", token.loc);
      } else if (token.kind == Tokens.Const) {
        this.parseConst(token.loc);
      } else if (token.kind == Tokens.Memory) {
        this.parseMemory(token.loc);
      } else if (token.kind == Tokens.Assert) {
        throw new Error("Assertions are not implemented yet");
      } else {
        reportError("Unexpected token at the top level", token.loc);
      }
    }

    return {
      file: this.lastToken.loc.file,
      procs: this.procs,
      consts: this.consts,
      memories: this.memories,
    }
  }
}