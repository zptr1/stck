import { KEYWORDS, Token, Tokens } from "./token";
import { File, formatLoc } from "../shared";
import { Err, StckError } from "../errors";
import { Reader } from "../util";

// TODO: i kinda wanna rewrite this into a single function
// the language's syntax is quite simple to tokenize sooo... should not be too hard i think?

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
    return new StckError("invalid syntax")
      .add(Err.Error, {
        file: this.file,
        span: this.reader.span()
      }, message)
      .throw();
  }

  private skipWhitespace(): void {
    while (" \n\r\t".includes(this.reader.peek()))
      this.reader.next();
  }

  private skipComment(): void {
    while (
      !"\n\r".includes(this.reader.next())
      && !this.reader.isEnd()
    );
  }

  private readChar(): string {
    const char = this.reader.next()!;
    if (char == "\\") {
      const esc = this.reader.next();
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

    this.reader.next();
    while (this.reader.peek() != '"') {
      if (this.reader.isEnd())
        this.error("unclosed string");
      value += this.readChar();
    }

    this.reader.next();
    if (!value)
      this.error("empty string");

    return this.token(kind, value);
  }

  private readCharToken(): Token {
    this.reader.next();
    const value = this.readChar();

    if (this.reader.next() != "'") {
      this.error("unclosed char");
    }

    return this.token(Tokens.Int, value.charCodeAt(0));
  }

  private readAsmBlock(): Token {
    const lines: string[] = [];
    const line: string[] = [];
    let word = "";

    while (true) {
      const char = this.reader.peek();
      if (" \n\r\t".includes(char) && word) {
        if (word == "end") break;
        else if (word[0] == "\\")
          line.push(word.slice(1));
        else line.push(word);
        word = "";
      }

      this.reader.next();
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
    let value = this.reader.next();
    let isInt = "-0123456789".includes(value);

    while (!this.reader.isEnd()) {
      const ch = this.reader.next()!;
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
    } else if (value == "true" || value == "false") {
      return this.token(Tokens.Boolean, value == "true");
    } else if (KEYWORDS.has(value)) {
      return this.token(value as Tokens);
    } else if (value == "asm") {
      return this.readAsmBlock();
    } else if (value == "<here>") {
      return this.token(Tokens.Str, formatLoc({
        file: this.file,
        span: [this.reader.spanStart, this.reader.cursor]
      }));
    } else {
      return this.token(Tokens.Word, value);
    }
  }

  private readToken(): Token {
    if (this.reader.isEnd()) {
      return this.token(Tokens.EOF);
    } else if (this.reader.peek() == '"') {
      return this.readStrToken(Tokens.Str);
    } else if (this.reader.peek() == "c" && this.reader.peek(1) == '"') {
      return this.readStrToken(Tokens.CStr);
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
    while (!this.reader.isEnd()) {
      tokens.push(this.next());
    }

    return tokens;
  }
}