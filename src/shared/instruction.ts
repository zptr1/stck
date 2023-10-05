export enum Instr {
  Nop,
  Label,

  EnterProc,

  Push,
  Push64,
  PushStr,
  PushLocal,
  PushMem,
  AsmBlock,

  // Control flow
  Call,
  Ret,
  Jmp,
  JmpIf,
  JmpIfNot,

  // Math
  Add,
  Sub,
  Mul,
  Div,
  Mod,
  DivMod,
  IMul,
  IDiv,
  IMod,
  IDivMod,
  Min,
  Max,

  // Comparison
  Eq,
  Neq,
  Lt,
  Gt,
  LtEq,
  GtEq,

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
  Bind,
  Unbind,

  // Memory
  // TODO: A single Write and Read instructions with { size: number }
  Write8,
  Write16,
  Write32,
  Write64,
  Read8,
  Read16,
  Read32,
  Read64,

  WriteT,
  ReadT,

  // Program
  Print,
  Puts,
  Halt,
  DumpStack,

  // Compile-time expressions
  _CExpr__Offset,
  _CExpr__Reset
}

type _instr = (
  | { kind: Instr.EnterProc, name: string, id: number }
  | { kind: Instr.Label, label: number }
  | { kind: Instr.Push, value: number }
  | { kind: Instr.Push64, value: bigint }
  | { kind: Instr.PushStr, id: number, len: number }
  | { kind: Instr.PushMem, offset: number }
  | { kind: Instr.PushLocal, offset: number }
  | { kind: Instr.AsmBlock, value: string }
  | {
      kind: Instr.Bind | Instr.Unbind,
      count: number
    }
  | {
      kind: Instr.Jmp | Instr.JmpIf | Instr.JmpIfNot,
      label: number
    }
  | { kind: Instr.Call, id: number }
  | { kind: Instr.Halt, code: number }
);

export type Instruction =
  | _instr
  | { kind: Exclude<Instr, _instr["kind"]> };
