import { KEYWORDS, Token, Tokens } from "./token";
import { File, Location, Span } from "../shared";
import { Err, StckError } from "../errors";
import { i32_MAX, i32_MIN } from "..";

// TODO: i kinda wanna rewrite this into a single function
// the language's syntax is quite simple to tokenize sooo... should not be too hard i think?

export class Lexer {
  private cursor: number = 0;
  private spanStart: number = 0;

  constructor(
    public readonly file: File,
    private readonly source = file.source
  ) {}

  private span(): Location {
    const span: Span = [this.spanStart, this.cursor];
    this.spanStart = this.cursor;

    return {
      file: this.file,
      span,
    };
  }

  private error(message: string): never {
    throw new StckError(Err.InvalidSyntax)
      .addErr(this.span(), message);
  }

  private skipWhitespace(): void {
    while (" \n\r\t".includes(this.source[this.cursor]))
      this.cursor++;
  }

  private readString(quote='"'): string {
    let value = "";

    this.cursor++;
    while (this.source[this.cursor] != quote) {
      const char = this.source[this.cursor++];
      if (!char) {
        this.error("unclosed string");
      } else if (char == "\\") {
        const esc = this.source[this.cursor++];
        if (!esc) {
          this.error("unexpected EOF");
        } else if (esc == "n") {
          value += "\n";
        } else if (esc == "r") {
          value += "\r";
        } else if (esc == "t") {
          value += "\t";
        } else {
          value += esc;
        }
      } else if (char == "\n") {
        this.error("unexpected newline");
      } else {
        value += char;
      }
    }

    this.cursor++;
    if (!value)
      this.error("empty string");

    return value;
  }

  private readAsmBlock(): Token {
    const lines: string[] = [];
    const line: string[] = [];
    let word = "";

    while (true) {
      const char = this.source[this.cursor];
      if (" \n\r\t".includes(char) && word) {
        if (word == "end") break;
        else if (word[0] == "\\")
          line.push(word.slice(1));
        else line.push(word);
        word = "";
      }

      this.cursor++;
      if (char == "\n") {
        if (line.length) {
          lines.push(line.join(" "));
          line.splice(0, line.length);
        }
      } else if (!char) {
        this.error("unclosed asm block");
      } else if (char != " ") {
        word += char;
      }
    }

    lines.push(line.join(" "));
    return {
      kind: Tokens.AsmBlock,
      loc: this.span(),
      value: lines.join("\n")
    };
  }

  private readWordToken(): Token {
    let value = this.source[this.cursor++];
    let isInt = "-0123456789".includes(value);

    while (this.cursor < this.source.length) {
      const ch = this.source[this.cursor++];
      if (" \n\r\t".includes(ch))
        break;

      value += ch;
      isInt &&= "0123456789".includes(ch);
    }

    if (isInt && value != "-") {
      const int = parseInt(value);
      return {
        kind: Tokens.Int,
        value: int > i32_MAX || int < i32_MIN
          ? BigInt(value)
          : int,
        loc: this.span(),
      };
    } else if (KEYWORDS.has(value)) {
      return {
        kind: value as Tokens,
        loc: this.span()
      }
    } else if (value == "asm") {
      return this.readAsmBlock();
    } else {
      return {
        kind: Tokens.Word,
        loc: this.span(),
        value
      };
    }
  }

  public lex(): Token[] {
    const tokens: Token[] = [];

    while (this.cursor < this.source.length) {
      this.skipWhitespace();
      while (this.source[this.cursor] == "/" && this.source[this.cursor + 1] == "/") {
        while (
          !"\n\r".includes(this.source[this.cursor++])
          && this.cursor < this.source.length
        );

        this.skipWhitespace();
      }

      this.spanStart = this.cursor;
      const peek = this.source[this.cursor];

      if (this.cursor >= this.source.length) {
        tokens.push({
          kind: Tokens.EOF,
          loc: this.span()
        });
      } else if (peek == '"') {
        tokens.push({
          kind: Tokens.Str,
          value: this.readString(),
          loc: this.span()
        });
      } else if (peek == "c" && this.source[this.cursor + 1] == '"') {
        tokens.push({
          kind: Tokens.CStr,
          value: this.readString(),
          loc: this.span()
        });
      } else if (peek == "'") {
        const str = this.readString("'");
        if (str.length > 1)
          this.error("invalid character");

        tokens.push({
          kind: Tokens.Int,
          value: str.charCodeAt(0),
          loc: this.span()
        });
      } else {
        tokens.push(this.readWordToken());
      }
    }

    return tokens;
  }
}