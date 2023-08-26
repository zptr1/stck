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

addIntrinsic("add",    Instr.Add,    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("sub",    Instr.Sub,    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("mul",    Instr.Mul,    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("divmod", Instr.DivMod, [DataType.Int, DataType.Int],  [DataType.Int, DataType.Int]);
addIntrinsic("lt",     Instr.Lt,     [DataType.Int, DataType.Int],  [DataType.Bool]);
addIntrinsic("eq",     Instr.Eq,     [DataType.Int, DataType.Int],  [DataType.Bool]);
addIntrinsic("gt",     Instr.Gt,     [DataType.Int, DataType.Int],  [DataType.Bool]);
addIntrinsic("dup",    Instr.Dup,    [DataType.Any],                [DataType.Any, DataType.Any]);
addIntrinsic("drop",   Instr.Drop,   [DataType.Any],                []);
addIntrinsic("swap",   Instr.Swap,   [DataType.Any, DataType.Any],  [DataType.Any, DataType.Any]);
addIntrinsic("print",  Instr.Print,  [DataType.Int],                []);
addIntrinsic("puts",   Instr.Puts,   [DataType.Int, DataType.Ptr],  []); // TODO: temporary; move to std in the future

// Compile-time intrinsics
addIntrinsic("<dump-stack>", Instr.Nop, [], []);
