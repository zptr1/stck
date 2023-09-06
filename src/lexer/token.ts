import { Location } from "../shared";

export const KEYWORDS = new Set([
  "proc", "unsafe", "inline", "macro", "const", "memory",
  "include", "end", "if", "if*", "else",
  "while", "do", "::", "->"
]);

export enum Tokens {
  Int = "<int>",
  Str = "<str>",
  CStr = "<cstr>",  // C-style (null-terminated) string
  Boolean = "<boolean>",
  Word = "<word>",
  AsmBlock = "<asm>",

  Proc = "proc",
  Unsafe = "unsafe",
  Inline = "inline",
  Macro = "macro",
  Const = "const",
  Memory = "memory",
  Include = "include",
  End = "end",
  If = "if",
  ChainedIf = "if*",
  Else = "else",
  While = "while",
  Do = "do",
  SigIns = "::",
  SigOuts = "->",

  // Special token appended at the end of the file
  EOF = "EOF"
}

export interface Token {
  kind: Tokens;
  loc: Location;
  value?: any;
}
