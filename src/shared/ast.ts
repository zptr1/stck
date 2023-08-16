import { DataType, WordType } from "./types";
import { Location } from "./location";

export enum AstType {
  Program,
  Proc,
  Const,
  If,
  While,
  Push,
  Word,
}

export interface Ast<T extends AstType> {
  type: T;
  loc: Location;
}

export type Expr = ICondition | IWhile | IWord | IPush;

export interface IWord extends Ast<AstType.Word> {
  wordtype: WordType;
  value: string;
}

export interface IPush extends Ast<AstType.Push> {
  datatype: DataType;
  value: any;
}

export interface ICondition extends Ast<AstType.If> {
  body: Expr[];
  else: Expr[];
}

export interface IWhile extends Ast<AstType.While> {
  condition: Expr[];
  body: Expr[];
}

export interface IProc extends Ast<AstType.Proc> {
  name: string;
  body: Expr[];
}

export interface IConstant extends Ast<AstType.Const> {
  name: string;
  body: Expr[];
}

export interface IProgram {
  procs: Map<string, IProc>;
  constants: Map<string, IConstant>;
}