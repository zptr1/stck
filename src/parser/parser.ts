import { AstKind, Condition, Const, Expr, Let, LiteralType, Proc, Program, Signature, Var, While, WordType } from "./ast";
import { DataType, INTRINSICS, Location, TypeFrame, sizeOf } from "../shared";
import { Err, StckError } from "../errors";
import { Token, Tokens } from "../lexer";
import chalk from "chalk";

export class Parser {
  public readonly procs = new Map<string, Proc>();
  public readonly consts = new Map<string, Const>();
  public readonly memories = new Map<string, Const>();
  public readonly vars = new Map<string, Var>();

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
    if (!token || token.kind != kind) {
      new StckError("unexpected token")
        .add(Err.Error, token?.loc ??  this.lastToken.loc, `expected \`${kind}\``)
        .throw();
    }

    return token;
  }

  private checkUniqueDefinition(name: string, loc: Location) {
    if (INTRINSICS.has(name)) {
      new StckError("duplicated name")
        .add(Err.Error, loc, "there is already an intrinsic with the same name")
        .throw();
    } else if (this.procs.has(name)) {
      new StckError("duplicated name")
        .add(Err.Error, loc, "there is already a procedure with the same name")
        .add(Err.Note, this.procs.get(name)!.loc, "defined here")
        .throw();
    } else if (this.consts.has(name)) {
      new StckError("duplicated name")
        .add(Err.Error, loc, "there is already a constant with the same name")
        .add(Err.Note, this.consts.get(name)!.loc, "defined here")
        .throw();
    } else if (this.memories.has(name)) {
      new StckError("duplicated name")
        .add(Err.Error, loc, "there is already a memory region with the same name")
        .add(Err.Note, this.memories.get(name)!.loc, "defined here")
        .throw();
    } else if (this.vars.has(name)) {
      new StckError("duplicated name")
        .add(Err.Error, loc, "there is already a variable with the same name")
        .add(Err.Note, this.vars.get(name)!.loc, "defined here")
        .throw();
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
        types: this.parseSignature(token.loc, [Tokens.End])[0]
      };
    } else if (token.kind == Tokens.If) {
      return this.parseCondition(token.loc);
    } else if (token.kind == Tokens.While) {
      return this.parseLoop(token.loc);
    } else if (token.kind == Tokens.Let) {
      return this.parseBinding(token.loc);
    } else {
      return new StckError("unexpected token")
        .add(Err.Error, token.loc)
        .throw();
    }
  }

  private parseCondition(loc: Location): Condition {
    const condition: Condition = {
      kind: AstKind.If, loc,
      condition: [],
      body: [],
      else: []
    }

    while (true) {
      const token = this.next();

      if (!token) {
        new StckError("unclosed block")
          .add(Err.Error, loc, "this condition was never closed")
          .throw();
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
        new StckError("unclosed block")
          .add(Err.Error, loc, "this condition was never closed")
          .throw();
      } else if (token.kind == Tokens.Else) {
        condition.else = this.parseBody(token.loc);
        condition.elseBranch = token.loc;
        break;
      } else if (token.kind == Tokens.ElseIf) {
        condition.else.push(this.parseCondition(token.loc));
        condition.elseBranch = token.loc;
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
        new StckError("unclosed block")
          .add(Err.Error, loc, "this loop was never closed")
          .throw();
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
        new StckError("unclosed block")
          .add(Err.Error, loc, "this binding was never closed")
          .throw();
      } else if (token.kind == Tokens.Do) {
        binding.body = this.parseBody(token.loc);
        break;
      } else if (token.kind == Tokens.Word) {
        binding.bindings.push(token.value);
      } else {
        new StckError("unexpected token")
          .add(Err.Note, loc, "binding starts here")
          .add(Err.Error, token.loc, "expected a word")
          .throw();
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
        new StckError("invalid compile-time expression")
          .add(Err.Note, loc)
          .add(Err.Error, token.loc, `cannot use ${token.kind} here`)
          .throw();
      } else {
        body.push(this.parseExpr(token));
      }
    }

    return new StckError("unclosed block")
      .add(Err.Error, loc, "this block was never closed")
      .throw();
  }

  private parseType(token: Token, loc: Location, unsafe: boolean = false): TypeFrame {
    if (token.value == "int") {
      return {
        type: DataType.Int,
        loc: token.loc
      }
    } else if (token.value == "bool") {
      return {
        type: DataType.Bool,
        loc: token.loc
      }
    } else if (token.value == "ptr") {
      return {
        type: DataType.Ptr,
        loc: token.loc
      }
    } else if (token.value == "ptr") {
      return {
        type: DataType.Ptr,
        loc: token.loc
      }
    } else if (token.value == "ptr-to") {
      return {
        type: DataType.PtrTo, loc: token.loc,
        value: this.parseType(this.nextOf(Tokens.Word), loc, unsafe)
      }
    } else if (token.value == "unknown") {
      if (!unsafe) {
        return new StckError("invalid type")
          .add(Err.Note, loc, "type signature starts here")
          .add(Err.Error, token.loc, "unknown types are not allowed")
          .addHint("unknown types can be used in unsafe procedures")
          .addHint("please note that unsafe procedures are not recommended to use")
          .throw();
      }

      return {
        type: DataType.Unknown, loc: token.loc
      }
    } else if (token.value[0] == "<" && token.value.endsWith(">")) {
      if (!unsafe) {
        return new StckError("invalid type")
          .add(Err.Note, loc, "type signature starts here")
          .add(Err.Error, token.loc, "generic types are not allowed")
          .addHint("generic types can be used in unsafe procedures")
          .addHint("please note that unsafe procedures are not recommended to use")
          .throw();
      }

      return {
        type: DataType.Generic, loc: token.loc,
        label: token.value,
        value: {
          type: DataType.Unknown
        }
      }
    } else {
      return new StckError("invalid type")
        .add(Err.Note, loc, "type signature starts here")
        .add(Err.Error, token.loc, "unknown word")
        .throw();
    }
  }

  private parseSignature(loc: Location, end: Tokens[], unsafe: boolean = false): [TypeFrame[], Token] {
    const types: TypeFrame[] = [];

    while (this.tokens.length) {
      const token = this.next();

      if (!token) {
        break;
      } else if (end.includes(token.kind)) {
        return [types, token];
      } else if (token.kind == Tokens.Word) {
        types.push(this.parseType(token, loc, unsafe));
      } else {
        new StckError("invalid type")
          .add(Err.Note, loc, "type signature starts here")
          .add(Err.Error, token.loc, "unexpected token")
          .throw();
      }
    }

    return new StckError("unclosed block")
      .add(Err.Error, loc, "this signature was never closed")
      .throw();
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
      const [types, end] = this.parseSignature(token.loc, [Tokens.Do, Tokens.SigOuts], unsafe);
      proc.signature.ins = types;

      if (end.kind == Tokens.SigOuts) {
        const [types, end2] = this.parseSignature(end.loc, [Tokens.Do], unsafe);
        proc.signature.outs = types;
        proc.body = this.parseBody(end2.loc);
      } else {
        proc.body = this.parseBody(end.loc);
      }
    } else if (token.kind == Tokens.SigOuts) {
      const [types, end] = this.parseSignature(token.loc, [Tokens.Do], unsafe);
      proc.signature.outs = types;
      proc.body = this.parseBody(end.loc);
    } else if (token.kind == Tokens.Do) {
      proc.body = this.parseBody(token.loc);
    } else {
      new StckError("unexpected token")
        .add(Err.Note, loc, "procedure defined here")
        .add(Err.Error, token.loc, "unexpected token")
        .addHint(`did you forget to add ${chalk.yellow.bold("do")} after the name of the procedure?`)
        .throw();
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

  private parseVar(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);
    const [sig, end] = this.parseSignature(name.loc, [Tokens.End]);

    if (sig.length < 1) {
      new StckError("invalid type signature")
        .add(Err.Note, loc, "variable defined here")
        .add(Err.Error, end.loc, "expected a type but got nothing")
        .throw();
    } else if (sig.length > 1) {
      new StckError("invalid type signature")
        .add(Err.Note, loc, "variable defined here")
        .add(Err.Error, sig[1].loc!, "expected a single type but got multiple")
        .throw();
    }

    this.vars.set(name.value, {
      kind: AstKind.Var, loc,
      name: name.value,
      type: sig[0],
      size: sizeOf(sig[0])
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
        new StckError("unexpected token")
          .add(Err.Error, token.loc, "expected procedure declaration here")
          .throw();
      } else if (token.kind == Tokens.Const) {
        this.parseConst(token.loc);
      } else if (token.kind == Tokens.Memory) {
        this.parseMemory(token.loc);
      } else if (token.kind == Tokens.Var) {
        this.parseVar(token.loc);
      } else if (token.kind == Tokens.Assert) {
        throw new Error("Assertions are not implemented yet");
      } else {
        new StckError("unexpected token")
          .add(Err.Error, token.loc, "invalid token at the top level")
          .throw();
      }
    }

    return {
      file: this.lastToken.loc.file,
      procs: this.procs,
      consts: this.consts,
      memories: this.memories,
      vars: this.vars
    }
  }
}