import { DataType, DataTypeArray, File, Location } from "../shared";

export enum AstType {
  Proc,
  Macro,
  Const,
  Memory,
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
export type TopLevelAst = IProc | IMacro | IConst | IMemory;
export type Ast = Expr | IProc | IMacro | IConst;

export interface IWord extends IAst<AstType.Word> {
  value: string;
}

export interface IPush extends IAst<AstType.Push> {
  datatype: DataType | string;
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

export interface ISignature {
  ins: DataTypeArray;
  outs: DataTypeArray;
}

export interface IProc extends IAst<AstType.Proc> {
  name: string;
  body: Expr[];
  inline: boolean;
  unsafe: boolean;
  signature?: ISignature;
}

// -
export interface IMacro extends IAst<AstType.Macro> {
  name: string;
  body: Expr[];
}

export interface IConst extends IAst<AstType.Const> {
  name: string;
  body: Expr[]; // -
  // + body: IPush
}

export interface IMemory extends IAst<AstType.Memory> {
  name: string;
  body: Expr[]; // -
  // + size
  // + offset
}

export interface IProgram {
  file: File;
  procs: Map<string, IProc>;
  macros: Map<string, IMacro>; // -
  consts: Map<string, IConst>;
  memories: Map<string, IMemory>;
  // + memorySize
}