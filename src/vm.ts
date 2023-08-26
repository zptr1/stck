import { ByteCode, Instr, Instruction } from "./shared/instruction";
import { writeSync } from "fs";

// TODO: Temporary virtual machine; will be rewritten in Rust

export class VM {
  public readonly memory: Buffer;

  constructor(
    bytecode: ByteCode
  ) {
    this.memory = Buffer.alloc(bytecode.memorySize);

    this.loadStrings(bytecode.text);
    bytecode.text = [];

    this.run(bytecode.instr);
  }

  private loadStrings(strings: string[]) {
    let addr = 0;
    for (const str of strings) {
      this.memory.write(str, addr, "utf-8");
      addr += str.length;
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