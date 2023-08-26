export enum Instr {
  Push,
  Call,
  Nop,
  Jmp,
  JmpIfNot,
  Add,
  Sub,
  Mul,
  DivMod,
  Lt,
  Eq,
  Gt,
  Dup,
  Drop,
  Swap,
  Print,
  Puts,
  Halt
}

export type MarkedInstr = [Instr, ...(number | string)[]];
export type Instruction = [Instr, ...number[]];

export interface ByteCode {
  text: string[];
  instr: Instruction[];
}
