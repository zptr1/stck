import { Location } from "../shared";
import { assertNever } from "..";
import chalk from "chalk";

export enum Err {
  EmptyFile,
  UnresolvedImport,

  InvalidSyntax,
  InvalidType,
  InvalidExpr,
  InvalidComptime,

  UnexpectedToken,
  UnclosedBlock,
  DuplicatedDefinition,

  RecursiveInlineProcExpansion,
  RecursiveMacroExpansion,

  InsufficientStackTypes,
  UnexpectedStackTypes,
  UnhandledStackTypes,
}

export enum ErrSpanKind {
  Error,
  Warn,
  Note,
  Trace,
}

export interface ErrorSpan {
  kind: ErrSpanKind;
  loc: Location;
  text?: string;
  start: { line: number, col: number },
  end:   { line: number, col: number },
}

export interface ErrorFile {
  loc: Location;
  lines: string[];
  spans: ErrorSpan[];
  hints: string[];
}

export function errToStr(err: Err): string {
  if (err == Err.EmptyFile) {
    return "empty file";
  } else if (err == Err.UnresolvedImport) {
    return "unresolved import";
  } else if (err == Err.InvalidSyntax) {
    return "invalid syntax";
  } else if (err == Err.InvalidType) {
    return "invalid type";
  } else if (err == Err.InvalidExpr) {
    return "invalid expression";
  } else if (err == Err.InvalidComptime) {
    return "invalid compile-time expression";
  } else if (err == Err.UnexpectedToken) {
    return "unexpected token";
  } else if (err == Err.UnclosedBlock) {
    return "unclosed block";
  } else if (err == Err.DuplicatedDefinition) {
    return "duplicated definition";
  } else if (err == Err.RecursiveInlineProcExpansion) {
    return "recursive expansion of an inline procedure";
  } else if (err == Err.RecursiveMacroExpansion) {
    return "recursive expansion of a macro";
  } else if (err == Err.InsufficientStackTypes) {
    return "insufficient types on the stack";
  } else if (err == Err.UnexpectedStackTypes) {
    return "unexpected types on the stack";
  } else if (err == Err.UnhandledStackTypes) {
    return "unhandled types on the stack";
  } else {
    assertNever(err);
  }
}

export function errSpanColor(kind: ErrSpanKind) {
  if (kind == ErrSpanKind.Error) {
    return chalk.red.bold;
  } else if (kind == ErrSpanKind.Warn) {
    return chalk.yellow.bold;
  } else if (kind == ErrSpanKind.Note) {
    return chalk.blue.bold;
  } else {
    return chalk.dim.bold;
  }
}

export function errSpanArrow(kind: ErrSpanKind, size: number) {
  if (kind == ErrSpanKind.Error || kind == ErrSpanKind.Warn) {
    return "^" + "~".repeat(Math.max(size - 1, 0));
  } else {
    return "^" + "-".repeat(Math.max(size - 1, 0));
  }
}

export * from "./formatter";