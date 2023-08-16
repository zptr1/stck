import { Location } from "./location";

export const WORD_CHARS =
    "QWERTYUIOPASDFGHJKLZXCVBNM"  // Uppercase letters
  + "qwertyuiopasdfghjklzxcvbnm"  // Lowercase letters
  + "~!@#$%^&*()_-+=|;:,./<>?"    // Special characters
  + "0123456789";                 // Numbers

export const KEYWORDS = new Set([
  "proc", "macro", "const", "include", "end", "if", "if*", "else", "while", "do"
]);

export enum Tokens {
  Int = "<int>",
  Str = "<str>",
  // TODO: the regular string will probably be stored as <size><ptr>
  //       i think an C-style string (null-terminated) would also be useful in some cases
  //       (at least when doing syscalls)
  // CStr = "<cstr>",
  Char = "<char>",
  Boolean = "<boolean>",
  Word = "<word>",

  Proc = "proc",
  Macro = "macro",
  Const = "const",
  Include = "include",
  End = "end",
  If = "if",
  ChainedIf = "if*",
  Else = "else",
  While = "while",
  Do = "do",

  // Special token appended at the end of the file
  EOF = "EOF"
}

export interface Token {
  kind: Tokens;
  loc: Location;
  value?: any;
}
