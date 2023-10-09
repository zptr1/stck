import type { IRProgram } from "../compiler/ir";
import { Instr, Instruction } from "../shared";
import { ROOT_DIR } from "..";
import plib from "path";

// TODO: Make these functions generators, although this would also require changing how optimizations work
// TODO: Maybe introduce more IR instructions and add an optimization stage that would generate an optimized list of instructions

function codegenProc(id: number, instructions: Instruction[], out: string[]) {
  let lastInstr: Instruction = { kind: Instr.Nop };
  out.push(`__proc_${id}:`);
  out.push("swap_reg rsp,rbp");

  for (const instr of instructions) {
    if (instr.kind == Instr.Ret) {
      if (id == 0) {
        out.push("mov rax, 60");
        out.push("mov rdi, 0");
        out.push("syscall");
      } else if (lastInstr.kind == Instr.Call) {
        out.pop();
        out.push(`ret_call_proc __proc_${lastInstr.id}`);
      } else {
        out.push("swap_reg rsp,rbp");
        out.push("ret");
      }
    } else if (instr.kind == Instr.Call) {
      out.push(`call_proc __proc_${instr.id}`);
    } else if (instr.kind == Instr.Label) {
      out.push(`.L${instr.label}:`);
    } else if (instr.kind == Instr.Nop) {
      out.push("nop");
    } else if (instr.kind == Instr.Push) {
      out.push(`push ${instr.value}`);
    } else if (instr.kind == Instr.Push64) {
      out.push(`push64 ${instr.value}`);
    } else if (instr.kind == Instr.PushStr) {
      if (instr.len != -1) // not a C-string
        out.push(`push ${instr.len}`);
      out.push(`push str${instr.id}`);
    } else if (instr.kind == Instr.PushMem) {
      out.push(`push mem+${instr.offset}`);
    } else if (instr.kind == Instr.AsmBlock) {
      out.push(instr.value.trim());
    } else if (instr.kind == Instr.PushLocal) {
      out.push(`push qword [rbp+${instr.offset}]`)
    } else if (instr.kind == Instr.Bind) {
      out.push(`sub rbp, ${8 * instr.count}`);
      for (let i = instr.count - 1; i >= 0; i--) {
        out.push(`pop qword [rbp+${i * 8}]`);
      }
    } else if (instr.kind == Instr.Unbind) {
      out.push(`add rbp, ${8 * instr.count}`);
    } else if (instr.kind == Instr.Jmp) {
      out.push(`jmp .L${instr.label}`);
    } else if (instr.kind == Instr.JmpIfNot) {
      // NOTE: All comprasion operations must be grouped together,
      //       starting with Eq and ending with GtEq
      if (
        lastInstr.kind >= Instr.Eq
        && lastInstr.kind <= Instr.GtEq
      ) {
        out.pop();
        out.push("__i_cmp");
        out.push(`${
          lastInstr.kind == Instr.Eq
            ? "jne"
          : lastInstr.kind == Instr.Neq
            ? "je"
          : lastInstr.kind == Instr.Lt
            ? "jnl"
          : lastInstr.kind == Instr.Gt
            ? "jng"
          : lastInstr.kind == Instr.LtEq
            ? "jnle"
          : lastInstr.kind == Instr.GtEq
            ? "jnge"
          : null
        } .L${instr.label}`);
      } else {
        out.push(`jmpifnot .L${instr.label}`);
      }
    } else if (instr.kind == Instr.Dup) {
      if (
        lastInstr.kind == Instr.Push
        || lastInstr.kind == Instr.Push64
        || lastInstr.kind == Instr.PushMem
        || lastInstr.kind == Instr.PushStr
      ) {
        const ins = out.pop()!;
        out.push(ins, ins);
      } else {
        out.push("intrinsic_dup");
      }
    } else if (instr.kind == Instr.Drop) {
      if (
        lastInstr.kind == Instr.Push
        || lastInstr.kind == Instr.Push64
        || lastInstr.kind == Instr.PushMem
        || lastInstr.kind == Instr.PushStr
        || lastInstr.kind == Instr.PushLocal
      ) {
        out.pop();
      } else if (
        lastInstr.kind == Instr.Swap
      ) {
        out.pop();
        out.push("pop rax");
        out.push("add rsp, 8");
        out.push("push rax");
      } else {
        out.push("add rsp, 8");
      }
    } else if (instr.kind == Instr.Swap) {
      if (lastInstr.kind == Instr.Swap) {
        out.pop();
      } else {
        out.push("intrinsic_swap");
      }
    } else if (instr.kind == Instr._CExpr__Offset || instr.kind == Instr._CExpr__Reset) {
      throw new Error(`Invalid instruction ${Instr[instr.kind]}`);
    } else {
      out.push(`intrinsic_${Instr[instr.kind].toLowerCase()}`);
    }

    lastInstr = instr;
  }
}

export function codegenFasm(prog: IRProgram): string[] {
  const out: string[] = [
    ";; Compiled with STCK\n",
    "format ELF64 executable 3",
    `include "${plib.join(ROOT_DIR, "lib/prelude.asm")}"`
  ];

  out.push("segment readable executable\n");

  for (const [id, instr] of prog.procs) {
    codegenProc(id, instr, out);
  }

  out.push("segment readable writeable");
  if (prog.memorySize) {
    out.push(`mem rb ${prog.memorySize}`);
  }

  for (let i = 0; i < prog.strings.length; i++) {
    out.push(`str${i} db ${prog.strings[i].split("").map((x) => x.charCodeAt(0)).join(",") || "''"}`);
  }

  return out;
}