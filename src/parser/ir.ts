import { File, Location } from "../shared";
import { IPush, ISignature } from "./ast";

export interface IIR<T extends IRType> {
  type: T;
  loc: Location;
}

export enum IRType {
  Proc,
  Word,
  While,
  If,
  Const,
  Memory,
}

export enum IRWordKind {
  Proc,
  Memory,
  Intrinsic,
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

export interface IRMemory extends IIR<IRType.Memory> {
  name: string;
  size: number;
  offset: number;
}

export interface IRProc extends IIR<IRType.Proc> {
  name: string;
  body: IRExpr[];
  inline: boolean;
  signature?: ISignature;
}

export interface IRProgram {
  file: File;
  procs: Map<string, IRProc>;
  memories: Map<string, IRMemory>;
  memorySize: number;
}
