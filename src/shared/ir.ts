import { Location } from "./location";
import { DataType } from "./types";
import { IPush } from "./ast";

export interface IIR<T extends IRType> {
  type: T;
  loc: Location;
}

export enum IRType {
  Proc,
  Word,
  While,
  If,
  Const
}

export enum IRWordKind {
  Proc,
  Const,
  Intrinsic
}

export type IRExpr = IRWord | IPush | IRWhile | IRCondition;

export interface IRWord extends IIR<IRType.Word> {
  kind: IRWordKind;
  name: string;
}

export interface IRWhile extends IIR<IRType.While> {
  condition: IRExpr[];
  body: IRExpr[];
}

export interface IRCondition extends IIR<IRType.If> {
  body: IRExpr[];
  else: IRExpr[];
}

export interface IRConst extends IIR<IRType.Const> {
  name: string;
  body: IPush;
}

export interface IRProc extends IIR<IRType.Proc> {
  name: string;
  ins: DataType[];
  outs: DataType[];
  body: IRExpr[]
}

export interface IRProgram {
  procs: Map<string, IRProc>
}
