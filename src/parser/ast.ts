import { File, Location, TypeFrame } from "../shared";

export enum AstKind {
  Proc,
  Const,
  Var,
  Literal,
  Word,
  If,
  While,
  Let,
  Cast,
  Assert,
}

export enum WordType {
  Unknown,
  Intrinsic,
  Proc,
  Memory,
  Var,
  Constant,
  Binding,
  Return,
}

export enum LiteralType {
  Int,
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
  vars: Map<string, Var>;
  assertions: Assert[];
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
