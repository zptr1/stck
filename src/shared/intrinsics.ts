import { Instr } from "./instruction";
import { DataType } from "./types";

export const INTRINSICS = new Map<string, Intrinsic>();

export interface Intrinsic {
  name: string;
  instr: Instr;
  ins: DataType[],
  outs: DataType[],
}

function addIntrinsic(name: string, instr: Instr, ins: DataType[], outs: DataType[]) {
  INTRINSICS.set(name, {
    name, instr, ins, outs
  });
}

// TODO: Add type declaration support and move the signatures from here  to `lib/core.stck`
//       e. g. `def add int int -> int end`

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
addIntrinsic("dup",   Instr.Dup,  [DataType.Any],                             [DataType.Any, DataType.Any]);
addIntrinsic("drop",  Instr.Drop, [DataType.Any],                             []);
addIntrinsic("swap",  Instr.Swap, [DataType.Any, DataType.Any],               [DataType.Any, DataType.Any]);
addIntrinsic("rot",   Instr.Rot,  [DataType.Any, DataType.Any, DataType.Any], [DataType.Any, DataType.Any, DataType.Any]);
addIntrinsic("over",  Instr.Over, [DataType.Any, DataType.Any],               [DataType.Any, DataType.Any, DataType.Any]);
addIntrinsic("dup2",  Instr.Dup2, [DataType.Any, DataType.Any],               [DataType.Any, DataType.Any, DataType.Any, DataType.Any]);
addIntrinsic(
  "swap2", Instr.Swap2,
  [DataType.Any, DataType.Any, DataType.Any, DataType.Any],
  [DataType.Any, DataType.Any, DataType.Any, DataType.Any]
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
addIntrinsic("cast(int)",    Instr.Nop, [DataType.Any], [DataType.Int]);
addIntrinsic("cast(ptr)",    Instr.Nop, [DataType.Any], [DataType.Ptr]);
addIntrinsic("cast(bool)",   Instr.Nop, [DataType.Any], [DataType.Bool]);
