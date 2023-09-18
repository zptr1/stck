import { Location } from "../shared";

export const KEYWORDS = new Set([
  "%macro",
  "%end",
  "include",
  "proc",
  "unsafe",
  "inline",
  "::",
  "->",
  "const",
  "memory",
  "assert",
  "if",
  "if*",
  "else",
  "while",
  "let",
  "do",
  "end",
]);

export enum Tokens {
  // Literals
  Int = "<int>",
  Str = "<str>",
  CStr = "<cstr>",
  Boolean = "<boolean>",
  Word = "<word>",
  AsmBlock = "<asm>",
  // Preprocessor Directives
  Macro = "%macro",
  EndPre = "%end",
  Include = "include",
  // Keywords
  Proc = "proc",
  Unsafe = "unsafe",
  Inline = "inline",
  SigIns = "::",
  SigOuts = "->",
  Const = "const",
  Memory = "memory",
  Assert = "assert",
  If = "if",
  ChainedIf = "if*",
  Else = "else",
  While = "while",
  Let = "let",
  Do = "do",
  End = "end",
  // Special tokens
  EOF = "EOF"
}

export interface Token {
  kind: Tokens;
  loc: Location;
  value?: any;
}
