import { ByteCode, Instr, Instruction } from "./shared/instruction";

export class VM {
  public readonly memory: Buffer;

  constructor(
    bytecode: ByteCode
  ) {
    this.memory = Buffer.alloc(bytecode.progMemSize + bytecode.textMemSize + 1);
    this.loadStrings(bytecode.text, bytecode.progMemSize);
    this.run(bytecode.instr);
  }

  private loadStrings(strings: string[], offset: number) {
    for (const str of strings) {
      offset += this.memory.write(str, offset, "utf-8");
    }
  }

  public run(instructions: Instruction[]): never {
    Bun.gc(true);

    let ip = 0;
    const stack: bigint[] = [];
    const returnStack: number[] = [];

    while (true) {
      const instr = instructions[ip++];
      const type = instr[0];

      if (type == Instr.Push) {
        stack.push(BigInt(instr[1]));
      } else if (type == Instr.Call) {
        returnStack.push(ip);
        ip = instr[1] as number;

        if (returnStack.length > 10000) {
          process.stderr.write("[RUNTIME ERROR] Stack overflow\n");
          process.exit(1);
        }
      } else if (type == Instr.Ret) {
        ip = returnStack.pop()!;
      } else if (type == Instr.Jmp) {
        ip = instr[1] as number;
      } else if (type == Instr.JmpIfNot) {
        if (!stack.pop()) ip = instr[1] as number;
      } else if (type == Instr.Add) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs + rhs);
      } else if (type == Instr.Sub) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs - rhs);
      } else if (type == Instr.Mul || type == Instr.IMul) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs * rhs);
      } else if (type == Instr.DivMod || type == Instr.IDivMod) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs / rhs, lhs % rhs);
      } else if (type == Instr.Shl) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs << rhs);
      } else if (type == Instr.Shr) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs >> rhs);
      } else if (type == Instr.Not) {
        stack.push(~(stack.pop()!));
      } else if (type == Instr.Or) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs | rhs);
      } else if (type == Instr.And) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs & rhs);
      } else if (type == Instr.Xor) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs ^ rhs);
      } else if (type == Instr.Lt) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs < rhs));
      } else if (type == Instr.Eq) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs == rhs));
      } else if (type == Instr.Gt) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(BigInt(lhs > rhs));
      } else if (type == Instr.Dup) {
        const a = stack.pop()!;
        stack.push(a, a);
      } else if (type == Instr.Drop) {
        stack.pop();
      } else if (type == Instr.Swap) {
        stack.push(stack.pop()!, stack.pop()!);
      } else if (type == Instr.Rot) {
        const a = stack.pop()!, b = stack.pop()!, c = stack.pop()!;
        stack.push(b, a, c);
      } else if (type == Instr.Dup2) {
        const a = stack.pop()!, b = stack.pop()!;
        stack.push(b, a, b, a);
      } else if (type == Instr.Over) {
        stack.push(stack.at(-2)!);
      } else if (type == Instr.Swap2) {
        stack.push(stack.pop()!, stack.pop()!, stack.pop()!, stack.pop()!);
      } else if (type == Instr.Write8) {
        this.memory[Number(stack.pop()!)] = Number(stack.pop()!);
      } else if (type == Instr.Read8) {
        stack.push(BigInt(this.memory[Number(stack.pop()!)]));
      } else if (type == Instr.Write16) {
        this.writeInt(2, Number(stack.pop()!), stack.pop()!);
      } else if (type == Instr.Read16) {
        stack.push(this.readInt(2, Number(stack.pop()!)));
      } else if (type == Instr.Write32) {
        this.writeInt(4, Number(stack.pop()!), stack.pop()!);
      } else if (type == Instr.Read32) {
        stack.push(this.readInt(4, Number(stack.pop()!)));
      } else if (type == Instr.Write64) {
        this.writeInt(8, Number(stack.pop()!), stack.pop()!);
      } else if (type == Instr.Read64) {
        stack.push(this.readInt(8, Number(stack.pop()!)));
      } else if (type == Instr.Print) {
        process.stdout.write(stack.pop()!.toString() + "\n");
      } else if (type == Instr.Puts) {
        const ptr = Number(stack.pop()!);
        const size = Number(stack.pop()!);

        process.stdout.write(this.memory.subarray(ptr, ptr + size));
      } else if (type == Instr.Halt) {
        process.exit(instr[1] as number);
      } else if (type != Instr.Nop) {
        throw new Error(`Invalid instrction ${Instr[type]} (${type})`);
      }
    }
  }

  private writeInt(size: number, addr: number, value: bigint) {
    for (let i = 0n, s = BigInt(size) - 1n; i < size; i++)
      this.memory[addr] = Number(value >> (8n * (s - i))) & 0xFF;
  }

  private readInt(size: number, addr: number): bigint {
    let value = 0n;
    for (let i = 0, s = size - 1; i < size; i++)
      value |= BigInt(this.memory[addr + i] << (8 * (s - i)));
    return value;
  }
}