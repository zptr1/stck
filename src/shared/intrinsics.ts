import { DataType } from "./types";

export const INTRINSICS = new Map<string, Intrinsic>();

export interface Intrinsic {
  name: string;
  ins: DataType[],
  outs: DataType[],
  index: number
}

function addIntrinsic(name: string, ins: DataType[], outs: DataType[]) {
  INTRINSICS.set(name, {
    name, ins, outs,
    index: INTRINSICS.size
  });
}

addIntrinsic("add",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("sub",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("mul",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("divmod", [DataType.Int, DataType.Int],  [DataType.Int, DataType.Int]);
addIntrinsic("lt",     [DataType.Int, DataType.Int],  [DataType.Bool]);
addIntrinsic("eq",     [DataType.Int, DataType.Int],  [DataType.Bool]);
addIntrinsic("gt",     [DataType.Int, DataType.Int],  [DataType.Bool]);
addIntrinsic("dup",    [DataType.Any],                [DataType.Any, DataType.Any]);
addIntrinsic("drop",   [DataType.Any],                []);
addIntrinsic("swap",   [DataType.Any, DataType.Any],  [DataType.Any, DataType.Any]);
addIntrinsic("print",  [DataType.Int],                []);
addIntrinsic("puts",   [DataType.Int, DataType.Ptr],  []); // TODO: temporary; move to std in the future

// Compile-time intrinsics
addIntrinsic("<dump-stack>", [], []);

