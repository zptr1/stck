import { DataType, DataTypeArray, File, Location } from "../shared";
import { Token } from "../lexer";

export interface Signature {
  ins: DataTypeArray;
  outs: DataTypeArray;
}

export enum AstKind {
  Proc,
  Const,
  Push,
  Word,
  If,
  While,
}

export interface Ast<T extends AstKind> {
  kind: T;
  loc: Location;
}

// Preprocessed unparsed procedure
export interface IProc extends Ast<AstKind.Proc> {
  name: string;
  body: Token[];
  signature?: Signature;
  unsafe: boolean;
  inline: boolean;
}

// Preprocessed unparsed program
export interface IProgram {
  file: File;
  procs: Map<string, IProc>;
  consts: Map<string, Const>;
  memories: Map<string, Const>;
}

export interface Const extends Ast<AstKind.Const> {
  name: string;
  type: DataType;
  value: any;
}

// Parsed procedure
export type Proc = Omit<IProc, 'body'> & {
  body: Expr[];
}

// Parsed program
export type Program = Omit<IProgram, 'procs'> & {
  procs: Map<string, Proc>;
}

export type Expr = Word | Push | Condition | While;
export enum WordType {
  Intrinsic,
  Proc,
  Memory,
  Constant
}

export interface Word extends Ast<AstKind.Word> {
  value: string;
  type: WordType;
}

export interface Push extends Ast<AstKind.Push> {
  type: DataType | string;
  value: any;
}

export interface Condition extends Ast<AstKind.If> {
  body: Expr[];
  else: Expr[];
}

export interface While extends Ast<AstKind.While> {
  condition: Expr[];
  body: Expr[];
}
