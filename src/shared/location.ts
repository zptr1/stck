import lineColumn from "line-column";
import { readFileSync } from "fs";
import plib from "path";

export type Span = [start: number, end: number];

export interface Location {
  file: File;
  span: Span;
}

export interface ExpansionStackElement {
  name: string;
  loc: Location;
}

export function formatLoc(location: Location): string {
  const loc = location.file.lineColumn(location.span[0]);
  return `${location.file.path}:${loc?.line}:${loc?.col}`;
}

export class File {
  static read(path: string, parent?: File) {
    return new File(
      plib.resolve(path),
      readFileSync(path, "utf-8"),
      parent
    );
  }

  private lc: ReturnType<typeof lineColumn> | undefined;

  constructor(
    public readonly path: string,
    public readonly source: string,
    public readonly parent?: File
  ) {}

  slice([start, end]: Span) {
    return this.source.slice(start, end);
  }

  location(span: Span): Location {
    return {
      file: this,
      span
    };
  }

  child(path: string, source?: string) {
    if (typeof source != "undefined") {
      return new File(plib.resolve(path), source, this);
    } else {
      return File.read(plib.resolve(path), this);
    }
  }

  lineColumn(index: number) {
    this.lc ??= lineColumn(this.source);
    return this.lc.fromIndex(index);
  }

  get filename() {
    return plib.basename(this.path);
  }
}
