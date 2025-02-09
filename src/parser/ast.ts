import { File, Location, TypeFrame } from "../shared";

export enum AstKind {
  Proc,
  Const,
  Var,
  Literal,
  Word,
  If,
  Loop,
  Let,
  Cast,
  Assert,
  Extern,
}

export enum WordType {
  Unknown,
  Intrinsic,
  Proc,
  Memory,
  LocalMemory,
  Var,
  Constant,
  Binding,
  Return,
  Extern
}

export enum LiteralType {
  Int,
  BigInt,
  Str,
  CStr,
  Assembly
}

export type Expr = Word | Literal | Condition | Loop | Let | Cast;
export type Definition = Proc | Const | Assert;

export interface Program {
  file: File;
  procs: Map<string, Proc>;
  consts: Map<string, Const>;
  memories: Map<string, Const>;
  externs: Map<string, Extern>;
  vars: Map<string, Var>;
  assertions: Assert[];
  libraries: string[];
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

export interface Assert extends Ast<AstKind.Assert> {
  message: string;
  body: Expr[];
}

export interface Var extends Ast<AstKind.Var> {
  name: string;
  type: TypeFrame;
  size: number;
}

export interface Proc extends Ast<AstKind.Proc> {
  name: string;
  body: Expr[];
  signature: Signature;
  memories: Map<string, Const>;
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

export interface Loop extends Ast<AstKind.Loop> {
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

export interface Extern extends Ast<AstKind.Extern> {
  name: string;
  symbol: string;
  signature: Signature;
  library: string;
}
