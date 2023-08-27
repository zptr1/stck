import { ByteCode, Instr, Instruction } from "./shared/instruction";
import { ByteReader, ByteWriter } from "./shared/reader";

export const MAGIC = Buffer.from([0x53, 0x54, 0x43, 0x4b, 0xFF]);
export const VERSION = 0;

export function encodeBytecode(bytecode: ByteCode): Buffer {
  const writer = new ByteWriter();

  writer.array.push(...MAGIC);
  writer.write(VERSION);

  writer.u32(bytecode.memorySize);
  writer.u16(bytecode.text.length);

  for (const str of bytecode.text) {
    writer.str(str);
  }

  for (const instr of bytecode.instr) {
    writer.write(instr[0]);

    if (instr[0] == Instr.Push) {
      writer.i32(instr[1]);
    } else if (
      instr[0] == Instr.Call
      || instr[0] == Instr.Jmp
      || instr[0] == Instr.JmpIfNot
    ) {
      writer.u32(instr[1]);
    } else if (instr[0] == Instr.Halt) {
      writer.i8(instr[1]);
    }
  }

  writer.write(0xFF);

  return writer.toBuffer();
}

export function decodeBytecode(buffer: Buffer): ByteCode {
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Invalid bytecode");
  }

  const reader = new ByteReader(buffer, MAGIC.length);
  const version = reader.read();

  if (version != VERSION) {
    throw new Error(`Unsupported bytecode version - ${version}`);
  }

  const bytecode: ByteCode = {
    memorySize: reader.u32(),
    text: [],
    instr: []
  }

  const textCount = reader.u16();
  for (let i = 0; i < textCount; i++) {
    bytecode.text.push(reader.str());
  }

  while (true) {
    const typ = reader.read();
    const instr: Instruction = [typ];

    if (typeof typ == "undefined" || typ == 0xFF) break;
    if (!Instr[typ]) {
      throw new Error(`Invalid instruction 0x${typ.toString(16).padStart(2, "0")}`)
    }

    if (typ == Instr.Push) {
      instr.push(reader.i32());
    } else if (
      typ == Instr.Call
      || typ == Instr.Jmp
      || typ == Instr.JmpIfNot
    ) {
      instr.push(reader.u32());
    } else if (typ == Instr.Halt) {
      instr.push(reader.i8());
    }

    bytecode.instr.push(instr);
  }

  return bytecode;
}
