import lineColumn from "line-column";
import { readFileSync } from "fs";
import plib from "path";

export type Span = [start: number, end: number];

export interface Location {
  file: File;
  span: Span;
}

export class File {
  static read(path: string, parent?: File) {
    return new File(
      plib.resolve(path),
      readFileSync(path, "utf-8"),
      parent
    );
  }

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
    }
  }

  formatLoc(span: Span): string {
    const loc = lineColumn(this.source).fromIndex(span[0]);
    return `${this.path}:${loc?.line}:${loc?.col}`;
  }

  child(path: string, source?: string) {
    if (typeof source != "undefined") {
      return new File(plib.resolve(path), source, this);
    } else {
      return File.read(plib.resolve(path), this);
    }
  }

  parentStack(): string[] {
    const stack: string[] = [];
    let file: File = this;

    while (file.parent) {
      file = file.parent;
      stack.push(file.path);
    }

    return stack;
  }
}