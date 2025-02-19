import { Location } from "../shared";

export const KEYWORDS = new Set([
  "%macro",
  "%end",
  "%del",
  "%include",
  "proc",
  "unsafe",
  "inline",
  "::",
  "->",
  "const",
  "memory",
  "var",
  "override",
  "extern",
  "as",
  "assert",
  "if",
  "elif",
  "else",
  "while",
  "let",
  "cast",
  "return",
  "in",
  "do",
  "end",
]);

export enum Tokens {
  // Literals
  Int = "<int>",
  Str = "<str>",
  CStr = "<cstr>",
  Word = "<word>",
  AsmBlock = "<asm>",
  // Preprocessor Directives
  Macro = "%macro",
  EndPre = "%end",
  Del = "%del",
  Include = "%include",
  // Keywords
  Proc = "proc",
  Unsafe = "unsafe",
  Inline = "inline",
  SigIns = "::",
  SigOuts = "->",
  Const = "const",
  Memory = "memory",
  Var = "var",
  Override = "override",
  Extern = "extern",
  As = "as",
  Assert = "assert",
  If = "if",
  ElseIf = "elif",
  Else = "else",
  While = "while",
  Let = "let",
  Cast = "cast",
  Return = "return",
  In = "in",
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
