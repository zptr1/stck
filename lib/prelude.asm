;; The core functionality of stck.
;; Automatically included by the compiler.

segment readable executable

_start:
  mov rbp, rsp
  mov rsp, callstack_end
  jmp __proc_main

macro _swap a,b {
  mov rax, a
  mov a, b
  mov b, rax
}

macro _callp id {
  cmp rbp, callstack
  jnge stack_overflow
  _swap rsp, rbp
  call id
  _swap rsp, rbp
}

macro _ret_callp id {
  _swap rsp, rbp
  jmp id
}

; Control Flow
  macro _c_jmpifnot Lb {
    pop rax
    test rax, rax
    jz Lb
  }

  macro _c_bind i {
    pop rax
    mov [rbp+i], rax
  }
; Intrinsics
;; Math
  macro __i_infix op {
    pop rbx
    pop rax
    op rax, rbx
    push rax
  }

  macro _i_add  { __i_infix add  }
  macro _i_sub  { __i_infix sub  }
  macro _i_mul  { __i_infix mul  }
  macro _i_imul { __i_infix imul }

  macro _i_divmod {
    pop rbx
    pop rax
    xor rdx, rdx
    div rbx
    push rax
    push rdx
  }

  macro _i_idivmod {
    pop rbx
    pop rax
    xor rdx, rdx
    idiv rbx
    push rax
    push rdx
  }

;; Bitwise
  macro _i_or  { __i_infix or  }
  macro _i_and { __i_infix and }
  macro _i_xor { __i_infix xor }
  macro _i_shl {
    pop rcx
    pop rbx
    shl rbx, cl
    push rbx
  }

  macro _i_shr {
    pop rcx
    pop rbx
    shr rbx, cl
    push rbx
  }

  macro _i_not {
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

  macro _i_eq {
    __i_cmp
    __i_cmp_set e
  }

  macro _i_neq {
    __i_cmp
    __i_cmp_set ne
  }

  macro _i_lt {
    __i_cmp
    __i_cmp_set l
  }

  macro _i_gt {
    __i_cmp
    __i_cmp_set g
  }

  macro _i_lteq {
    __i_cmp
    __i_cmp_set le
  }

  macro _i_gteq {
    __i_cmp
    __i_cmp_set ge
  }

;; Stack
  macro _i_dup  { push qword [rsp] }
  macro _i_over { push qword [rsp+16] }
  macro _i_dup2 {
    push qword [rsp+8]
    push qword [rsp+8]
  }

  macro _i_swap {
    pop rax
    pop rbx
    push rax
    push rbx
  }

  macro _i_rot {
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

  macro _i_write8  { __i_write bl  }
  macro _i_write16 { __i_write bx  }
  macro _i_write32 { __i_write ebx }
  macro _i_write64 { __i_write rbx }

  macro _i_read8  { __i_read bl  }
  macro _i_read16 { __i_read bx  }
  macro _i_read32 { __i_read ebx }
  macro _i_read64 {
    pop rax
    ; no need for `xor`
    mov rbx, [rax]
    push rbx
  }
;; Misc
  macro _i_print {
    pop rdi
    call print
  }

  macro _i_puts {
    mov rax, 1
    mov rdi, 1
    pop rsi
    pop rdx
    syscall
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
  callstack:     rb 640000
  callstack_end:

  stack_overflow_msg:       db '[RUNTIME ERROR] Stack overflow', 10
  stack_overflow_msg_size = $ - stack_overflow_msg
