import { Tokens } from "./token";

export enum DataType {
  Int,
  Str,
  Char,
  Boolean
}

export enum WordType {
  Proc,
  Intrinsic,
  Constant
}

export function tokenToDataType(token: Tokens): DataType {
  if (token == Tokens.Int) {
    return DataType.Int;
  } else if (token == Tokens.Str) {
    return DataType.Str;
  } else if (token == Tokens.Char) {
    return DataType.Char;
  } else if (token == Tokens.Boolean) {
    return DataType.Boolean;
  } else {
    throw new Error(`Cannot convert Tokens[${token}] to DataType`);
  }
}