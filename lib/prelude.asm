;; The core functionality of stck.
;; Automatically included by the compiler.

section '.text' executable
public main

cs_ptr   equ r14 ; callstack pointer
ds_ptr   equ r15 ; datastack pointer
ds_start equ rbp ; pointer to the start of the data stack

main:
  ; allocate 100KB for the call stack
  mov ds_ptr, rsp
  sub ds_ptr, 100000
  mov ds_start, ds_ptr

  call __proc_0

  ; the exit code should be stored as the integer on top of the stack
  mov rax, [ds_ptr]
  ret

macro switch_to_datastack {
  mov cs_ptr, rsp
  mov rsp, ds_ptr
}

macro switch_to_callstack {
  mov ds_ptr, rsp
  mov rsp, cs_ptr
}

macro call_proc id {
  switch_to_callstack
  check_callstack_overflow
  call id
  switch_to_datastack
}

; stop execution if the call stack pointer overflowed to the data stack
macro check_callstack_overflow {
  cmp rsp, ds_start
  jnge stack_overflow
}

; Used for tail call optimization
macro ret_call_proc id {
  switch_to_callstack
  jmp id
}

; push does not allow imm64, so we need to use a register instead
macro push64 int {
  mov rax, int
  push rax
}

macro jmpifnot Lb {
  pop rax
  test rax, rax
  jz Lb
}

; Intrinsics
;; Math
macro __i_pop_infix {
  pop rbx
  pop rax
}

macro __i_infix op {
  pop rbx
  op qword [rsp], rbx
}

macro intrinsic_add { __i_infix add  }
macro intrinsic_sub { __i_infix sub  }
macro intrinsic_neg {
  neg qword [rsp]
}

macro intrinsic_mul  {
  pop rax
  mul qword [rsp]
  mov qword [rsp], rax
}

macro intrinsic_imul {
  pop rax
  imul qword [rsp]
  mov qword [rsp], rax
}

macro intrinsic_div {
  __i_pop_infix
  xor rdx, rdx
  div rbx
  push rax
}

macro intrinsic_mod {
  __i_pop_infix
  xor rdx, rdx
  div rbx
  push rdx
}

macro intrinsic_divmod {
  __i_pop_infix
  xor rdx, rdx
  div rbx
  push rax
  push rdx
}

macro intrinsic_idiv {
  __i_pop_infix
  xor rdx, rdx
  idiv rbx
  push rax
}

macro intrinsic_imod {
  __i_pop_infix
  xor rdx, rdx
  idiv rbx
  push rdx
}

macro intrinsic_idivmod {
  __i_pop_infix
  xor rdx, rdx
  idiv rbx
  push rax
  push rdx
}

macro intrinsic_min {
  __i_pop_infix
  cmp rax, rbx
  cmovg rax, rbx
  push rax
}

macro intrinsic_max {
  __i_pop_infix
  cmp rax, rbx
  cmovl rax, rbx
  push rax
}

;; Bitwise
macro intrinsic_or  { __i_infix or  }
macro intrinsic_and { __i_infix and }
macro intrinsic_xor { __i_infix xor }

macro intrinsic_shl {
  pop rcx
  shl qword [rsp], cl
}

macro intrinsic_shr {
  pop rcx
  shr qword [rsp], cl
}

macro intrinsic_not {
  not qword [rsp]
}

;; Comparison
macro __i_cmp {
  pop rbx
  pop rax
  cmp rax, rbx
}

macro __i_cmp_set t {
  set#t al
  movzx rax, al
  push rax
}

macro intrinsic_eq {
  __i_cmp
  __i_cmp_set e
}

macro intrinsic_neq {
  __i_cmp
  __i_cmp_set ne
}

macro intrinsic_lt {
  __i_cmp
  __i_cmp_set l
}

macro intrinsic_gt {
  __i_cmp
  __i_cmp_set g
}

macro intrinsic_lteq {
  __i_cmp
  __i_cmp_set le
}

macro intrinsic_gteq {
  __i_cmp
  __i_cmp_set ge
}

;; Stack
macro intrinsic_dup  { push qword [rsp] }
macro intrinsic_over { push qword [rsp+8] }

macro intrinsic_swap {
  mov rax, [rsp]
  mov rbx, [rsp+8]
  mov [rsp], rbx
  mov [rsp+8], rax
}

macro intrinsic_rot {
  pop rax
  pop rbx
  pop rcx
  push rbx
  push rax
  push rcx
}

;; Memory
macro _write_mem _reg {
  mov rax, [rsp]
  mov rbx, [rsp+8]
  mov [rax], _reg
  add rsp, 16
}

macro _read_mem _reg {
  mov rax, [rsp]
  xor rbx, rbx
  mov _reg, [rax]
  mov [rsp], rbx
}

macro intrinsic_write8  { _write_mem bl  }
macro intrinsic_write16 { _write_mem bx  }
macro intrinsic_write32 { _write_mem ebx }
macro intrinsic_write64 { _write_mem rbx }

macro intrinsic_read8  { _read_mem bl  }
macro intrinsic_read16 { _read_mem bx  }
macro intrinsic_read32 { _read_mem ebx }
macro intrinsic_read64 {
  mov rax, [rsp]
  mov rax, [rax]
  mov [rsp], rax
}

;; Program
macro intrinsic_print {
  pop rdi
  call print
}

macro intrinsic_puts {
  mov rax, 1
  mov rdi, 1
  pop rsi
  pop rdx
  syscall
}

macro intrinsic_getargv {
  push qword [ds_start-8]
}

macro intrinsic_getargc {
  push qword [ds_start-16]
}

macro intrinsic_offset {
  pop rax
  push qword [counter]
  add qword [counter], rax
}

macro intrinsic_reset {
  push qword [counter]
  mov qword [counter], 0
}

macro intrinsic_dumpstack {
  mov rax, 1
  mov rdi, 2
  mov rsi, ds_msg
  mov rdx, ds_msg_len
  syscall

  mov r12, ds_start
  mov r13, rsp
  local .L2
  .L2:
    mov rdi, [r13]
    call print
    add r13, 8
  cmp r12, r13
  jg .L2
}

; Misc
;; Prints a signed 64-bit integer from rdi
print:
  sub rsp, 40
  mov rax, rdi
  mov rcx, rdi
  mov r11, rdi
  neg rax
  mov byte [rsp+31], 10
  lea r8, [rsp+30]
  mov edi, 1
  mov r9, -3689348814741910323
  cmovns rcx, rax
  .L3:
  mov rax, rcx
  mov r10d, edi
  sub r8, 1
  mul r9
  mov rax, rcx
  add edi, 1
  shr rdx, 3
  lea rsi, [rdx+rdx*4]
  add rsi, rsi
  sub rax, rsi
  add eax, 48
  mov byte [r8+1], al
  mov rax, rcx
  mov rcx, rdx
  cmp rax, 9
  ja .L3
  test r11, r11
  jns .L4
  mov eax, 31
  sub eax, edi
  lea edi, [r10+2]
  cdqe
  mov byte [rsp+rax], 45
  .L4:
  mov eax, 32
  mov edx, edi
  sub eax, edi
  mov edi, 1
  cdqe
  lea rsi, [rsp+rax]
  xor eax, eax
  mov rax, 1
  syscall
  add rsp, 40
  ret
;; This gets called if the stack overflows
stack_overflow:
  mov rax, 1
  mov rdi, 2
  mov rsi, so_msg
  mov rdx, so_msg_len
  syscall
  mov rax, 60
  mov rdi, 1
  syscall

section '.data' writeable
  counter: rq 1

  ds_msg:      db '[STCK] Stack:', 10
  ds_msg_len = $ - ds_msg

  so_msg:      db '[STCK] Stack overflow', 10
  so_msg_len = $ - so_msg
