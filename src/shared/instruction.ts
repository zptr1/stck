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

  // Bitwise Operations
  Shl,  // <<
  Shr,  // >>
  Not,  // ~
  Or,   // |
  And,  // &
  Xor,  // ^

  // Logical Operations
  LNot,
  LOr,
  LAnd,

  // Stack manipulation
  Dup,
  Drop,
  Swap,
  Rot,
  Over,
  Dup2,
  Swap2,

  // Memory
  Read,
  Write,

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
