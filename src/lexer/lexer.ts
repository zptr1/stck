import { KEYWORDS, Token, Tokens } from "./token";
import { File, Location, Span, formatLoc } from "../shared";
import { Err, StckError } from "../errors";

// TODO: i kinda wanna rewrite this into a single function
// the language's syntax is quite simple to tokenize sooo... should not be too hard i think?

export class Lexer {
  private cursor: number = 0;
  private spanStart: number = 0;

  constructor(
    public readonly file: File
  ) {}

  private next(): string {
    return this.file.source[this.cursor++];
  }

  private peek(n = 0): string {
    return this.file.source[this.cursor + n];
  }

  private span(): Location {
    const span: Span = [this.spanStart, this.cursor];
    this.spanStart = this.cursor;

    return {
      file: this.file,
      span,
    };
  }

  private isEnd(): boolean {
    return this.cursor >= this.file.source.length;
  }

  private token(kind: Tokens, value?: any): Token {
    return {
      kind, value,
      loc: this.span()
    }
  }

  private error(message: string): never {
    return new StckError(Err.InvalidSyntax)
      .addErr(this.span(), message)
      .throw();
  }

  private skipWhitespace(): void {
    while (" \n\r\t".includes(this.peek()))
      this.next();
  }

  private skipComment(): void {
    while (
      !"\n\r".includes(this.next())
      && !this.isEnd()
    );
  }

  private readChar(): string {
    const char = this.next()!;
    if (char == "\\") {
      const esc = this.next();
      if (!esc) {
        this.error("unexpected EOF");
      } else if (esc == "n") {
        return "\n";
      } else if (esc == "r") {
        return "\r";
      } else if (esc == "t") {
        return "\t";
      } else {
        return esc;
      }
    } else if (char == "\n") {
      this.error("unexpected newline");
    }

    return char;
  }

  private readStrToken(kind: Tokens): Token {
    let value = "";

    this.next();
    while (this.peek() != '"') {
      if (this.isEnd())
        this.error("unclosed string");
      value += this.readChar();
    }

    this.next();
    if (!value)
      this.error("empty string");

    return this.token(kind, value);
  }

  private readCharToken(): Token {
    this.next();
    const value = this.readChar();

    if (this.next() != "'") {
      this.error("unclosed char");
    }

    return this.token(Tokens.Int, value.charCodeAt(0));
  }

  private readAsmBlock(): Token {
    const lines: string[] = [];
    const line: string[] = [];
    let word = "";

    while (true) {
      const char = this.peek();
      if (" \n\r\t".includes(char) && word) {
        if (word == "end") break;
        else if (word[0] == "\\")
          line.push(word.slice(1));
        else line.push(word);
        word = "";
      }

      this.next();
      if (char == "\n") {
        lines.push(line.join(" ").trim());
        line.splice(0, line.length);
      } else if (!char) {
        this.error("unclosed asm block");
      } else if (char != " ") {
        word += char;
      }
    }

    lines.push(line.join(" ".trim()));
    return this.token(
      Tokens.AsmBlock,
      lines.join("\n").trim()
    );
  }

  private readWordToken(): Token {
    let value = this.next();
    let isInt = "-0123456789".includes(value);

    while (!this.isEnd()) {
      const ch = this.next()!;
      if (" \n\r\t".includes(ch))
        break;

      value += ch;
      isInt &&= "0123456789".includes(ch);
    }

    if (isInt && value != "-") {
      const int = parseInt(value);
      return this.token(
        Tokens.Int,
        Number.isSafeInteger(int)
          ? int
          : BigInt(value)
      );
    } else if (KEYWORDS.has(value)) {
      return this.token(value as Tokens);
    } else if (value == "asm") {
      return this.readAsmBlock();
    } else if (value == "?here") {
      return this.token(Tokens.Str, formatLoc({
        file: this.file,
        span: [this.spanStart, this.cursor]
      }));
    } else {
      return this.token(Tokens.Word, value);
    }
  }

  private readToken(): Token {
    if (this.isEnd()) {
      return this.token(Tokens.EOF);
    } else if (this.peek() == '"') {
      return this.readStrToken(Tokens.Str);
    } else if (this.peek() == "'") {
      return this.readCharToken();
    } else if (this.peek() == "c" && this.peek(1) == '"') {
      return this.readStrToken(Tokens.CStr);
    } else {
      return this.readWordToken();
    }
  }

  public nextToken(): Token {
    this.skipWhitespace();
    while (this.peek() == "/" && this.peek(1) == "/") {
      this.skipComment();
      this.skipWhitespace();
    }

    this.span();
    return this.readToken();
  }

  public collect(): Token[] {
    const tokens = [];
    while (!this.isEnd()) {
      tokens.push(this.nextToken());
    }

    return tokens;
  }
}