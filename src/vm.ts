import { ByteCode, Instr, Instruction } from "./shared/instruction";

// TODO: Temporary virtual machine; will be rewritten in Rust

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
    const stack: number[] = [];
    const returnStack: number[] = [];

    while (true) {
      const instr = instructions[ip++];
      const type = instr[0];

      if (type == Instr.Push) {
        stack.push(instr[1]);
      } else if (type == Instr.Call) {
        returnStack.push(ip);
        ip = instr[1];

        if (returnStack.length > 4096) {
          throw "Maximum call stack size exceeded";
        }
      } else if (type == Instr.Ret) {
        ip = returnStack.pop()!;
      } else if (type == Instr.Jmp) {
        ip = instr[1];
      } else if (type == Instr.JmpIfNot) {
        if (!stack.pop()) ip = instr[1];
      } else if (type == Instr.Add) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs + rhs);
      } else if (type == Instr.Sub) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs - rhs);
      } else if (type == Instr.Mul) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs * rhs);
      } else if (type == Instr.DivMod) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(Math.floor(lhs / rhs), lhs % rhs);
      } else if (type == Instr.Shl) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs << rhs);
      } else if (type == Instr.Shr) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(lhs >> rhs);
      } else if (type == Instr.Not) {
        stack.push(~stack.pop()!);
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
        stack.push(Number(lhs < rhs));
      } else if (type == Instr.Eq) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(Number(lhs == rhs));
      } else if (type == Instr.Gt) {
        const rhs = stack.pop()!, lhs = stack.pop()!;
        stack.push(Number(lhs > rhs));
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
      } else if (type == Instr.Write) {
        this.memory[stack.pop()!] = stack.pop()!;
      } else if (type == Instr.Read) {
        stack.push(this.memory[stack.pop()!]);
      } else if (type == Instr.Putch) {
        process.stdout.write(String.fromCharCode(stack.pop()!));
      } else if (type == Instr.Putu) {
        process.stdout.write(stack.pop()!.toString());
      } else if (type == Instr.Print) {
        process.stdout.write(stack.pop()!.toString() + "\n");
      } else if (type == Instr.Puts) {
        const ptr = stack.pop()!;
        const size = stack.pop()!;

        process.stdout.write(this.memory.subarray(ptr, ptr + size));
      } else if (type == Instr.Halt) {
        process.exit(instr[1]);
      } else if (type != Instr.Nop) {
        throw new Error(`Invalid instrction ${Instr[type]} (${type})`);
      }
    }
  }
}