import { AstType, Expr, ICondition, IProc, IProgram, IWhile } from "./shared/ast";
import { reportError, reportWarning } from "./errors";
import { tokenToDataType } from "./shared/types";
import { Token, Tokens } from "./shared/token";
import { Location } from "./shared/location";
import { ROOT_DIR } from "./const";
import { existsSync } from "fs";
import { Lexer } from "./lexer";
import chalk from "chalk";
import plib from "path";
import { INTRINSICS, Intrinsic } from "./shared/intrinsics";

const tokenFmt = chalk.yellowBright.bold;

export class Parser {
  public readonly tokens: Token[] = [];
  private readonly includeCache = new Set<string>();
  private lastToken: Token | undefined = undefined;

  public readonly program: IProgram = {
    procs: new Map(),
    constants: new Map(),
  };

  constructor(tokens: Token[]) {
    this.tokens = tokens.reverse();
    this.includeCache.add(this.tokens[0].loc.file.path);
  }

  private next(): Token {
    return (
      this.lastToken = this.tokens.pop()!
    );
  }

  private isEnd(): boolean {
    return this.tokens.length == 0;
  }

  private nextOf(kind: Tokens): Token {
    if (this.isEnd()) {
      reportError(
        `Expected ${tokenFmt(kind)} but got ${tokenFmt("EOF")}`,
        this.lastToken!.loc
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
    } else if (INTRINSICS.has(name)) {
      reportError(
        "An intrinsic with the same name already exists",
        loc
      );
    }
  }

  private readExpr(token: Token, start: Token): Expr;
  private readExpr(token: Token, start?: Token): Expr | undefined {
    if (token.kind == Tokens.If) {
      return this.readIfBlock(token);
    } else if (token.kind == Tokens.While) {
      return this.readWhileBlock(token);
    } else if (token.kind == Tokens.Word) {
      return {
        type: AstType.Word,
        value: token.value,
        loc: token.loc
      };
    } else if (token.kind == Tokens.Int || token.kind == Tokens.Str || token.kind == Tokens.Boolean || token.kind == Tokens.Char) {
      return {
        type: AstType.Push,
        datatype: tokenToDataType(token.kind),
        value: token.value,
        loc: token.loc
      };
    } else if (start) {
      reportError(
        `Unexpected ${tokenFmt(token.kind)} in the ${chalk.bold.whiteBright(start.kind)}`, token.loc, [
          `block starts at ${chalk.bold(start.loc.file.formatLoc(start.loc.span))}`
        ]
      );
    }
  }

  private readIfBlock(start: Token): ICondition {
    // TODO: `if*` for chained if/else

    const condition: ICondition = {
      type: AstType.If,
      body: [],
      else: [],
      loc: start.loc
    }

    while (true) {
      const token = this.next();

      if (token.kind == Tokens.End) return condition;
      else if (token.kind == Tokens.Else) break;
      else condition.body.push(this.readExpr(token, start));
    }

    while (true) {
      const token = this.next();
      if (token.kind == Tokens.End) break;
      else if (token.kind == Tokens.ChainedIf) {
        condition.else.push(this.readIfBlock(token));
        break;
      } else condition.else.push(this.readExpr(token, start));
    }

    return condition;
  }

  private readWhileBlock(start: Token): IWhile {
    const loop: IWhile = {
      type: AstType.While,
      condition: [],
      body: [],
      loc: start.loc
    }

    while (true) {
      const token = this.next();
      if (token.kind == Tokens.Do) break;
      else loop.condition.push(this.readExpr(token, start));
    }

    if (loop.condition.length == 0) {
      reportWarning(
        "Empty while condition",
        start.loc, [
          "Loops with empty conditions do nothing"
        ]
      )
    }

    loop.body = this.readBlock(start);
    return loop;
  }

  private readBlock(start: Token): Expr[] {
    const body: Expr[] = [];

    while (true) {
      const token = this.next();

      if (token.kind == Tokens.End) break;
      else body.push(this.readExpr(token, start));
    }

    return body;
  }

  private readProc(start: Token) {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    const proc: IProc = {
      type: AstType.Proc,
      name: name.value,
      loc: name.loc,
      body: [],
    }

    this.program.procs.set(name.value, proc);
    proc.body = this.readBlock(start);

    if (proc.body.length == 0) {
      reportWarning(
        "Empty procedure",
        proc.loc
      );
    }
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
        if (!this.includeCache.has(path)) {
          console.debug(chalk.gray(`[DEBUG] Including ${chalk.bold(path)}`));
          this.includeCache.add(path);

          const file = token.loc.file.child(path);
          const tokens = new Lexer(file).collect().reverse();

          for (const tok of tokens) {
            if (tok.kind == Tokens.EOF) continue;
            this.tokens.push(tok);
          }
        }
      } else if (token.kind == Tokens.Proc) {
        this.readProc(token);
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