import { Location } from "./location";
import { DataType } from "./types";

export enum AstType {
  Proc,
  Macro,
  Const,
  If,
  While,
  Push,
  Word,
}

export interface IAst<T extends AstType> {
  type: T;
  loc: Location;
}

export type Expr = IWord | IPush | ICondition | IWhile;
export type TopLevelAst = IProc | IMacro | IConst;
export type Ast = Expr | IProc | IMacro | IConst;

export interface IWord extends IAst<AstType.Word> {
  value: string;
}

export interface IPush extends IAst<AstType.Push> {
  datatype: DataType;
  value: any;
}

export interface ICondition extends IAst<AstType.If> {
  body: Expr[];
  else: Expr[];
}

export interface IWhile extends IAst<AstType.While> {
  condition: Expr[];
  body: Expr[];
}

export interface IProc extends IAst<AstType.Proc> {
  name: string;
  body: Expr[];
}

export interface IMacro extends IAst<AstType.Macro> {
  name: string;
  body: Expr[];
}

export interface IConst extends IAst<AstType.Const> {
  name: string;
  body: Expr[];
}

export interface IProgram {
  procs: Map<string, IProc>;
  macros: Map<string, IMacro>;
  consts: Map<string, IConst>;
}