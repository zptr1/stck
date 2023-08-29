import { KEYWORDS, Token, Tokens } from "./token";
import { File, formatLoc } from "../shared";
import { reportError } from "../errors";
import { Reader } from "../util";

export class Lexer {
  public readonly reader: Reader<string>;

  constructor(
    public readonly file: File
  ) {
    this.reader = new Reader(this.file.source);
  }

  private token(kind: Tokens, value?: any): Token {
    return {
      kind, value,
      loc: this.file.location(this.reader.span())
    }
  }

  private error(message: string): never {
    reportError(message, {
      file: this.file,
      span: this.reader.span()
    });
  }

  private skipWhitespace(): void {
    while (" \n\r".includes(this.reader.peek()!))
      this.reader.next();
  }

  private skipComment(): void {
    while (true) {
      const c = this.reader.next();
      if (c == "\n" || !c) break;
    }
  }

  private isIntStart(): boolean {
    return "-0123456789".includes(this.reader.peek()!);
  }

  private isIntContinue(): boolean {
    return "0123456789".includes(this.reader.peek()!);
  }

  private isWhitespace(): boolean {
    return " \n\r".includes(this.reader.peek()!);
  }

  private readChar(): string {
    const ch = this.reader.next()!;
    if (ch == "\\") {
      const ne = this.reader.next();
      if (!ne) {
        this.error("Unexpected EOF");
      } else if (ne == "n") {
        return "\n";
      } else if (ne == "r") {
        return "\r";
      } else if (ne == "t") {
        return "\t";
      } else {
        return ne;
      }
    } else if (ch == "\n") {
      this.error("Unexpected newline");
    }

    return ch;
  }

  private readStrToken(): Token {
    let value = "";

    this.reader.next();
    while (true) {
      if (this.reader.isEnd()) {
        this.error("Unclosed string");
      } else if (this.reader.peek() == '"') {
        break;
      }

      value += this.readChar();
    }

    this.reader.next();
    return this.token(Tokens.Str, value);
  }

  private readCharToken(): Token {
    this.reader.next();
    const value = this.readChar();

    if (this.reader.next() != "'") {
      this.error("Unclosed char");
    }

    return this.token(Tokens.Int, value.charCodeAt(0));
  }

  private readWordToken(): Token {
    let isInt = this.isIntStart();
    let value = this.reader.next();

    while (!this.isWhitespace() && !this.reader.isEnd()) {
      if (!this.isIntContinue()) {
        isInt = false;
      }

      value += this.reader.next()!;
    }

    if (isInt && value != "-") {
      return this.token(Tokens.Int, parseInt(value));
    } else if (value == "true" || value == "false") {
      return this.token(Tokens.Boolean, value == "true");
    } else if (value == "<here>") {
      return this.token(Tokens.Str, formatLoc({
        file: this.file,
        span: [this.reader.spanStart, this.reader.cursor]
      }));
    } else if (KEYWORDS.has(value)) {
      return this.token(value as Tokens);
    } else {
      return this.token(Tokens.Word, value);
    }
  }

  private readToken(): Token {
    if (this.reader.isEnd()) {
      return this.token(Tokens.EOF);
    } else if (this.reader.peek() == '"') {
      return this.readStrToken();
    } else if (this.reader.peek() == "'") {
      return this.readCharToken();
    } else {
      return this.readWordToken();
    }
  }

  public next(): Token {
    this.skipWhitespace();
    while (this.reader.peek() == "/" && this.reader.peek(1) == "/") {
      this.skipComment();
      this.skipWhitespace();
    }

    this.reader.span();

    return this.readToken();
  }

  public collect(): Token[] {
    const tokens = [];
    while (true) {
      const token = this.next();
      tokens.push(token);

      if (token.kind == Tokens.EOF)
        break;
    }

    return tokens;
  }
}