export enum Instr {
  Push,
  Call,
  Nop,
  Jmp,
  JmpIfNot,
  Ret,

  // Math
  Add,
  Sub,
  Mul,
  DivMod,

  // Comprasion
  Lt,
  Eq,
  Gt,

  // Stack manipulation
  Dup,
  Drop,
  Swap,
  Rot,
  Dup2,
  Swap2,

  // Program
  Print,
  Puts,
  Putu,
  Putch,
  Halt
}

export type MarkedInstr = [Instr, ...(number | string)[]];
export type Instruction = [Instr, ...number[]];

export interface ByteCode {
  text: string[];
  instr: Instruction[];
  memorySize: number;
}
