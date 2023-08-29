import { ByteCode, Instr, Instruction } from "../shared";
import { ByteReader, ByteWriter } from "../util";

const BYTECODE_VERSION = 1;
const BYTECODE_MAGIC = Buffer.from([0x53, 0x54, 0x43, 0x4b, 0xFF]);

export function isBytecode(buffer: Buffer): boolean {
  return buffer.subarray(0, BYTECODE_MAGIC.length).equals(BYTECODE_MAGIC);
}

export function encodeBytecode(bytecode: ByteCode): Buffer {
  const writer = new ByteWriter();

  writer.array.push(...BYTECODE_MAGIC);
  writer.write(BYTECODE_VERSION);

  writer.u32(bytecode.progMemSize);
  writer.u32(bytecode.textMemSize);

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
  if (!isBytecode(buffer)) {
    throw new Error("Invalid bytecode");
  }

  const reader = new ByteReader(buffer, BYTECODE_MAGIC.length);
  const version = reader.read();

  if (version != BYTECODE_VERSION) {
    throw new Error(`Unsupported bytecode version - ${version}`);
  }

  const bytecode: ByteCode = {
    progMemSize: reader.u32(),
    textMemSize: reader.u32(),
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
