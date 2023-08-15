import { AstType, Expr, IProc, IProgram, WordType } from "./shared/ast";
import { tokenToDataType } from "./shared/types";
import { Token, Tokens } from "./shared/token";
import { Location } from "./shared/location";
import { reportError } from "./errors";
import { ROOT_DIR } from "./const";
import { existsSync } from "fs";
import { Lexer } from "./lexer";
import chalk from "chalk";
import plib from "path";

// todo: separate file for intrinsics
const INTRINSICS = new Set([
  "+", "-", "*", "print"
]);

const tokenFmt = chalk.yellowBright.bold;
const includeCache = new Set<string>();

export class Parser {
  public readonly tokens: Token[] = [];
  public readonly program: IProgram = {
    procs: new Map(),
    constants: new Map(),
  };

  constructor(tokens: Token[]) {
    this.tokens = tokens.reverse();
    includeCache.add(this.tokens[0].loc.file.path);
  }

  private next(): Token {
    return this.tokens.pop()!;
  }

  private isEnd(): boolean {
    return this.tokens.length == 0;
  }

  private nextOf(kind: Tokens): Token {
    if (this.isEnd()) {
      const last = this.tokens.at(-1)!;
      reportError(
        `Expected ${tokenFmt(kind)} but got ${tokenFmt("EOF")}`,
        last.loc
      );
    }

    const token = this.next();

    if (token.kind != kind) {
      reportError(
        `Expected ${tokenFmt(kind)} but got ${tokenFmt(token.kind)}`,
        token.loc
      );
    }

    return token;
  }

  private checkUniqueDefinition(name: string, loc: Location) {
    if (this.program.procs.has(name)) {
      const proc = this.program.procs.get(name)!;
      reportError(
        "A procedure with the same name is already defined",
        loc, [
          `originally defined here ${
            chalk.bold(proc.loc.file.formatLoc(proc.loc.span))
          }`
        ]
      );
    } else if (this.program.constants.has(name)) {
      const constant = this.program.constants.get(name)!;
      reportError(
        "A constant with the same name is already defined",
        loc, [
          `originally defined here ${
            chalk.bold(constant.loc.file.formatLoc(constant.loc.span))
          }`
        ]
      );
    }
  }

  private readBlock(start: Token): Expr[] {
    const body: Expr[] = [];

    while (true) {
      const token = this.next();

      if (token.kind == Tokens.End) {
        break;
      } else if (token.kind == Tokens.Word) {
        const wordType = (
          this.program.procs.has(token.value)
            ? WordType.Proc
          : this.program.constants.has(token.value)
            ? WordType.Constant
          : INTRINSICS.has(token.value)
            ? WordType.Intrinsic
          : null
        );

        if (wordType == null) {
          reportError(
            `Unknown word ${chalk.bold(token.value)}`,
            token.loc
          );
        }

        body.push({
          type: AstType.Word,
          wordtype: wordType,
          value: token.value,
          loc: token.loc
        });
      } else if (token.kind == Tokens.Int || token.kind == Tokens.Str || token.kind == Tokens.Boolean || token.kind == Tokens.Char) {
        body.push({
          type: AstType.Push,
          datatype: tokenToDataType(token.kind),
          value: token.value,
          loc: token.loc
        });
      } else {
        reportError(
          `Unexpected ${tokenFmt(token.kind)}`,
          token.loc, [
            `unclosed block defined at ${chalk.bold(start.loc.file.formatLoc(start.loc.span))}`
          ]
        );
      }
    }

    return body;
  }

  private readProc() {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    const proc: IProc = {
      type: AstType.Proc,
      name: name.value,
      loc: name.loc,
      body: [],
    }

    this.program.procs.set(name.value, proc);
    proc.body = this.readBlock(name);
  }

  public parse(): IProgram {
    while (!this.isEnd()) {
      const token = this.next();
      if (token.kind == Tokens.Include) {
        const tok = this.nextOf(Tokens.Str);
        const paths = tok.value.startsWith(".") ? [
          plib.join(plib.dirname(token.loc.file.path), tok.value)
        ] : [
          plib.join(ROOT_DIR, "lib", tok.value),
          plib.join(process.cwd(), "lib", tok.value),
        ];

        const found = paths.find((x) => existsSync(x));
        if (!found) {
          reportError("Unresolved import", tok.loc);
        } else if (found == token.loc.file.path) {
          reportError("Self import", tok.loc);
        }

        const path = plib.resolve(found);
        if (!includeCache.has(path)) {
          console.debug(chalk.gray(`[DEBUG] Including ${chalk.bold(path)}`));
          includeCache.add(path);

          const file = token.loc.file.child(path);
          const tokens = new Lexer(file).collect().reverse();

          for (const tok of tokens) {
            if (tok.kind == Tokens.EOF) continue;
            this.tokens.push(tok);
          }
        }
      } else if (token.kind == Tokens.Proc) {
        this.readProc();
      } else if (token.kind == Tokens.Const) {
        throw "TODO: Constants are not implemented yet";
      } else if (token.kind == Tokens.EOF) {
        break;
      } else {
        reportError(
          `Unexpected ${tokenFmt(token.kind)} at the top level`,
          token.loc
        );
      }
    }

    return this.program;
  }
}