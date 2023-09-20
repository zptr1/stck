import { Location } from "../shared";

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

export * from "./formatter";