;; The core functionality of stck.
;; Automatically included by the compiler.

segment readable executable

_start:
  mov rbp, rsp
  mov rsp, callstack_end
  call proc_0
  mov rax, 60
  mov rdi, 0
  syscall

_core:
  macro swap_stack_pointers {
    mov rax, rsp
    mov rsp, rbp
    mov rbp, rax
  }

  macro call_proc id {
    call check_callstack_overflow
    swap_stack_pointers
    call proc_#id
    swap_stack_pointers
  }

_intrinsics:
  macro intrinsic_add {
    pop rbx
    pop rax
    add rax, rbx
    push rax
  }

  macro intrinsic_sub {
    pop rbx
    pop rax
    sub rax, rbx
    push rax
  }

  macro intrinsic_mul {
    pop rbx
    pop rax
    mul rbx
    push rax
  }

  macro intrinsic_divmod {
    pop rbx
    pop rax
    xor rdx, rdx
    div rbx
    push rax
    push rdx
  }

  macro intrinsic_imul {
    pop rbx
    pop rax
    imul rbx
    push rax
  }

  macro intrinsic_idivmod {
    pop rbx
    pop rax
    idiv rbx
    push rax
  }

  macro intrinsic_or {
    pop rbx
    pop rax
    or rax, rbx
    push rax
  }

  macro intrinsic_and {
    pop rbx
    pop rax
    and rax, rbx
    push rax
  }

  macro intrinsic_xor {
    pop rbx
    pop rax
    xor rax, rbx
    push rax
  }

  macro intrinsic_eq {
    pop rbx
    pop rax
    cmp rax, rbx
    sete al
    movzx rax, al
    push rax
  }

  macro intrinsic_neq {
    pop rbx
    pop rax
    cmp rax, rbx
    setne al
    movzx rax, al
    push rax
  }

  macro intrinsic_lt {
    pop rbx
    pop rax
    cmp rax, rbx
    setl al
    movzx rax, al
    push rax
  }

  macro intrinsic_gt {
    pop rbx
    pop rax
    cmp rax, rbx
    setg al
    movzx rax, al
    push rax
  }

  macro intrinsic_lteq {
    pop rbx
    pop rax
    cmp rax, rbx
    setle al
    movzx rax, al
    push rax
  }

  macro intrinsic_gteq {
    pop rbx
    pop rax
    cmp rax, rbx
    setge al
    movzx rax, al
    push rax
  }

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
    pop rax
    not rax
    push rax
  }

  macro intrinsic_dup {
    pop rax
    push rax
    push rax
  }

  macro intrinsic_drop {
    pop rax
  }

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

  macro intrinsic_over {
    pop rax
    pop rbx
    push rbx
    push rax
    push rbx
  }

  macro intrinsic_2dup {
    pop rax
    pop rbx
    push rbx
    push rax
    push rbx
    push rax
  }

  macro intrinsic_2swap {
    pop rax
    pop rbx
    pop rcx
    pop rdx
    push rax
    push rbx
    push rcx
    push rdx
  }

  macro intrinsic_write8 {
    pop rax
    pop rbx
    mov [rax], bl
  }

  macro intrinsic_write16 {
    pop rax
    pop rbx
    mov [rax], bx
  }

  macro intrinsic_write32 {
    pop rax
    pop rbx
    mov [rax], ebx
  }

  macro intrinsic_write64 {
    pop rax
    pop rbx
    mov [rax], rbx
  }

  macro intrinsic_read8 {
    pop rax
    xor rbx, rbx
    mov bl, [rax]
    push rbx
  }

  macro intrinsic_read16 {
    pop rax
    xor rbx, rbx
    mov bx, [rax]
    push rbx
  }

  macro intrinsic_read32 {
    pop rax
    xor rbx, rbx
    mov ebx, [rax]
    push rbx
  }

  macro intrinsic_read64 {
    pop rax
    xor rbx, rbx
    mov rbx, [rax]
    push rbx
  }

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

  macro intrinsic_nop {}
_builtins:
  ; Prints a signed integer from rdi
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

  check_callstack_overflow:
    ; mov rcx, 0
    ; mov rdx, 1
    cmp rbp, callstack
    jge .L2
      mov rax, 1
      mov rdi, 2
      mov rsi, stack_overflow_msg
      mov rdx, stack_overflow_msg_size
      syscall
      mov rax, 60
      mov rdi, 1
      syscall
    .L2: ret

segment readable writeable
  callstack:     rb 80000
  callstack_end:

segment readable
  stack_overflow_msg:       db '[RUNTIME ERROR] Stack overflow', 10
  stack_overflow_msg_size = $ - stack_overflow_msg
