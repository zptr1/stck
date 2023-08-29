import { Span } from "../shared";

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

export class ByteWriter {
  public array: number[] = [];
  private writeInt(size: number, value: number) {
    const buf = Buffer.alloc(size);
    buf.writeIntLE(value, 0, size);
    this.array.push(...buf);
  }

  private writeUInt(size: number, value: number) {
    const buf = Buffer.alloc(size);
    buf.writeUIntLE(value, 0, size);
    this.array.push(...buf);
  }

  public write(byte: number) { this.array.push(byte) }

  public i8(value: number)  { this.writeInt(1, value);  }
  public u8(value: number)  { this.writeUInt(1, value); }
  public i16(value: number) { this.writeInt(2, value);  }
  public u16(value: number) { this.writeUInt(2, value); }
  public i32(value: number) { this.writeInt(4, value);  }
  public u32(value: number) { this.writeUInt(4, value); }

  public str(value: string) {
    const buf = Buffer.from(value, "utf-8");
    this.u16(buf.length);
    this.array.push(...buf);
  }

  public toBuffer() {
    return Buffer.from(this.array);
  }
}

export class ByteReader {
  constructor(
    public readonly buffer: Buffer,
    public cursor: number = 0
  ) {}

  private readInt(size: number) {
    return this.buffer.readIntLE(
      (this.cursor += size) - size,
      size
    );
  }

  private readUInt(size: number) {
    return this.buffer.readUIntLE(
      (this.cursor += size) - size,
      size
    );
  }

  public read() { return this.buffer[this.cursor++] }

  public i8()  { return this.readInt(1);  }
  public u8()  { return this.readUInt(1); }
  public i16() { return this.readInt(2);  }
  public u16() { return this.readUInt(2); }
  public i32() { return this.readInt(4);  }
  public u32() { return this.readUInt(4); }

  public str() {
    const ln = this.u16();
    return this.buffer.subarray(
      this.cursor,
      this.cursor += ln
    ).toString("utf-8");
  }
}

