import { KEYWORDS, Token, Tokens } from "./token";
import { File, Location, Span } from "../shared";
import { i64_MAX, i64_MIN } from "../misc";
import { Err, StckError } from "../errors";

const HEX_DIGITS = "0123456789abcdefABCDEF";
const DEC_DIGITS = "0123456789";

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

  private readString(quote='"', raw=false): string {
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
        } else if (raw) {
          value += "\\" + esc;
        } else if (esc == "u") {
          const code = this.source.slice(this.cursor, this.cursor += 4);
          if (!code.match(/^[\da-f]{4}$/i)) {
            this.error("invalid unicode escape sequence");
          }

          value += String.fromCharCode(parseInt(code, 16));
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
    let isHex = false;

    while (this.cursor < this.source.length) {
      const ch = this.source[this.cursor++];
      if (" \n\r\t".includes(ch))
        break;

      if (ch == "x" && value == "0") {
        isHex = true;
      } else if (isHex) {
        HEX_DIGITS.includes(ch) || this.error("expected a hexadecimal digit");
      } else if (isInt && !DEC_DIGITS.includes(ch)) {
        isInt = false;
      }

      value += ch;
    }

    if (isInt && value != "-") {
      const int = BigInt(value);
      if (int > i64_MAX || int < i64_MIN) {
        this.error("the integer is too big");
      }

      return {
        kind: Tokens.Int,
        value: int,
        loc: this.span(),
      };
    } else if (KEYWORDS.has(value)) {
      return {
        kind: value as Tokens,
        loc: this.span()
      };
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
        this.cursor++;
        tokens.push({
          kind: Tokens.CStr,
          value: this.readString(),
          loc: this.span()
        });
      } else if (peek == "r" && this.source[this.cursor + 1] == '"') {
        this.cursor++;
        tokens.push({
          kind: Tokens.Str,
          value: this.readString('"', true),
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