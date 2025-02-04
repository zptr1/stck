import { Assert, AstKind, Condition, Const, Expr, Extern, Let, LiteralType, Proc, Program, Var, While, WordType } from "./ast";
import { DataType, INTRINSICS, Location, TypeFrame, sizeOf } from "../shared";
import { Err, StckError } from "../errors";
import { i32_MAX, i32_MIN } from "../misc";
import { Token, Tokens } from "../lexer";

export class Parser {
  public readonly procs = new Map<string, Proc>();
  public readonly consts = new Map<string, Const>();
  public readonly memories = new Map<string, Const>();
  public readonly externs = new Map<string, Extern>();
  public readonly vars = new Map<string, Var>();
  public readonly assertions: Assert[] = [];
  public readonly libraries: string[] = [];

  private readonly lastToken: Token;
  private override: boolean = false;

  constructor (
    private readonly tokens: Token[]
  ) {
    tokens.reverse();
    this.lastToken = tokens[0];
  }

  private next() {
    return this.tokens.pop()!;
  }

  private peek() {
    return this.tokens.at(-1)!;
  }

  private nextOf(kind: Tokens, message?: string) {
    const token = this.next();
    if (!token || token.kind != kind) {
      throw new StckError(Err.UnexpectedToken)
        .addErr(token?.loc ?? this.lastToken.loc, message || `expected \`${kind}\``);
    }

    return token;
  }

  private checkUniqueDefinition({ loc, value }: Token) {
    if (INTRINSICS.has(value)) {
      throw new StckError(Err.DuplicatedDefinition)
        .addErr(loc, "there is already an intrinsic with the same name");
    }
    
    for (const registry of [this.procs, this.consts, this.memories, this.vars, this.externs]) {
      if (registry.has(value)) {
        if (this.override) registry.delete(value);
        else {
          throw new StckError(Err.DuplicatedDefinition)
            .addNote(registry.get(value)!.loc, "previously defined here")
            .addErr(loc, "duplicated definition of the word")
            .addHint("use `override` to override");
        }
      }
    }

    this.override = false;
  }

  private parseExpr(token: Token): Expr {
    // TODO: make this nicer
    if (token.kind == Tokens.Int) {
      return {
        kind: AstKind.Literal, loc: token.loc,
        type: token.value > i32_MAX || token.value < i32_MIN
          ? LiteralType.BigInt
          : LiteralType.Int,
        value: token.value
      };
    } else if (token.kind == Tokens.Str || token.kind == Tokens.CStr || token.kind == Tokens.AsmBlock) {
      return {
        kind: AstKind.Literal, loc: token.loc,
        type: (
          token.kind == Tokens.AsmBlock ? LiteralType.Assembly
          : token.kind == Tokens.CStr ? LiteralType.CStr
          : token.kind == Tokens.Str ? LiteralType.Str
          : 0
        ),
        value: token.value
      };
    } else if (token.kind == Tokens.Word) {
      return {
        kind: AstKind.Word, loc: token.loc,
        type: WordType.Unknown,
        value: token.value
      };
    } else if (token.kind == Tokens.Return) {
      return {
        kind: AstKind.Word, loc: token.loc,
        type: WordType.Return,
        value: token.value
      };
    } else if (token.kind == Tokens.Cast) {
      const types = this.parseSignature(token.loc);
      this.nextOf(Tokens.End);

      return { kind: AstKind.Cast, loc: token.loc, types };
    } else if (token.kind == Tokens.If) {
      return this.parseCondition(token.loc);
    } else if (token.kind == Tokens.While) {
      return this.parseLoop(token.loc);
    } else if (token.kind == Tokens.Let) {
      return this.parseBinding(token.loc);
    } else {
      throw new StckError(Err.UnexpectedToken)
        .addErr(token.loc);
    }
  }

  private parseCondition(loc: Location): Condition {
    const condition: Condition = {
      kind: AstKind.If, loc,
      condition: [],
      body: [],
      else: []
    };

    while (true) {
      const token = this.next();

      if (!token) {
        throw new StckError(Err.UnclosedBlock)
          .addErr(loc, "this condition was never closed");
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
        throw new StckError(Err.UnclosedBlock)
          .addErr(loc, "this condition was never closed");
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
    };

    while (true) {
      const token = this.next();

      if (!token) {
        throw new StckError(Err.UnclosedBlock)
          .addErr(loc, "this loop was never closed");
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
    };

    while (true) {
      const token = this.next();

      if (!token) {
        throw new StckError(Err.UnclosedBlock)
          .addErr(loc, "this binding was never closed");
      } else if (token.kind == Tokens.Do) {
        binding.body = this.parseBody(token.loc);
        break;
      } else if (token.kind == Tokens.Word) {
        binding.bindings.push(token.value);
      } else {
        throw new StckError(Err.UnexpectedToken)
          .addNote(loc, "binding starts here")
          .addErr(token.loc, "expected a word");
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
        throw new StckError(Err.InvalidComptime)
          .addErr(token.loc, `cannot use ${token.kind} here`)
          .addNote(loc);
      } else if (token.kind == Tokens.Assert) {
        this.parseAssert(token.loc);
      } else {
        body.push(this.parseExpr(token));
      }
    }

    throw new StckError(Err.UnclosedBlock)
      .addErr(loc, "this block was never closed");
  }

  private parseType(token: Token, loc: Location, unsafe: boolean = false): TypeFrame {
    if (token.value == "int") {
      return {
        type: DataType.Int,
        loc: token.loc
      };
    } else if (token.value == "bool") {
      return {
        type: DataType.Bool,
        loc: token.loc
      };
    } else if (token.value == "ptr") {
      return {
        type: DataType.Ptr,
        loc: token.loc
      };
    } else if (token.value == "ptr") {
      return {
        type: DataType.Ptr,
        loc: token.loc
      };
    } else if (token.value == "ptr-to") {
      return {
        type: DataType.PtrTo, loc: token.loc,
        value: this.parseType(this.nextOf(Tokens.Word), loc, unsafe)
      };
    } else if (token.value == "unknown") {
      if (!unsafe) {
        throw new StckError(Err.InvalidType)
          .addNote(loc, "type signature starts here")
          .addErr(token.loc, "unknown types are not allowed")
          .addHint("unknown types can be used in unsafe procedures")
          .addHint("please note that unsafe procedures are not recommended to use");
      }

      return {
        type: DataType.Unknown, loc: token.loc
      };
    } else if (token.value[0] == "<" && token.value.endsWith(">")) {
      if (!unsafe) {
        throw new StckError(Err.InvalidType)
          .addNote(loc, "type signature starts here")
          .addErr(token.loc, "generic types are not allowed")
          .addHint("generic types can be used in unsafe procedures")
          .addHint("please note that unsafe procedures are not recommended to use");
      }

      return {
        type: DataType.Generic, loc: token.loc,
        label: token.value,
        value: { type: DataType.Unknown }
      };
    } else {
      throw new StckError(Err.InvalidType)
        .addNote(loc, "type signature starts here")
        .addErr(token.loc, "unknown word");
    }
  }

  private parseSignature(loc: Location, unsafe: boolean = false): TypeFrame[] {
    const types: TypeFrame[] = [];

    while (this.tokens.length) {
      const token = this.nextOf(Tokens.Word, "expected a type");
      types.push(this.parseType(token, loc, unsafe));

      if (this.peek().kind != Tokens.Word) {
        return types;
      }
    }

    throw new StckError(Err.UnclosedBlock)
      .addErr(loc, "this signature was never closed");
  }

  private parseProc(loc: Location, inline: boolean, unsafe: boolean) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name);

    const proc: Proc = {
      kind: AstKind.Proc, loc,
      name: name.value,
      signature: {
        ins: this.peek().kind == Tokens.SigIns ? this.parseSignature(this.next().loc, unsafe) : [],
        outs: this.peek().kind == Tokens.SigOuts ? this.parseSignature(this.next().loc, unsafe) : []
      },
      inline, unsafe,
      memories: new Map(),
      body: this.parseBody(this.nextOf(Tokens.Do).loc)
    };

    this.procs.set(proc.name, proc);
  }

  private parseConst(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name);

    this.consts.set(name.value, {
      kind: AstKind.Const, loc,
      name: name.value,
      body: this.parseBody(name.loc, true),
      type: { type: DataType.Unknown }
    });
  }

  private parseVar(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name);

    const sig = this.parseSignature(name.loc);
    const end = this.nextOf(Tokens.End);

    if (sig.length < 1) {
      throw new StckError(Err.InvalidType)
        .addNote(loc, "variable defined here")
        .addErr(end.loc, "expected a type but got nothing");
    } else if (sig.length > 1) {
      throw new StckError(Err.InvalidType)
        .addNote(loc, "variable defined here")
        .addErr(sig[1].loc!, "expected a single type but got multiple");
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
    this.checkUniqueDefinition(name);

    this.memories.set(name.value, {
      kind: AstKind.Const, loc,
      name: name.value,
      body: this.parseBody(name.loc, true),
      type: { type: DataType.Int }
    });
  }

  private parseAssert(loc: Location) {
    this.assertions.push({
      kind: AstKind.Assert, loc: loc,
      message: this.nextOf(Tokens.Str).value,
      body: this.parseBody(loc, true)
    });
  }

  private parseExtern(loc: Location) {
    const library = this.nextOf(Tokens.Str).value;
    this.libraries.push(library);

    while (this.tokens.length) {
      const token = this.next();

      if (token.kind == Tokens.End) return;
      if (!token || token.kind != Tokens.Proc) {
        throw new StckError(Err.UnexpectedToken)
          .addErr(token?.loc ?? this.lastToken.loc, "expected `proc`");
      }

      const symbol = this.nextOf(Tokens.Word);
      const name = this.peek().kind == Tokens.As
        ? this.next() && this.nextOf(Tokens.Word)
        : symbol;

      this.checkUniqueDefinition(name);

      const extern: Extern = {
        kind: AstKind.Extern, loc: token.loc,
        symbol: symbol.value, library,
        name: name.value,
        signature: {
          ins: this.peek().kind == Tokens.SigIns ? this.parseSignature(this.next().loc) : [],
          outs: this.peek().kind == Tokens.SigOuts ? this.parseSignature(this.next().loc) : [],
        }
      };

      if (extern.signature.outs.length > 1) {
        throw new StckError(Err.InvalidType)
          .addErr(extern.signature.outs.at(-1)?.loc!, "external functions can only return one value")
          .addNote(token.loc, "extern defined here");
      }

      this.nextOf(Tokens.End);
      this.externs.set(extern.name, extern);
    }

    throw new StckError(Err.UnclosedBlock)
      .addErr(loc, "this extern was never closed");
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
      } else if (token.kind == Tokens.Inline) inlineProc = true;
      else if (token.kind == Tokens.Unsafe) unsafeProc = true;
      else if (token.kind == Tokens.Override) this.override = true;
      else if (inlineProc || unsafeProc) {
        throw new StckError(Err.UnexpectedToken)
          .addErr(token.loc, "expected procedure declaration here")
      } else if (token.kind == Tokens.Const) this.parseConst(token.loc);
      else if (token.kind == Tokens.Memory) this.parseMemory(token.loc);
      else if (token.kind == Tokens.Var) this.parseVar(token.loc);
      else if (token.kind == Tokens.Assert) this.parseAssert(token.loc);
      else if (token.kind == Tokens.Extern) this.parseExtern(token.loc);
      else {
        throw new StckError(Err.UnexpectedToken)
          .addErr(token.loc, "invalid token at the top level");
      }
    }

    return {
      file: this.lastToken.loc.file,
      procs: this.procs,
      consts: this.consts,
      memories: this.memories,
      externs: this.externs,
      assertions: this.assertions,
      libraries: this.libraries,
      vars: this.vars,
    };
  }
}