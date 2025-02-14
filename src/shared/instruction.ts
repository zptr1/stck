export enum Instr {
  Nop,
  Label,

  Push,
  PushStr,
  PushAddr,
  PushLocal,
  PushLocalAddr,
  AsmBlock,

  // Control flow
  Call,
  CallExtern,
  Ret,
  Jmp,
  JmpIfNot,

  // Math
  Add,
  Sub,
  Mul,
  Div,
  Mod,
  DivMod,
  Neg,
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
  Shl,
  Shr,
  Not,
  Or,
  And,
  Xor,

  // Stack manipulation
  Dup,
  Drop,
  Swap,
  Rot,
  Over,
  Bind,

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
  
  Alloc,
  Dealloc,

  // Program
  Print,
  Puts,
  Halt,
  GetArgc,
  GetArgv,
  DumpStack,

  Offset,
  Reset
}

type _instr = (
  | { kind: Instr.Push, value: bigint }
  | { kind: Instr.PushStr, id: number, len: number }
  | { kind: Instr.PushAddr, offset: number }
  | { kind: Instr.PushLocal | Instr.PushLocalAddr, offset: number }
  | { kind: Instr.AsmBlock, value: string }
  | { kind: Instr.Bind, count: number }
  | { kind: Instr.Alloc | Instr.Dealloc, size: number }
  | { kind: Instr.Jmp | Instr.JmpIfNot | Instr.Label, label: number }
  | { kind: Instr.CallExtern, name: string, argc: number, hasOutput: boolean }
  | { kind: Instr.Call, id: number, argc: number, retc: number }
  | { kind: Instr.Halt, code: number | null }
);

export type Instruction =
  | _instr
  | { kind: Exclude<Instr, _instr["kind"]> };
