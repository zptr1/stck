import { DataType } from "./types";
import { Location } from "./location";

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
export type Ast = Expr | IProc | IConstant;

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

export interface IConstant extends IAst<AstType.Const> {
  name: string;
  body: Expr[];
}

export interface IProgram {
  procs: Map<string, IProc>;
  macros: Map<string, IMacro>;
  constants: Map<string, IConstant>;
}