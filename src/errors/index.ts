import { File, Location } from "../shared";

export enum Err {
  Error,
  Note,
  Trace,
}

export interface ErrorSpan {
  kind: Err;
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

export * from "./formatter";