import { DataType } from "./types";

export const INTRINSICS = new Map<string, Intrinsic>();

export interface Intrinsic {
  name: string;
  ins: DataType[],
  outs: DataType[]
}

function addIntrinsic(name: string, ins: DataType[], outs: DataType[]) {
  INTRINSICS.set(name, {
    name, ins, outs
  });
}

addIntrinsic("add",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("sub",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("mul",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("divmod", [DataType.Int, DataType.Int],  [DataType.Int, DataType.Int]);
addIntrinsic("lt",     [DataType.Int, DataType.Int],  [DataType.Boolean]);
addIntrinsic("eq",     [DataType.Int, DataType.Int],  [DataType.Boolean]);
addIntrinsic("gt",     [DataType.Int, DataType.Int],  [DataType.Boolean]);
addIntrinsic("dup",    [DataType.Any],                [DataType.Any, DataType.Any]);
addIntrinsic("drop",   [DataType.Any],                []);
addIntrinsic("swap",   [DataType.Any, DataType.Any],  [DataType.Any, DataType.Any]);
addIntrinsic("print",  [DataType.Int],                []);
addIntrinsic("puts",   [DataType.Str],                []); // TODO: temporary; move to std in the future

// Compile-time intrinsics
addIntrinsic("<dump-stack>", [], []);

