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

  // Stack manipulation
  Dup,
  Drop,
  Swap,
  Rot,
  Over,
  Dup2,
  Swap2,

  // Memory
  Write8,
  Write16,
  Write32,
  Write64,
  Read8,
  Read16,
  Read32,
  Read64,

  // Program
  Print,
  Puts,
  Putu,
  Putch,
  Halt
}

export type MarkedInstr = [Instr, ...(number | bigint | string)[]];
export type Instruction = [Instr, ...(number | bigint)[]];

export interface ByteCode {
  text: string[];
  instr: Instruction[];
  textMemSize: number;
  progMemSize: number;
}
