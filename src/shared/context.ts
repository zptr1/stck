import { assertNever } from "../util";
import { Location } from ".";

export enum DataType {
  Unknown,
  Ptr,
  Int,
  Bool,
  PtrTo,
  Generic,
}

export type TypeFrame = (
  | { type: DataType.Unknown }
  | { type: DataType.Int }
  | { type: DataType.Bool }
  | { type: DataType.Ptr }
  | { type: DataType.PtrTo, value: TypeFrame }
  | { type: DataType.Generic, label: string, value: TypeFrame }
) & {
  loc?: Location
};

export interface Context {
  stack: TypeFrame[];
  stackLocations: Location[];
  bindings: Map<string, TypeFrame>;
  // ...
}

export function createContext(
  stack: TypeFrame[] = [],
  stackLocations: Location[] = [],
  bindings: Map<string, TypeFrame> = new Map()
): Context {
  return {
    stack,
    stackLocations,
    bindings
  }
}

export function cloneContext(ctx: Context): Context {
  return createContext(structuredClone(ctx.stack), ctx.stackLocations.slice(), ctx.bindings);
}

export function frameToString(frame: TypeFrame): string {
  if (frame.type == DataType.Unknown) {
    return "unknown";
  } else if (frame.type == DataType.Ptr) {
    return "ptr(?)";
  } else if (frame.type == DataType.Int) {
    return "int";
  } else if (frame.type == DataType.Bool) {
    return "bool";
  } else if (frame.type == DataType.PtrTo) {
    return `ptr(${frameToString(frame.value)})`;
  } else if (frame.type == DataType.Generic) {
    return `<${frame.label}>(${frameToString(frame.value)})`;
  } else {
    assertNever(frame);
  }
}

export function sizeOf(frame: TypeFrame): number {
  if (
    frame.type == DataType.Ptr
    || frame.type == DataType.PtrTo
    || frame.type == DataType.Int
  ) {
    return 8;
  } else if (frame.type == DataType.Bool) {
    return 1;
  } else if (frame.type == DataType.Generic && frame.value.type != DataType.Unknown) {
    return sizeOf(frame.value);
  } else {
    throw new Error(`cannot get the size of ${frameToString(frame)}, as the full type is unknown`);
  }
}