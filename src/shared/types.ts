import { Tokens } from "./token";

export enum DataType {
  Int,
  Ptr,
  Str,
  Bool,
  Any
}

export function compareDataTypeArrays(a: DataType[], b: DataType[]) {
  return a.length == b.length && !a.some(
    (x, i) => x != b[i] && b[i] != DataType.Any && x != DataType.Any
  );
}

export function tokenToDataType(token: Tokens): DataType {
  if (token == Tokens.Int) {
    return DataType.Int;
  } else if (token == Tokens.Str) {
    return DataType.Str;
  } else if (token == Tokens.Boolean) {
    return DataType.Bool;
  } else {
    throw new Error(`Cannot convert Tokens[${token}] to DataType`);
  }
}