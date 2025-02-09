import type { IRProgram } from "../compiler/ir";
import { Instr, Instruction } from "../shared";
import { ROOT_DIR } from "../index";
import plib from "path";

const isPushInstr = (instr: Instr) => (
  instr == Instr.Push
  || instr == Instr.PushBigInt
  || instr == Instr.PushAddr
  || instr == Instr.PushStr
  || instr == Instr.PushLocal
);

// TODO: Another compilation step before codegen to optimize stuff

function codegenProc(id: number, instructions: Instruction[], out: string[]) {
  let lastInstr: Instruction = { kind: Instr.Nop };

  out.push(
    `__proc_${id}:`,
    "switch_to_datastack"
  );

  if (id == 0) {
    // push argv and argc for the main procedure
    out.push("push rsi");
    out.push("push rdi");
  }

  for (const instr of instructions) {
    if (instr.kind == Instr.Ret) {
      if (lastInstr.kind == Instr.Call) {
        out.pop();
        out.push(`ret_call_proc __proc_${lastInstr.id}`);
      } else {
        out.push("switch_to_callstack");
        out.push("ret");
      }
    } else if (instr.kind == Instr.Halt) {
      out.push("mov rax, 60");
      out.push(`mov rdi, ${instr.code ?? "[rsp]"}`);
      out.push("syscall");
    } else if (instr.kind == Instr.Call) {
      out.push(`call_proc __proc_${instr.id}`);
    } else if (instr.kind == Instr.Label) {
      out.push(`.L${instr.label}:`);
    } else if (instr.kind == Instr.Nop) {
      out.push("nop");
    } else if (instr.kind == Instr.Push) {
      out.push(`push ${instr.size} ${instr.value}`);
    } else if (instr.kind == Instr.PushBigInt) {
      out.push(`push64 ${instr.value}`);
    } else if (instr.kind == Instr.PushStr) {
      // C-strings have .len set to -1
      if (instr.len != -1) out.push(`push ${instr.len}`);
      out.push(`push str${instr.id}`);
    } else if (instr.kind == Instr.AsmBlock) {
      out.push(instr.value.trim());
    } else if (instr.kind == Instr.PushAddr) {
      out.push(`push mem+${instr.offset}`);
    } else if (instr.kind == Instr.PushLocal) {
      out.push(`push qword [cs_ptr+${instr.offset}]`)
    } else if (instr.kind == Instr.PushLocalAddr) {
      out.push(`lea rax, [cs_ptr+${instr.offset}]`);
      out.push("push rax");
    } else if (instr.kind == Instr.Bind) {
      out.push(`sub cs_ptr, ${8 * instr.count}`);
      for (let i = instr.count - 1; i >= 0; i--) {
        out.push(`pop qword [cs_ptr+${i * 8}]`);
      }
    } else if (instr.kind == Instr.Alloc) {
      out.push(`sub cs_ptr, ${instr.size}`);
    } else if (instr.kind == Instr.Dealloc) {
      out.push(`add cs_ptr, ${instr.size}`);
    } else if (instr.kind == Instr.Jmp) {
      out.push(`jmp .L${instr.label}`);
    } else if (instr.kind == Instr.JmpIfNot) {
      if (
        lastInstr.kind >= Instr.Eq
        && lastInstr.kind <= Instr.GtEq
      ) {
        out.pop();
        out.push("__i_cmp");
        out.push(`${
          lastInstr.kind == Instr.Eq ? "jne"
          : lastInstr.kind == Instr.Neq ? "je"
          : lastInstr.kind == Instr.Lt ? "jnl"
          : lastInstr.kind == Instr.Gt ? "jng"
          : lastInstr.kind == Instr.LtEq ? "jnle"
          : lastInstr.kind == Instr.GtEq ? "jnge"
          : null
        } .L${instr.label}`);
      } else if (lastInstr.kind == Instr.Push && lastInstr.value) {
        out.pop();
      } else {
        out.push(`jmpifnot .L${instr.label}`);
      }
    } else if (instr.kind == Instr.Dup) {
      if (isPushInstr(lastInstr.kind)) {
        const ins = out.pop()!;
        out.push(ins, ins);
      } else {
        out.push("intrinsic_dup");
      }
    } else if (instr.kind == Instr.Drop) {
      if (isPushInstr(lastInstr.kind)) {
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
      if (lastInstr.kind == Instr.Swap) out.pop();
      else out.push("intrinsic_swap");
    } else if (instr.kind == Instr.CallExtern) {
      const registers = ["rdi", "rsi", "rdx", "rcx", "r8", "r9"];
      for (let i = 0; i < instr.argc && i < 6; i++) {
        out.push(`mov ${registers[i]}, [rsp+${(i) * 8}]`);
      }

      out.push(
        "mov ds_ptr, rsp",
        "and rsp, -15"
      );

      // not sure if this works
      // upd: it fucking does
      if (instr.argc > 6) {
        if (instr.argc % 2) out.push(`sub rsp, 8`);
        for (let i = instr.argc - 1; i >= 6; i--) {
          out.push(`push qword [ds_ptr+${(i) * 8}]`);
        }
      }

      out.push(`call _extern_${instr.name}`);
      out.push("mov rsp, ds_ptr");

      if (instr.hasOutput) {
        out.push(`add rsp, ${instr.argc * 8 - 8}`);
        out.push(`mov [rsp], rax`);
      } else {
        out.push(`add rsp, ${instr.argc * 8}`);
      }
    } else {
      out.push(`intrinsic_${Instr[instr.kind].toLowerCase()}`);
    }

    lastInstr = instr;
  }
}

export function codegenFasm(prog: IRProgram): string[] {
  const out = [
    "; Compiled with STCK\n",
    "format ELF64",
  ];

  for (const extern of prog.extern) {
    out.push(`extrn '${extern}' as _extern_${extern}`);
  }

  out.push(`include "${plib.join(ROOT_DIR, "lib/prelude.asm")}"`);
  out.push("section '.text' executable\n");

  for (const [id, instr] of prog.procs) {
    codegenProc(id, instr, out);
  }

  out.push("section '.data' writeable");
  if (prog.memorySize) {
    out.push(`mem rb ${prog.memorySize}`);
  }

  const encoder = new TextEncoder();
  for (let i = 0; i < prog.strings.length; i++) {
    out.push(`str${i} db ${encoder.encode(prog.strings[i]).join(",") || "''"}`);
  }

  return out;
}