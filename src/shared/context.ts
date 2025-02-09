import { Assert, Const, Proc } from "../parser";
import { assertNever } from "../misc";
import { Location } from ".";

export enum DataType {
  Unknown,
  Ptr,
  Int,
  Bool,
  PtrTo,
  Generic,
  // TODO: static pointers to differentiate between
  // pre-allocated and dynamically allocated pointers
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
  memories: Map<string, Const>;
  returnTypes: TypeFrame[] | undefined;
}

export function createContext(
  stack: TypeFrame[] = [],
  stackLocations: Location[] = [],
  bindings = new Map<string, TypeFrame>(),
  memories = new Map<string, Const>(),
  returnTypes?: TypeFrame[]
): Context {
  return {
    stack,
    stackLocations,
    bindings,
    returnTypes,
    memories
  };
}

export function cloneContext(ctx: Context): Context {
  return createContext(
    structuredClone(ctx.stack),
    ctx.stackLocations.slice(),
    ctx.bindings,
    ctx.memories,
    ctx.returnTypes
  );
}

export function frameToString(frame: TypeFrame): string {
  return (
    frame.type == DataType.Unknown ? "unknown"
    : frame.type == DataType.Ptr ? "ptr"
    : frame.type == DataType.Int ? "int"
    : frame.type == DataType.Bool ? "bool"
    : frame.type == DataType.PtrTo ? `ptr(${frameToString(frame.value)})`
    : frame.type == DataType.Generic ? `<${frame.label}>(${frameToString(frame.value)})`
    : assertNever(frame)
  );
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
