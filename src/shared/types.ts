import { Tokens } from "../lexer";

export enum DataType {
  Int,
  Ptr,
  Str,
  Bool
}

export type DataTypeArray = (DataType | string)[];
export type TemplateMap = Map<string, DataType | string>;

export function compareDataTypeArrays(a: DataTypeArray, b: DataTypeArray) {
  return a.length == b.length && !a.some(
    (x, i) => x != b[i] && typeof b[i] != "string" && typeof x != "string"
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