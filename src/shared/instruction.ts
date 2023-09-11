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
  IMul,
  IDivMod,

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
  Bind,
  PushBind,
  Unbind,

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
  Halt
}

export type LabeledInstr = [Instr, ...(number | bigint | string)[]];
export type Instruction = [Instr, ...(number | bigint)[]];

export interface ByteCode {
  text: string[];
  instr: Instruction[];
  textMemSize: number;
  progMemSize: number;
}
