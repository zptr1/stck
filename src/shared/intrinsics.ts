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

addIntrinsic("+",     [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("-",     [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("*",     [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("/%",    [DataType.Int, DataType.Int],  [DataType.Int]);
addIntrinsic("<",     [DataType.Int, DataType.Int],  [DataType.Boolean]);
addIntrinsic("=",     [DataType.Int, DataType.Int],  [DataType.Boolean]);
addIntrinsic(">",     [DataType.Int, DataType.Int],  [DataType.Boolean]);
addIntrinsic("dup",   [DataType.Any],                [DataType.Any, DataType.Any]);
addIntrinsic("swap",  [DataType.Any, DataType.Any],  [DataType.Any, DataType.Any]);
addIntrinsic("print", [DataType.Int],                []);
