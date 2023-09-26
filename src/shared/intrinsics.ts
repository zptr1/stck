import { DataType, TypeFrame } from "./context";
import { Instr } from "./instruction";

export const INTRINSICS = new Map<string, Intrinsic>();

export interface Intrinsic {
  instr: Instr;
  ins: TypeFrame[];
  outs: TypeFrame[];
}

function addIntrinsic(name: string, instr: Instr, ins: (DataType | string)[], outs: (DataType | string)[]) {
  INTRINSICS.set(name, {
    instr,
    // TODO: Find a better way to do this
    ins: ins.map(
      (x) => typeof x == "string" ? {
        type: DataType.Generic,
        value: { type: DataType.Unknown },
        label: x,
      } : { type: x as any }
    ),
    outs: outs.map(
      (x) => typeof x == "string" ? {
        type: DataType.Generic,
        value: { type: DataType.Unknown },
        label: x,
      } : { type: x as any }
    )
  });
}

// Math
addIntrinsic("add",    Instr.Add,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("sub",    Instr.Sub,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("mul",    Instr.Mul,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("div",    Instr.Div,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("mod",    Instr.Mod,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("divmod", Instr.DivMod, [DataType.Int, DataType.Int], [DataType.Int, DataType.Int]);

addIntrinsic("imul",    Instr.IMul,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("idiv",    Instr.IDiv,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("imod",    Instr.IMod,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("idivmod", Instr.IDivMod, [DataType.Int, DataType.Int], [DataType.Int, DataType.Int]);

// Comparison
addIntrinsic("eq",   Instr.Eq,   [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("neq",  Instr.Neq,  [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("lt",   Instr.Lt,   [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("gt",   Instr.Gt,   [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("lteq", Instr.LtEq, [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("gteq", Instr.GtEq, [DataType.Int, DataType.Int], [DataType.Bool]);

// Bitwise Operations
addIntrinsic("shl", Instr.Shl, [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("shr", Instr.Shr, [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("not", Instr.Not, [DataType.Int],                [DataType.Int]);
addIntrinsic("or",  Instr.Or,  [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("and", Instr.And, [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("xor", Instr.Xor, [DataType.Int,  DataType.Int], [DataType.Int]);

// Stack manipulation
addIntrinsic("drop", Instr.Drop, [DataType.Unknown], []);
addIntrinsic("dup",  Instr.Dup,  ["a"],           ["a", "a"]);
addIntrinsic("swap", Instr.Swap, ["a", "b"],      ["b", "a"]);
addIntrinsic("rot",  Instr.Rot,  ["a", "b", "c"], ["b", "c", "a"]);
addIntrinsic("over", Instr.Over, ["a", "b"],      ["a", "b", "a"]);

// Memory
addIntrinsic("write8",  Instr.Write8,  [DataType.Int, DataType.Ptr], []);
addIntrinsic("write16", Instr.Write16, [DataType.Int, DataType.Ptr], []);
addIntrinsic("write32", Instr.Write32, [DataType.Int, DataType.Ptr], []);
addIntrinsic("write64", Instr.Write32, [DataType.Int, DataType.Ptr], []);
addIntrinsic("read8",   Instr.Read8,   [DataType.Ptr],               [DataType.Int]);
addIntrinsic("read16",  Instr.Read16,  [DataType.Ptr],               [DataType.Int]);
addIntrinsic("read32",  Instr.Read32,  [DataType.Ptr],               [DataType.Int]);
addIntrinsic("read64",  Instr.Read32,  [DataType.Ptr],               [DataType.Int]);

// Program
addIntrinsic("print",       Instr.Print,     [DataType.Int],               []);
addIntrinsic("puts",        Instr.Puts,      [DataType.Int, DataType.Ptr], []);
addIntrinsic("dump-stack",  Instr.DumpStack, [], []);

// Compile-time
addIntrinsic("?stack-types", Instr.Nop, [], []);
addIntrinsic("offset",       Instr._CExpr__Offset, [DataType.Int], [DataType.Int]);
addIntrinsic("reset",        Instr._CExpr__Reset,  [],             [DataType.Int]);
