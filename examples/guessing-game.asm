; Compiled with STCK

format ELF64
include "/home/yui/stck/lib/prelude.asm"
section '.text' executable

__proc_0:
switch_to_datastack
push rsi
push rdi
call_proc __proc_1
push mem+0
intrinsic_write64
call_proc __proc_2
push qword 100
intrinsic_mod
push qword 0
.L0:
intrinsic_over
intrinsic_over
intrinsic_eq
intrinsic_not
push qword 2
intrinsic_add
jmpifnot .L1
push 12
push str0
intrinsic_puts
add rsp, 8
push qword 64
push mem+8
push qword 0
push qword 0
pop rax
pop rdi
pop rsi
pop rdx
syscall
push rax
push mem+8
call_proc __proc_3
push qword 1
intrinsic_offset
add rsp, 8
intrinsic_dup
push qword 99
__i_cmp
jng .L2
push 32
push str1
intrinsic_puts
jmp .L3
.L2:
intrinsic_over
intrinsic_over
__i_cmp
jne .L4
push 16
push str2
intrinsic_puts
intrinsic_reset
intrinsic_print
jmp .L5
.L4:
intrinsic_over
intrinsic_over
__i_cmp
jnl .L6
push 50
push str3
intrinsic_puts
jmp .L7
.L6:
intrinsic_over
intrinsic_over
__i_cmp
jng .L8
push 53
push str4
intrinsic_puts
.L8:
.L7:
.L5:
.L3:
jmp .L0
.L1:
add rsp, 8
add rsp, 8
push qword 0
switch_to_callstack
ret
__proc_1:
switch_to_datastack
push mem+72
push qword 0
push qword 228
pop rax
pop rdi
pop rsi
syscall
push rax
add rsp, 8
push mem+72
push qword 0
intrinsic_add
intrinsic_read64
push qword 1000
intrinsic_mul
push mem+72
push qword 8
intrinsic_add
intrinsic_read64
push qword 1000000
intrinsic_div
intrinsic_add
switch_to_callstack
ret
__proc_2:
switch_to_datastack
push mem+0
intrinsic_read64
push64 6364136223846793005
intrinsic_mul
push64 1442695040888963407
intrinsic_add
intrinsic_dup
push mem+0
intrinsic_write64
switch_to_callstack
ret
__proc_3:
switch_to_datastack
intrinsic_dup
intrinsic_read8
push qword 45
__i_cmp
jne .L0
push qword 1
intrinsic_add
intrinsic_swap
push qword 1
intrinsic_sub
intrinsic_swap
call_proc __proc_4
intrinsic_not
push qword 1
intrinsic_add
jmp .L1
.L0:
call_proc __proc_4
.L1:
switch_to_callstack
ret
__proc_4:
switch_to_datastack
sub cs_ptr, 16
pop qword [cs_ptr+8]
pop qword [cs_ptr+0]
push qword 0
push qword 0
.L0:
intrinsic_dup
push qword [cs_ptr+0]
__i_cmp
jnl .L1
push qword [cs_ptr+8]
intrinsic_over
intrinsic_add
intrinsic_read8
intrinsic_dup
intrinsic_dup
push qword 48
intrinsic_gteq
intrinsic_swap
push qword 57
intrinsic_lteq
intrinsic_and
jmpifnot .L2
push qword 48
intrinsic_sub
intrinsic_rot
push qword 10
intrinsic_mul
intrinsic_add
intrinsic_swap
jmp .L3
.L2:
add rsp, 8
.L3:
push qword 1
intrinsic_add
jmp .L0
.L1:
add rsp, 8
add cs_ptr, 16
switch_to_callstack
ret
section '.data' writeable
mem rb 88
str0 db 89,111,117,114,32,103,117,101,115,115,58,32,0
str1 db 84,104,101,32,103,117,101,115,115,32,109,117,115,116,32,98,101,32,102,114,111,109,32,48,32,116,111,32,57,57,46,10,0
str2 db 89,111,117,32,119,111,110,33,32,84,114,105,101,115,58,32,0
str3 db 87,114,111,110,103,44,32,116,104,101,32,97,99,116,117,97,108,32,110,117,109,98,101,114,32,105,115,32,108,101,115,115,32,116,104,97,110,32,121,111,117,114,32,103,117,101,115,115,46,10,0
str4 db 87,114,111,110,103,44,32,116,104,101,32,97,99,116,117,97,108,32,110,117,109,98,101,114,32,105,115,32,103,114,101,97,116,101,114,32,116,104,97,110,32,121,111,117,114,32,103,117,101,115,115,46,10,0