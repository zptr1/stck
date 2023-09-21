import { ExpansionStackElement, File, Location } from "../shared";
import { Lexer, Token, Tokens } from "../lexer";
import { Err, StckError } from "../errors";
import { existsSync, statSync } from "fs";
import { ROOT_DIR } from "../const";
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
      new StckError("the file is empty").throw();
    }

    tokens.reverse();
    this.lastToken = tokens[0];

    const file = tokens[0].loc.file;
    this.includedFiles.add(file.path);
    this.include(plib.join(ROOT_DIR, "lib/prelude.stck"), file);
  }

  private next(): Token {
    return this.tokens.pop()!;
  }

  private nextOf(kind: Tokens): Token {
    if (!this.tokens.length) {
      new StckError("unexpected token")
        .add(Err.Error, this.lastToken.loc, `expected ${kind} but got EOF`)
        .throw();
    }

    const token = this.next();
    if (token.kind != kind) {
      new StckError("unexpected token")
        .add(Err.Error, token.loc, `expected ${kind}`)
        .throw();
    }

    return token;
  }

  private include(path: string, file: File) {
    if (this.includedFiles.has(path)) return;
    this.includedFiles.add(path);

    const tokens = new Lexer(file.child(path)).collect();

    // note: this.tokens is reversed
    for (let i = tokens.length - 1; i >= 0; i--) {
      this.tokens.push(tokens[i]);
    }
  }

  private expandMacro(name: string, body: Token[], loc: Location) {
    const idx = this.macroExpansionStack.findIndex((x) => x.name == name);
    if (idx > -1) {
      const err = new StckError("recursive macro expansion");
      for (let i = idx; i < this.macroExpansionStack.length; i++) {
        const expansion = this.macroExpansionStack[i];
        if (expansion.name == name) {
          err.add(Err.Note, expansion.loc, `first expansion of ${name}`);
        } else {
          err.add(Err.Trace, expansion.loc, `${this.macroExpansionStack[i - 1].name} lead to this expansion`);
        }
      }

      err.add(Err.Error, loc, `${name} expanded again here`);
      err.throw();
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
      const raw = str.value + ".stck";

      if (raw.startsWith("./") || raw.startsWith("../")) {
        // relative import (to the current file)
        const path = plib.resolve(plib.join(token.loc.file.path, "..", raw));
        if (!exists(path)) {
          new StckError("unresolved import")
            .add(Err.Error, token.loc, "could not find this file")
            .addHint(`import interpreted as ${chalk.yellow(path)}`)
            .throw();
        }

        this.include(path, token.loc.file);
      } else if (raw.startsWith("/")) {
        // absolute import
        const path = plib.resolve(raw);
        if (!exists(path)) {
          new StckError("unresolved import")
            .add(Err.Error, token.loc, "could not find this file")
            .addHint(`import interpreted as ${chalk.yellow(path)}`)
            .throw();
        }

        this.include(path, token.loc.file);
      } else {
        // library import
        const paths = [
          plib.join(ROOT_DIR, "lib", raw),
          plib.resolve(plib.join("lib", raw)),
        ];

        const path = paths.find((x) => exists(x));
        if (!path) {
          return new StckError("unresolved import")
            .add(Err.Error, token.loc, "could not find this file")
            .addHint(`import interpreted as ${chalk.yellow(path)}`)
            .throw();
        }

        this.include(path, token.loc.file);
      }
    } else if (token.kind == Tokens.Macro) {
      this.readMacro(this.nextOf(Tokens.Word).value, token.loc);
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

    new StckError("unclosed block")
      .add(Err.Error, loc, "this block was never closed")
      .throw();
  }

  public preprocess(): Token[] {
    const out: Token[] = [];
    while (this.tokens.length) {
      this.readToken(this.next(), out);
    }

    return out;
  }
}