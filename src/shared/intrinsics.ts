import { DataType, DataTypeArray } from "./types";
import { Instr } from "./instruction";

export const INTRINSICS = new Map<string, Intrinsic>();

export interface Intrinsic {
  name: string;
  instr: Instr;
  ins: DataTypeArray,
  outs: DataTypeArray,
}

function addIntrinsic(name: string, instr: Instr, ins: DataTypeArray, outs: DataTypeArray) {
  INTRINSICS.set(name, {
    name, instr,
    ins, outs
  });
}

// Math
addIntrinsic("add",    Instr.Add,    ["a", "a"], ["a"]);
addIntrinsic("sub",    Instr.Sub,    ["a", "a"], ["a"]);
addIntrinsic("mul",    Instr.Mul,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("divmod", Instr.DivMod, [DataType.Int, DataType.Int], [DataType.Int, DataType.Int]);

addIntrinsic("imul",    Instr.IMul,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("idivmod", Instr.IDivMod, [DataType.Int, DataType.Int], [DataType.Int, DataType.Int]);

// Comprasion
addIntrinsic("lt", Instr.Lt, [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("eq", Instr.Eq, [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("gt", Instr.Gt, [DataType.Int, DataType.Int], [DataType.Bool]);

// Bitwise Operations
addIntrinsic("shl", Instr.Shl, [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("shr", Instr.Shr, [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("not", Instr.Not, [DataType.Int],                [DataType.Int]);
addIntrinsic("or",  Instr.Or,  [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("and", Instr.And, [DataType.Int,  DataType.Int], [DataType.Int]);
addIntrinsic("xor", Instr.Xor, [DataType.Int,  DataType.Int], [DataType.Int]);

// Stack manipulation
addIntrinsic("dup",  Instr.Dup,  ["a"],           ["a", "a"]);
addIntrinsic("drop", Instr.Drop, ["a"],           []);
addIntrinsic("swap", Instr.Swap, ["a", "b"],      ["b", "a"]);
addIntrinsic("rot",  Instr.Rot,  ["a", "b", "c"], ["c", "a", "b"]);
addIntrinsic("over", Instr.Over, ["a", "b"],      ["b", "a", "b"]);
addIntrinsic("2dup", Instr.Dup2, ["a", "b"],      ["a", "b", "a", "b"]);
addIntrinsic(
  "2swap", Instr.Swap2,
  ["a", "b", "c", "d"],
  ["d", "c", "b", "a"]
);

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
addIntrinsic("print", Instr.Print, [DataType.Int],               []);
addIntrinsic("puts",  Instr.Puts,  [DataType.Int, DataType.Ptr], []);

// Compile-time
addIntrinsic("<dump-stack>", Instr.Nop, [], []);
addIntrinsic("cast(int)",    Instr.Nop, ["a"], [DataType.Int]);
addIntrinsic("cast(ptr)",    Instr.Nop, ["a"], [DataType.Ptr]);
addIntrinsic("cast(bool)",   Instr.Nop, ["a"], [DataType.Bool]);
