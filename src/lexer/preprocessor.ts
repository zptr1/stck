import { ExpansionStackElement, File, Location } from "../shared";
import { Lexer, Token, Tokens } from ".";
import { Err, StckError } from "../errors";
import { existsSync, statSync } from "fs";
import { ROOT_DIR } from "../index";
import chalk from "chalk";
import plib from "path";

function exists(path: string) {
  return existsSync(path) && statSync(path).isFile();
}

export class Preprocessor {
  private readonly macros: Map<string, Token[]> = new Map();
  private readonly includedFiles = new Set<string>();
  private readonly lastToken: Token;

  private readonly macroExpansionStack: ExpansionStackElement[] = [];

  constructor(
    private readonly tokens: Token[]
  ) {
    if (tokens.length == 0) {
      throw new StckError(Err.EmptyFile);
    }

    tokens.reverse();
    this.lastToken = tokens[0];
    this.include(plib.join(ROOT_DIR, "lib/prelude.stck"), tokens[0].loc);
  }

  private next(): Token {
    return this.tokens.pop()!;
  }

  private nextOf(kind: Tokens): Token {
    if (!this.tokens.length) {
      throw new StckError(Err.UnexpectedToken)
        .addErr(this.lastToken.loc, `expected ${kind} but got EOF`);
    }

    const token = this.next();
    if (token.kind != kind) {
      throw new StckError(Err.UnexpectedToken)
        .addErr(token.loc, `expected ${kind}`);
    }

    return token;
  }

  private include(path: string, loc: Location) {
    if (this.includedFiles.has(path)) return;
    this.includedFiles.add(path);

    if (!exists(path)) {
      throw new StckError(Err.UnresolvedImport)
        .addErr(loc, "file not found");
    }

    try {
      const tokens = new Lexer(loc.file.child(path)).lex();
  
      // note: this.tokens is reversed
      for (let i = tokens.length - 1; i >= 0; i--) {
        this.tokens.push(tokens[i]);
      }
    } catch (err) {
      if (err instanceof StckError) err.addTrace(loc, "imported from here");
      throw err;
    }
  }

  private resolveImport(raw: string, loc: Location): string {
    if (raw.startsWith("./") || raw.startsWith("../")) {
      // relative import (to the current file)
      return plib.resolve(plib.join(loc.file.path, "..", raw));
    } else if (raw.startsWith("/")) {
      return plib.resolve(raw);
    } else {
      // library import
      const paths = [
        plib.join(ROOT_DIR, "lib", raw),
        plib.resolve(plib.join("lib", raw)),
      ];

      const path = paths.find((x) => exists(x));
      if (!path) {
        throw new StckError(Err.UnresolvedImport)
          .addErr(loc, "library not found")
          .addHint(`make sure it exists in the ${chalk.yellow.bold("lib")} folder`)
          .addHint("of the compiler or the current direcory");
      }

      return path;
    }
  }

  private expandMacro(name: string, body: Token[], loc: Location) {
    const idx = this.macroExpansionStack.findIndex((x) => x.name == name);
    if (idx > -1) {
      const err = new StckError(Err.RecursiveMacroExpansion);
      for (let i = idx; i < this.macroExpansionStack.length; i++) {
        const expansion = this.macroExpansionStack[i];
        if (expansion.name == name) {
          err.addNote(expansion.loc, `first expansion of ${name}`);
        } else {
          err.addTrace(expansion.loc, `${this.macroExpansionStack[i - 1].name} lead to this expansion`);
        }
      }

      err.addErr(loc, `${name} expanded again here`);
      throw err;
    }

    this.macroExpansionStack.push({ name, loc });
    this.tokens.push({
      kind: Tokens.EOF,
      loc
    });

    for (let i = body.length - 1; i >= 0; i--) {
      // TODO: `expandedFrom?: Location`
      this.tokens.push(body[i]);
    }
  }

  private readToken(token: Token, out: Token[]) {
    if (token.kind == Tokens.Include) {
      const str = this.nextOf(Tokens.Str);
      const path = this.resolveImport(
        str.value.replace(/(\.stck)?$/, ".stck"),
        token.loc
      );

      this.include(path, token.loc);
    } else if (token.kind == Tokens.Macro) {
      this.readMacro(this.nextOf(Tokens.Word).value, token.loc);
    } else if (token.kind == Tokens.Del) {
      this.macros.delete(this.nextOf(Tokens.Word).value);
    } else if (token.kind == Tokens.EOF) {
      this.macroExpansionStack.pop();
    } else if (token.kind == Tokens.Word && this.macros.has(token.value)) {
      this.expandMacro(token.value, this.macros.get(token.value)!, token.loc);
    } else {
      out.push(token);
    }
  }

  private readMacro(name: string, loc: Location) {
    const body: Token[] = [];
    while (this.tokens.length) {
      const token = this.next();

      if (token.kind == Tokens.EndPre) {
        this.macros.set(name, body);
        return;
      } else if (token.kind == Tokens.Word && token.value == "\\") {
        body.push(this.next());
      } else {
        this.readToken(token, body);
      }
    }

    throw new StckError(Err.UnclosedBlock)
      .addErr(loc, "this macro was never closed");
  }

  public preprocess(): Token[] {
    const out: Token[] = [];
    while (this.tokens.length) {
      this.readToken(this.next(), out);
    }

    return out;
  }
}