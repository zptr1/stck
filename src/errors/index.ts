import { assertNever } from "../misc";
import { Location } from "../shared";
import chalk from "chalk";

export enum Err {
  EmptyFile,
  NoMainProcedure,
  UnresolvedImport,

  InvalidSyntax,
  InvalidType,
  InvalidExpr,
  InvalidProc,
  InvalidComptime,

  UnexpectedToken,
  UnclosedBlock,
  DuplicatedDefinition,

  RecursiveInlineProcExpansion,
  RecursiveMacroExpansion,

  InsufficientStackTypes,
  UnexpectedStackTypes,
  UnhandledStackTypes,

  AssertionFailed,
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
  return (
    Err.EmptyFile ? "empty file"
    : err == Err.NoMainProcedure ? "no main procedure"
    : err == Err.UnresolvedImport ? "unresolved import"
    : err == Err.InvalidSyntax ? "invalid syntax"
    : err == Err.InvalidType ? "invalid type"
    : err == Err.InvalidExpr ? "invalid expression"
    : err == Err.InvalidProc ? "invalid procedure"
    : err == Err.InvalidComptime ? "invalid compile-time expression"
    : err == Err.UnexpectedToken ? "unexpected token"
    : err == Err.UnclosedBlock ? "unclosed block"
    : err == Err.DuplicatedDefinition ? "duplicated definition"
    : err == Err.RecursiveInlineProcExpansion ? "recursive expansion of an inline procedure"
    : err == Err.RecursiveMacroExpansion ? "recursive expansion of a macro"
    : err == Err.InsufficientStackTypes ? "insufficient types on the stack"
    : err == Err.UnexpectedStackTypes ? "unexpected types on the stack"
    : err == Err.UnhandledStackTypes ? "unhandled types on the stack"
    : err == Err.AssertionFailed ? "assertion failed"
    : "unknown error"
  );
}

export function errSpanColor(kind: ErrSpanKind) {
  return (
    kind == ErrSpanKind.Error ? chalk.red.bold
    : kind == ErrSpanKind.Warn ? chalk.yellow.bold
    : kind == ErrSpanKind.Note ? chalk.blue.bold
    : chalk.gray.bold
  );
}

export function errSpanArrow(kind: ErrSpanKind, size: number) {
  if (kind == ErrSpanKind.Error || kind == ErrSpanKind.Warn) {
    return "^" + "~".repeat(Math.max(size - 1, 0));
  } else {
    return "^" + "-".repeat(Math.max(size - 1, 0));
  }
}

export * from "./formatter";
