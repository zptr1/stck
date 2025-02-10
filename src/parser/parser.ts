import { Assert, AstKind, Condition, Const, Expr, Extern, Binding, LiteralType, Proc, Program, Var, Loop, WordType, Literal } from "./ast";
import { DataType, INTRINSICS, Location, TypeFrame, sizeOf } from "../shared";
import { Err, StckError } from "../errors";
import { Token, Tokens } from "../lexer";

export function literal(type: LiteralType, token: Token): Literal {
  return {
    kind: AstKind.Literal, type,
    loc: token.loc,
    value: token.value
  };
}

export class Parser {
  public readonly procs = new Map<string, Proc>();
  public readonly consts = new Map<string, Const>();
  public readonly memories = new Map<string, Const>();
  public readonly externs = new Map<string, Extern>();
  public readonly vars = new Map<string, Var>();
  public readonly assertions: Assert[] = [];
  public readonly libraries: string[] = [];

  private unsafeProc = false;
  private inlineProc = false;
  private override = false;

  constructor (
    private readonly tokens: Token[],
    private readonly lastToken = tokens.at(-1)!,
    private pos = 0
  ) {}

  private next() {
    return this.tokens[this.pos++];
  }

  private peek() {
    return this.tokens[this.pos];
  }

  private notEOF() {
    return this.pos < this.tokens.length;
  }

  private nextOf(kind: Tokens, message?: string) {
    const token = this.next();
    if (!token || token.kind != kind) {
      throw new StckError(Err.UnexpectedToken)
        .addErr(token?.loc ?? this.lastToken.loc, message || `expected \`${kind}\``);
    }

    return token;
  }

  private expectNext(loc?: Location, message?: string) {
    const token = this.next();
    if (!token) {
      throw new StckError(Err.UnclosedBlock)
        .addErr(loc || this.lastToken.loc, message || "unexpected EOF");
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

  private parseExpr(token: Token, ctx: Proc): Expr {
    // TODO: make this nicer
    if (token.kind == Tokens.Word) {
      return {
        kind: AstKind.Word, loc: token.loc,
        type: WordType.Unknown,
        value: token.value
      };
    } else if (token.kind == Tokens.Int) {
      return literal(LiteralType.Int, token);
    } else if (token.kind == Tokens.Str) {
      return literal(LiteralType.Str, token);
    } else if (token.kind == Tokens.CStr) {
      return literal(LiteralType.CStr, token);
    } else if (token.kind == Tokens.AsmBlock) {
      return literal(LiteralType.Assembly, token);
    } else if (token.kind == Tokens.If) {
      return this.parseCondition(token.loc, ctx);
    } else if (token.kind == Tokens.While) {
      return this.parseLoop(token.loc, ctx);
    } else if (token.kind == Tokens.Let) {
      return this.parseBinding(token.loc, ctx);
    } else if (token.kind == Tokens.Cast) {
      const types = this.parseSignature(token.loc);
      this.nextOf(Tokens.End);

      return { kind: AstKind.Cast, loc: token.loc, types };
    } else if (token.kind == Tokens.Return) {
      return {
        kind: AstKind.Word, loc: token.loc,
        type: WordType.Return,
        value: token.value
      };
    } else {
      throw new StckError(Err.UnexpectedToken)
        .addErr(token.loc);
    }
  }

  private parseCondition(loc: Location, ctx: Proc): Condition {
    const condition: Condition = {
      kind: AstKind.If, loc,
      condition: [],
      body: [],
      else: []
    };

    while (true) {
      const token = this.expectNext(loc, "this condition was never closed");

      if (token.kind == Tokens.Do) {
        loc = token.loc;
        break;
      } else {
        condition.condition.push(this.parseExpr(token, ctx));
      }
    }

    while (true) {
      const token = this.expectNext(loc, "this condition was never closed");

      if (token.kind == Tokens.Else) {
        condition.else = this.parseBody(token.loc, ctx);
        condition.elseBranch = token.loc;
        break;
      } else if (token.kind == Tokens.ElseIf) {
        condition.else.push(this.parseCondition(token.loc, ctx));
        condition.elseBranch = token.loc;
        break;
      } else if (token.kind == Tokens.End) {
        break;
      } else {
        condition.body.push(this.parseExpr(token, ctx));
      }
    }

    return condition;
  }

  private parseLoop(loc: Location, ctx: Proc): Loop {
    const loop: Loop = {
      kind: AstKind.Loop, loc,
      condition: [],
      body: []
    };

    while (true) {
      const token = this.expectNext(loc, "this loop was never closed");
      
      if (token.kind == Tokens.Do) {
        loop.body = this.parseBody(token.loc, ctx);
        break;
      } else {
        loop.condition.push(this.parseExpr(token, ctx));
      }
    }

    return loop;
  }

  private parseBinding(loc: Location, ctx: Proc): Binding {
    const binding: Binding = {
      kind: AstKind.Binding, loc,
      inline: false,
      bindings: [],
      body: []
    };

    while (true) {
      const token = this.expectNext(loc, "this binding was never closed");
      
      if (token.kind == Tokens.Do) {
        binding.body = this.parseBody(token.loc, ctx);
        break;
      } else if (token.kind == Tokens.Word) {
        this.checkUniqueDefinition(token);
        binding.bindings.push(token.value);
      } else {
        throw new StckError(Err.UnexpectedToken)
          .addNote(loc, "binding starts here")
          .addErr(token.loc, "expected a word");
      }
    }

    return binding;
  }

  private parseConstBody(loc: Location): Expr[] {
    const body: Expr[] = [];
    while (true) {
      const token = this.expectNext(loc, "this definition was never closed");
      
      if (token.kind == Tokens.End) {
        return body;
      } else if (token.kind == Tokens.Int) {
        body.push(literal(LiteralType.Int, token));
      } else if (token.kind == Tokens.Word) {
        body.push({
          kind: AstKind.Word, loc: token.loc,
          type: WordType.Unknown,
          value: token.value
        });
      } else if (token.kind == Tokens.Cast) {
        const types = this.parseSignature(token.loc);
        this.nextOf(Tokens.End);
        body.push({
          kind: AstKind.Cast, loc: token.loc, types
        });
      } else {
        throw new StckError(Err.UnclosedBlock)
          .addErr(token.loc, "unexpected token in a compile-time expression");
      }
    }
  }

  private parseBody(loc: Location, ctx: Proc): Expr[] {
    const body: Expr[] = [];

    while (true) {
      const token = this.expectNext(loc, "this block was never closed");

      if (token.kind == Tokens.End) {
        return body;
      } else if (token.kind == Tokens.Assert) {
        this.parseAssert(token.loc);
      } else if (token.kind == Tokens.Memory) {
        if (ctx.inline) {
          throw new StckError(Err.InvalidComptime)
            .addNote(ctx.loc, "inline procedure defined here")
            .addErr(token.loc, "local memory regions are not allowed here");
        }

        const name = this.nextOf(Tokens.Word);
        this.checkUniqueDefinition(name);
    
        ctx.memories.set(name.value, {
          kind: AstKind.Const, loc: token.loc,
          name: name.value,
          type: { type: DataType.Int },
          body: this.parseConstBody(token.loc)
        });
      } else {
        body.push(this.parseExpr(token, ctx));
      }
    }
  }

  private parseType(token: Token, loc: Location, unsafe: boolean = false): TypeFrame {
    if (token.value == "int") {
      return { type: DataType.Int, loc: token.loc };
    } else if (token.value == "bool") {
      return { type: DataType.Bool, loc: token.loc };
    } else if (token.value == "ptr") {
      return { type: DataType.Ptr, loc: token.loc };
    } else if (token.value == "ptr") {
      return { type: DataType.Ptr, loc: token.loc };
    } else if (token.value == "ptr-to") {
      return {
        type: DataType.PtrTo, loc: token.loc,
        value: this.parseType(this.nextOf(Tokens.Word), loc, unsafe)
      };
    } else if (token.value == "unknown") {
      if (!unsafe) {
        throw new StckError(Err.InvalidType)
          .addNote(loc, "type signature starts here")
          .addErr(token.loc, "unknown types are only allowed in unsafe procedures");
      }

      return {
        type: DataType.Unknown, loc: token.loc
      };
    } else if (token.value[0] == "<" && token.value.endsWith(">")) {
      if (!unsafe) {
        throw new StckError(Err.InvalidType)
          .addNote(loc, "type signature starts here")
          .addErr(token.loc, "generic types are only allowed in unsafe procedures");
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

    while (this.notEOF()) {
      const token = this.nextOf(Tokens.Word, "expected a type");
      types.push(this.parseType(token, loc, unsafe));

      if (this.peek().kind != Tokens.Word) {
        return types;
      }
    }

    throw new StckError(Err.UnclosedBlock)
      .addErr(loc, "this signature was never closed");
  }

  private parseProc(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    if (name.value == "<load>") {
      const token = this.expectNext(loc, "expected `do`");

      if (token.kind == Tokens.SigIns || token.kind == Tokens.SigOuts) {
        throw new StckError(Err.UnexpectedToken)
          .addNote(loc, "procedure starts here")
          .addErr(token.loc, "this procedure cannot have a signature")
          .addHint("<load> is a special procedure and cannot have a signature");
      } else if (token.kind != Tokens.Do) {
        throw new StckError(Err.UnexpectedToken)
          .addNote(loc, "procedure starts here")
          .addErr(token.loc, "expected `do`");
      }

      if (this.inlineProc || this.unsafeProc) {
        throw new StckError(Err.InvalidProc)
          .addErr(loc, "this procedure cannot be inline or unsafe")
          .addHint("<load> is a special procedure and cannot be inline or unsafe");
      }

      const proc = this.procs.get("<load>")!;
      proc.body.push(...this.parseBody(token.loc, proc));

      return;
    }

    this.checkUniqueDefinition(name);

    const proc: Proc = {
      kind: AstKind.Proc, loc,
      name: name.value,
      signature: {
        ins: this.peek().kind == Tokens.SigIns ? this.parseSignature(this.next().loc, this.unsafeProc) : [],
        outs: this.peek().kind == Tokens.SigOuts ? this.parseSignature(this.next().loc, this.unsafeProc) : []
      },
      inline: this.inlineProc,
      unsafe: this.unsafeProc,
      memories: new Map(),
      body: []
    };

    proc.body = this.parseBody(this.nextOf(Tokens.Do).loc, proc);
    this.procs.set(proc.name, proc);

    this.inlineProc = false;
    this.unsafeProc = false;
  }

  private parseConst(loc: Location) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name);

    this.consts.set(name.value, {
      kind: AstKind.Const, loc,
      name: name.value,
      type: { type: DataType.Unknown },
      body: this.parseConstBody(loc),
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
      type: { type: DataType.Int },
      body: this.parseConstBody(loc)
    });
  }

  private parseAssert(loc: Location) {
    this.assertions.push({
      kind: AstKind.Assert, loc,
      message: this.nextOf(Tokens.Str).value,
      body: this.parseConstBody(loc)
    });
  }

  private parseExtern(loc: Location) {
    const library = this.nextOf(Tokens.Str).value;
    this.libraries.push(library);

    while (this.notEOF()) {
      const token = this.next();

      if (token.kind == Tokens.End) return;
      if (token?.kind == Tokens.Override) {
        this.override = true;
        continue;
      } else if (token?.kind != Tokens.Proc) {
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
    this.procs.set("<load>", {
      kind: AstKind.Proc,
      loc: this.lastToken.loc,
      name: "<load>",
      signature: { ins: [], outs: [] },
      memories: new Map(),
      inline: false,
      unsafe: false,
      body: []
    });
    
    while (this.notEOF()) {
      const token = this.next();

      if (token.kind == Tokens.Inline) this.inlineProc = true;
      else if (token.kind == Tokens.Unsafe) this.unsafeProc = true;
      else if (token.kind == Tokens.Override) this.override = true;
      else if (token.kind == Tokens.Proc) this.parseProc(token.loc);
      else if (this.inlineProc || this.unsafeProc) {
        throw new StckError(Err.UnexpectedToken)
          .addErr(token.loc, "expected procedure declaration");
      } else if (token.kind == Tokens.Const) this.parseConst(token.loc);
      else if (token.kind == Tokens.Memory) this.parseMemory(token.loc);
      else if (token.kind == Tokens.Var) this.parseVar(token.loc);
      else if (this.override) {
        throw new StckError(Err.UnexpectedToken)
          .addErr(token.loc, "expected declaration after override");
      } else if (token.kind == Tokens.Assert) this.parseAssert(token.loc);
      else if (token.kind == Tokens.Extern) this.parseExtern(token.loc);
      else {
        throw new StckError(Err.UnexpectedToken)
          .addErr(token.loc, "invalid token at the top level");
      }
    }

    // TODO: a single map of all the definitions?
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