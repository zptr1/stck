import { reportError, reportErrorWithoutLoc } from "../errors";
import { Lexer, Token, Tokens } from "../lexer";
import { existsSync, statSync } from "fs";
import { File, Location } from "../shared";
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

  private macroExpansionDepth: number = 0;

  constructor(
    private readonly tokens: Token[]
  ) {
    if (tokens.length == 0)
      reportErrorWithoutLoc("The file is empty");

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
    if (!this.tokens.length) reportError(
      `Expected ${chalk.yellow.bold(kind)} but got ${chalk.yellow.bold("EOF")}`,
      this.lastToken.loc
    );

    const token = this.next();
    if (token.kind != kind) reportError(
      `Expected ${chalk.yellow.bold(kind)} but got ${chalk.yellow.bold(token.kind)}`,
      token.loc
    );

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

  private expandMacro(body: Token[], loc: Location) {
    if (this.macroExpansionDepth >= 100) {
      reportError("Macro expansion overflow", loc);
    }

    this.macroExpansionDepth++;
    // Will decrease `macroExpansionDepth` once encountered
    this.tokens.push({
      kind: Tokens.EOF,
      loc
    });

    for (let i = body.length - 1; i >= 0; i--) {
      this.tokens.push({
        kind: body[i].kind,
        value: body[i].value,
        // todo
        loc
      });
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
          reportError("Unresolved import", str.loc);
        }

        this.include(path, token.loc.file);
      } else if (raw.startsWith("/")) {
        // absolute import
        const path = plib.resolve(raw);
        if (!exists(path)) {
          reportError("Unresolved import", str.loc);
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
          reportError("Unresolved import", str.loc);
        }

        this.include(path, token.loc.file);
      }
    } else if (token.kind == Tokens.Macro) {
      this.readMacro(this.nextOf(Tokens.Word).value, token.loc);
    } else if (token.kind == Tokens.EOF) {
      this.macroExpansionDepth--;
    } else if (token.kind == Tokens.Word && this.macros.has(token.value)) {
        this.expandMacro(this.macros.get(token.value)!, token.loc);
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

    reportError("Unclosed macro", loc);
  }

  public preprocess(): Token[] {
    const out: Token[] = [];
    while (this.tokens.length) {
      this.readToken(this.next(), out);
    }

    return out;
  }
}