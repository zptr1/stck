;; Compiled with stck v0.0.2

format ELF64 executable 3
segment readable executable
_start:
mov rax, callstack_end
mov [callstack_rsp], rax
call proc_0
mov rax, 60
mov rdi, 0
syscall
; begin builtins
print:
  mov r9, -3689348814741910323
  sub rsp, 40
  mov BYTE [rsp+31], 10
  lea rcx, [rsp+30]
.L2:
  mov rax, rdi
  lea r8, [rsp+32]
  mul r9
  mov rax, rdi
  sub r8, rcx
  shr rdx, 3
  lea rsi, [rdx+rdx*4]
  add rsi, rsi
  sub rax, rsi
  add eax, 48
  mov BYTE [rcx], al
  mov rax, rdi
  mov rdi, rdx
  mov rdx, rcx
  sub rcx, 1
  cmp rax, 9
  ja  .L2
  lea rax, [rsp+32]
  mov edi, 1
  sub rdx, rax
  xor eax, eax
  lea rsi, [rsp+32+rdx]
  mov rdx, r8
  mov rax, 1
  syscall
  add     rsp, 40
  ret
; end builtins
proc_0: ;; main @ /home/yui/stck/test.stck
sub rsp, 8
mov [callstack_rsp], rsp
mov rsp, rax
push 15
push str0
mov rax, 1
mov rdi, 1
pop rsi
pop rdx
syscall
mov rax, rsp
mov rsp, [callstack_rsp]
add rsp, 8
ret
segment readable writeable
callstack_rsp: rq 1
callstack:     rb 64000
callstack_end:
mem:           rb 0
str0 db 72,101,108,108,111,44,32,110,97,116,105,118,101,33,10