import { Instr, Instruction } from "../shared";
import { IRProgram } from "./ir";
import { ROOT_DIR } from "..";
import plib from "path";

function formatStr(str: string): string {
  const parts: (string | number)[] = [];
  let part = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch < 0x20 || ch == 0x27 || ch == 0xAD || (ch >= 0x7F && ch <= 0xA0)) {
      if (part) {
        parts.push(`'${part}'`);
        part = "";
      }
      parts.push(ch);
    } else {
      part += String.fromCharCode(ch);
    }
  }

  if (part) parts.push(`'${part}'`);

  return parts.join(",");
}

export function codegenFasm(prog: IRProgram): string[] {
  const out: string[] = [];

  out.push(
    ";; Compiled with stck v0.1.0\n",
    "format ELF64 executable 3",
    `include "${plib.join(ROOT_DIR, "lib/prelude.asm")}"`,
    ""
  );

  out.push("segment readable executable");

  const pushIdent = (s: string) => out.push("\t" + s);
  let lastInstr: Instruction = null as any;
  let currentProc: number = -1;

  for (const instr of prog.instr) {
    if (instr.kind == Instr.EnterProc) {
      out.push(`__proc_${instr.id}: ; ${instr.name}`);
      pushIdent("swap_reg rsp,rbp");
      currentProc = instr.id;
    } else if (instr.kind == Instr.Ret) {
      if (currentProc == 0) {
        pushIdent("mov rax, 60");
        pushIdent("mov rdi, 0");
        pushIdent("syscall");
      } else if (lastInstr.kind == Instr.Call) {
        out.pop();
        pushIdent(`ret_call_proc __proc_${lastInstr.id}`);
      } else {
        pushIdent("swap_reg rsp,rbp");
        pushIdent("ret");
      }
    } else if (instr.kind == Instr.Call) {
      pushIdent(`call_proc __proc_${instr.id}`);
    } else if (instr.kind == Instr.Label) {
      pushIdent(`.L${instr.label}:`);
    } else if (instr.kind == Instr.Nop) {
      pushIdent("nop");
    } else if (instr.kind == Instr.Push) {
      pushIdent(`push ${instr.value}`);
    } else if (instr.kind == Instr.Push64) {
      pushIdent(`push64 ${instr.value}`);
    } else if (instr.kind == Instr.PushStr) {
      if (instr.len > 0) {
        pushIdent(`push ${instr.len}`);
      }
      pushIdent(`push str${instr.id}`);
    } else if (instr.kind == Instr.PushMem) {
      pushIdent(`push mem+${instr.offset}`);
    } else if (instr.kind == Instr.AsmBlock) {
      for (const line of instr.value.split("\n")) {
        if (line)
        out.push("\t" + line);
      }
    } else if (instr.kind == Instr.PushLocal) {
      pushIdent(`push qword [rbp+${instr.offset}]`)
    } else if (instr.kind == Instr.Bind) {
      pushIdent(`sub rbp, ${8 * instr.count}`);
      for (let i = instr.count - 1; i >= 0; i--) {
        pushIdent(`bind_local ${i * 8}`);
      }
    } else if (instr.kind == Instr.Unbind) {
      pushIdent(`add rbp, ${8 * instr.count}`);
    } else if (instr.kind == Instr.Jmp) {
      pushIdent(`jmp .L${instr.label}`);
    } else if (instr.kind == Instr.JmpIfNot) {
      // NOTE: All comprasion operations must be grouped together for this to work properly
      if (
        lastInstr.kind >= Instr.Eq
        && lastInstr.kind <= Instr.GtEq
      ) {
        out.pop();
        pushIdent("__i_cmp");
        pushIdent(`${
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
        pushIdent(`jmpifnot .L${instr.label}`);
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
        pushIdent("intrinsic_dup");
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
      } else {
        pushIdent("add rsp, 8");
      }
    } else if (instr.kind == Instr.Swap) {
      if (lastInstr.kind == Instr.Swap) {
        out.pop();
      } else {
        pushIdent("intrinsic_swap");
      }
    } else if (instr.kind == Instr._CExpr__Offset || instr.kind == Instr._CExpr__Reset) {
      throw new Error(`Invalid instruction ${Instr[instr.kind]}`);
    } else {
      pushIdent(`intrinsic_${Instr[instr.kind].toLowerCase()}`);
    }

    lastInstr = instr;
  }

  out.push("");
  out.push("segment readable writeable");

  if (prog.memorySize) {
    pushIdent(`mem rb ${prog.memorySize}`);
  }

  for (let i = 0; i < prog.strings.length; i++) {
    pushIdent(`str${i} db ${formatStr(prog.strings[i])}`);
  }

  return out;
}