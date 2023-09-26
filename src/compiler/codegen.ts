import { Instr, Instruction } from "../shared";
import { IRProgram } from "./ir";
import { ROOT_DIR } from "..";
import plib from "path";

function normalizeWord(word: string): string {
  let n = "";
  for (let i = 0; i < word.length; i++) {
    const ch = word.charCodeAt(i);

    // ch='0'..='9' || ch='A'..='Z' || ch='a'..='z'
    if (
      (ch >= 0x30 && ch <= 0x39)
      || (ch >= 0x41 && ch <= 0x5A)
      || (ch >= 0x61 && ch <= 0x7A)
    ) {
      n += String.fromCharCode(ch);
    } else {
      n += "_";
    }
  }

  return n;
}

/** Encodes a string to a format like "'Hello World',10" for assembly */
function strEncodeAsm(str: string): string {
  const parts: (string | number)[] = [];
  let part = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch < 0x20 || ch == 0xAD || (ch >= 0x7F && ch <= 0xA0)) {
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
  let currentProc: string = "";

  for (const instr of prog.instr) {
    if (instr.kind == Instr.EnterProc) {
      // TODO: normalizeWord repalces any invalid characters with underscores, which could result in duplicate label names
      //       either make it add an increment in case of a duplicate,
      //       or just use an increment like it did previouly (e. g. 'proc_0')
      out.push(`__proc_${normalizeWord(instr.name)}:`);
      pushIdent("_swap rsp,rbp");
      currentProc = instr.name;
    } else if (instr.kind == Instr.Ret) {
      if (currentProc == "main") {
        pushIdent("mov rax, 60");
        pushIdent("mov rdi, 0");
        pushIdent("syscall");
      } else if (lastInstr.kind == Instr.Call) {
        out.pop();
        pushIdent(`_ret_callp __proc_${normalizeWord(lastInstr.name)}`);
      } else {
        pushIdent("_swap rsp,rbp");
        pushIdent("ret");
      }
    } else if (instr.kind == Instr.Call) {
      pushIdent(`_callp __proc_${normalizeWord(instr.name)}`);
    } else if (instr.kind == Instr.Label) {
      pushIdent(`.L${instr.label}:`);
    } else if (instr.kind == Instr.Nop) {
      pushIdent("nop");
    } else if (instr.kind == Instr.Push) {
      pushIdent(`push ${instr.value}`);
    } else if (instr.kind == Instr.Push64) {
      pushIdent(`mov rax,${instr.value}`);
      pushIdent(`push rax`);
    } else if (instr.kind == Instr.PushStr) {
      if (instr.len > 0) {
        pushIdent(`push ${instr.len}`);
      }
      pushIdent(`push str${instr.id}`);
    } else if (instr.kind == Instr.PushMem) {
      pushIdent(`push mem+${instr.offset}`);
    } else if (instr.kind == Instr.AsmBlock) {
      for (const line of instr.value.split("\n")) {
        out.push("\t" + line);
      }
    } else if (instr.kind == Instr.PushLocal) {
      pushIdent(`push qword [rbp+${instr.offset}]`)
    } else if (instr.kind == Instr.Bind) {
      pushIdent(`sub rbp, ${8 * instr.count}`);
      for (let i = instr.count - 1; i >= 0; i--) {
        pushIdent(` _c_bind ${i * 8}`);
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
        pushIdent(`_c_jmpifnot .L${instr.label}`);
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
        pushIdent("_i_dup");
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
        pushIdent("_i_swap");
      }
    } else if (instr.kind == Instr._CExpr__Offset || instr.kind == Instr._CExpr__Reset) {
      throw new Error(`Invalid instruction ${Instr[instr.kind]}`);
    } else {
      pushIdent(`_i_${Instr[instr.kind].toLowerCase()}`);
    }

    lastInstr = instr;
  }

  out.push("");
  out.push("segment readable writeable");

  if (prog.memorySize) {
    pushIdent(`mem rb ${prog.memorySize}`);
  }

  for (const [str, id] of prog.strings) {
    pushIdent(`str${id} db ${strEncodeAsm(str)}`);
  }

  return out;
}