import { AstType, Expr, ICondition, IConst, IMacro, IProc, IProgram, IWhile, TopLevelAst } from "./shared/ast";
import { Location, formatLoc } from "./shared/location";
import { tokenToDataType } from "./shared/types";
import { INTRINSICS } from "./shared/intrinsics";
import { Token, Tokens } from "./shared/token";
import { reportError } from "./errors";
import { ROOT_DIR } from "./const";
import { existsSync } from "fs";
import { Lexer } from "./lexer";
import chalk from "chalk";
import plib from "path";

const tokenFmt = chalk.yellowBright.bold;

export class Parser {
  public readonly tokens: Token[] = [];
  private readonly includeCache = new Set<string>();
  private includeDepth: number = 0;
  private lastToken: Token | undefined = undefined;

  public readonly program: IProgram = {
    procs: new Map(),
    macros: new Map(),
    consts: new Map(),
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
        "A procedure with the same name is already defined", loc,
        [`originally defined here ${chalk.bold(formatLoc(proc.loc))}`]
      );
    } else if (this.program.consts.has(name)) {
      const constant = this.program.consts.get(name)!;
      reportError(
        "A constant with the same name is already defined", loc,
        [`originally defined here ${chalk.bold(formatLoc(constant.loc))}`]
      );
    } else if (this.program.macros.has(name)) {
      const macro = this.program.macros.get(name)!;
      reportError(
        "A macro with the same name is already defined", loc,
        [`originally defined here ${chalk.bold(formatLoc(macro.loc))}`]
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
        `Unexpected ${tokenFmt(token.kind)} in the ${chalk.bold.whiteBright(start.kind)}`, token.loc,
        [`block starts at ${chalk.bold(formatLoc(start.loc))}`]
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

  private readTopLevelBlock<T extends TopLevelAst>(type: AstType, start: Token): T {
    const name = this.nextOf(Tokens.Word);
    this.checkUniqueDefinition(name.value, name.loc);

    return {
      type,
      name: name.value,
      loc: name.loc,
      body: this.readBlock(start)
    } as T;
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

          this.includeDepth++;
          for (const tok of tokens)
            this.tokens.push(tok);
        }
      } else if (token.kind == Tokens.Proc) {
        const proc = this.readTopLevelBlock<IProc>(AstType.Proc, token);
        this.program.procs.set(proc.name, proc);
      } else if (token.kind == Tokens.Macro) {
        const macro = this.readTopLevelBlock<IMacro>(AstType.Macro, token);
        this.program.macros.set(macro.name, macro);
      } else if (token.kind == Tokens.Const) {
        const constant = this.readTopLevelBlock<IConst>(AstType.Const, token);
        this.program.consts.set(constant.name, constant);
      } else if (token.kind == Tokens.EOF) {
        if (this.includeDepth) {
          this.includeDepth--
        } else {
          break;
        }
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