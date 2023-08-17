import { IPush, ISignature } from "./ast";
import { Location } from "./location";

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
  body: IRExpr[]
  signature?: ISignature;
}

export interface IRProgram {
  procs: Map<string, IRProc>
}
