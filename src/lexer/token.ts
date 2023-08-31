import { Location } from "../shared";

export const KEYWORDS = new Set([
  "proc", "macro", "const", "memory",
  "include", "end", "if", "if*", "else",
  "while", "do", "::", "->"
]);

export enum Tokens {
  Int = "<int>",
  Str = "<str>",
  Char = "<char>",
  Boolean = "<boolean>",
  Word = "<word>",

  Proc = "proc",
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