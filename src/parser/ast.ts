import { File, Location, TypeFrame } from "../shared";

export enum AstKind {
  Proc,
  Const,
  Literal,
  Word,
  If,
  While,
  Let,
  Cast,
}

export enum WordType {
  Unknown,
  Intrinsic,
  Proc,
  Memory,
  Constant,
  Binding,
}

export enum LiteralType {
  Int,
  Bool,
  Str,
  CStr,
  Assembly
}

export type Expr = Word | Literal | Condition | While | Let | Cast;

export interface Program {
  file: File;
  procs: Map<string, Proc>;
  consts: Map<string, Const>;
  memories: Map<string, Const>;
}

export interface Signature {
  ins: TypeFrame[];
  outs: TypeFrame[];
}

export interface Ast<T extends AstKind> {
  kind: T;
  loc: Location;
}

export interface Const extends Ast<AstKind.Const> {
  name: string;
  body: Expr[];
  type: TypeFrame;
}

export interface Proc extends Ast<AstKind.Proc> {
  name: string;
  body: Expr[];
  signature: Signature;
  unsafe: boolean;
  inline: boolean;
}

export interface Word extends Ast<AstKind.Word> {
  value: string;
  type: WordType;
}

export interface Literal extends Ast<AstKind.Literal> {
  type: LiteralType;
  value: any;
}

export interface Condition extends Ast<AstKind.If> {
  condition: Expr[];
  body: Expr[];
  else: Expr[];
  elseBranch?: Location;
}

export interface While extends Ast<AstKind.While> {
  condition: Expr[];
  body: Expr[];
}

export interface Let extends Ast<AstKind.Let> {
  bindings: string[];
  body: Expr[];
}

export interface Cast extends Ast<AstKind.Cast> {
  types: TypeFrame[];
}
