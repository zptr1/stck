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
    ins: ins.reverse(),
    outs: outs.reverse()
  });
}

// Math
addIntrinsic("add",    Instr.Add,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("sub",    Instr.Sub,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("mul",    Instr.Mul,    [DataType.Int, DataType.Int], [DataType.Int]);
addIntrinsic("divmod", Instr.DivMod, [DataType.Int, DataType.Int], [DataType.Int, DataType.Int]);

// Comprasion
addIntrinsic("lt", Instr.Lt, [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("eq", Instr.Eq, [DataType.Int, DataType.Int], [DataType.Bool]);
addIntrinsic("gt", Instr.Gt, [DataType.Int, DataType.Int], [DataType.Bool]);

// Bitwise Operations
addIntrinsic("shl",  Instr.Shl,  [DataType.Int,  DataType.Int],  [DataType.Int]);
addIntrinsic("shr",  Instr.Shr,  [DataType.Int,  DataType.Int],  [DataType.Int]);
addIntrinsic("not",  Instr.Not,  [DataType.Int],                 [DataType.Int]);
addIntrinsic("or",   Instr.Or,   [DataType.Int,  DataType.Int],  [DataType.Int]);
addIntrinsic("and",  Instr.And,  [DataType.Int,  DataType.Int],  [DataType.Int]);
addIntrinsic("xor",  Instr.Xor,  [DataType.Int,  DataType.Int],  [DataType.Int]);

// Logical Operations
addIntrinsic("lnot", Instr.LNot, [DataType.Bool],                [DataType.Bool]);
addIntrinsic("lor",  Instr.LOr,  [DataType.Bool, DataType.Bool], [DataType.Bool]);
addIntrinsic("land", Instr.LAnd, [DataType.Bool, DataType.Bool], [DataType.Bool]);

// Stack manipulation
addIntrinsic("dup",  Instr.Dup,  ["a"],           ["a", "a"]);
addIntrinsic("drop", Instr.Drop, ["a"],           []);
addIntrinsic("swap", Instr.Swap, ["a", "b"],      ["b", "a"]);
addIntrinsic("rot",  Instr.Rot,  ["a", "b", "c"], ["b", "c", "a"]);
addIntrinsic("over", Instr.Over, ["a", "b"],      ["a", "b", "a"]);
addIntrinsic("dup2", Instr.Dup2, ["a", "b"],      ["a", "b", "a", "b"]);
addIntrinsic(
  "swap2", Instr.Swap2,
  ["a", "b", "c", "d"],
  ["d", "c", "b", "a"]
);

// Memory
addIntrinsic("write",  Instr.Write,  [DataType.Int, DataType.Ptr],  []);
addIntrinsic("read",   Instr.Read,   [DataType.Ptr],                [DataType.Int])

// Program
addIntrinsic("putu",   Instr.Putu,   [DataType.Int],                []);
addIntrinsic("putch",  Instr.Putch,  [DataType.Int],                []);
addIntrinsic("print",  Instr.Print,  [DataType.Int],                []);
addIntrinsic("puts",   Instr.Puts,   [DataType.Int, DataType.Ptr],  []);

// Compile-time
addIntrinsic("<dump-stack>", Instr.Nop, [], []);
addIntrinsic("cast(int)",    Instr.Nop, ["a"], [DataType.Int]);
addIntrinsic("cast(ptr)",    Instr.Nop, ["a"], [DataType.Ptr]);
addIntrinsic("cast(bool)",   Instr.Nop, ["a"], [DataType.Bool]);
