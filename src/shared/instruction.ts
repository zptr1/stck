export enum Instr {
  Push,
  Call,
  Intrinsic,
  Jmp,
  JmpIfNot,
}

export type MarkedInstr = [Instr, ...(number | string)[]];
export type Instruction = [Instr, ...number[]];

export interface ByteCode {
  text: string[];
  instr: Instruction[];
}
