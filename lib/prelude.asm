;; The core functionality of stck.
;; Automatically included by the compiler.

segment readable executable

_start:
  mov [datastack_start], rsp
  mov rbp, rsp
  mov rsp, callstack_end
  jmp __proc_0

macro swap_reg a,b {
  mov rax, a
  mov a, b
  mov b, rax
}

macro call_proc id {
  cmp rbp, callstack
  jnge stack_overflow
  swap_reg rsp, rbp
  call id
  swap_reg rsp, rbp
}

macro ret_call_proc id {
  swap_reg rsp, rbp
  jmp id
}

macro push64 int {
  mov rax, int
  push rax
}

macro jmpifnot Lb {
  pop rax
  test rax, rax
  jz Lb
}

macro bind_local i {
  pop rax
  mov [rbp+i], rax
}

; Intrinsics
;; Math
  macro __i_pop_infix {
    pop rbx
    pop rax
  }

  macro __i_infix op {
    __i_pop_infix
    op rax, rbx
    push rax
  }

  macro intrinsic_add { __i_infix add  }
  macro intrinsic_sub { __i_infix sub  }

  macro intrinsic_mul  {
    __i_pop_infix
    mul rbx
    push rax
  }

  macro intrinsic_imul {
    __i_pop_infix
    imul rbx
    push rax
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

;; Bitwise
  macro intrinsic_or  { __i_infix or  }
  macro intrinsic_and { __i_infix and }
  macro intrinsic_xor { __i_infix xor }
  macro intrinsic_shl {
    pop rcx
    pop rbx
    shl rbx, cl
    push rbx
  }

  macro intrinsic_shr {
    pop rcx
    pop rbx
    shr rbx, cl
    push rbx
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
    pop rax
    pop rbx
    push rax
    push rbx
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
  macro __i_write _reg {
    pop rax
    pop rbx
    mov [rax], _reg
  }

  macro __i_read _reg {
    pop rax
    xor rbx, rbx
    mov _reg, [rax]
    push rbx
  }

  macro intrinsic_write8  { __i_write bl  }
  macro intrinsic_write16 { __i_write bx  }
  macro intrinsic_write32 { __i_write ebx }
  macro intrinsic_write64 { __i_write rbx }

  macro intrinsic_read8  { __i_read bl  }
  macro intrinsic_read16 { __i_read bx  }
  macro intrinsic_read32 { __i_read ebx }
  macro intrinsic_read64 {
    pop rax
    ; no need for `xor`
    mov rbx, [rax]
    push rbx
  }
;; Misc
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

  macro intrinsic_dumpstack {
    call dump_data_stack
  }

; Builtins
;; Prints a signed integer from rdi
print:
  sub rsp, 40
  mov rax, rdi
  mov rcx, rdi
  mov r11, rdi
  neg rax
  mov BYTE [rsp+31], 10
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
  mov BYTE [r8+1], al
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
  mov BYTE [rsp+rax], 45
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
;; Outputs the current data stack
dump_data_stack:
  ; note: r12 and r13 are used because print modifies other scratch registers
  mov r12, [datastack_start]
  mov r13, rsp
  add r13, 8
  .L2:
    mov rdi, [r13]
    call print
    add r13, 8
  cmp r12, r13
  jg .L2
  ret
;; This will get called when the stack has overflowed
stack_overflow:
  mov rax, 1
  mov rdi, 2
  mov rsi, stack_overflow_msg
  mov rdx, stack_overflow_msg_size
  syscall
  mov rax, 60
  mov rdi, 1
  syscall

segment readable writeable
  datastack_start: rq 1
  callstack:       rb 640000
  callstack_end:

  stack_overflow_msg:       db '[RUNTIME ERROR] Stack overflow', 10
  stack_overflow_msg_size = $ - stack_overflow_msg
