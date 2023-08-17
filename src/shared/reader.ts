import { Span } from "./location";

type ArrayLike<T> = {
  [K in number]: T
} & {
  length: number
};

export class Reader<T> {
  public spanStart: number = 0;

  constructor(
    public readonly source: ArrayLike<T>,
    public cursor: number = 0
  ) {}

  next(): T {
    return this.source[this.cursor++];
  }

  peek(n: number = 0): T {
    return this.source[this.cursor + n];
  }

  span(): Span {
    const span: Span = [this.spanStart, this.cursor];
    this.spanStart = this.cursor;

    return span;
  }

  isEnd(): boolean {
    return this.cursor >= this.source.length;
  }
}