; 全面的8086汇编测试程序

start:
    ; 测试数据传输指令
    mov ax, 0x1234    ; AX = 0x1234
    mov bx, 0x5678    ; BX = 0x5678
    mov cx, ax        ; CX = AX
    mov dx, bx        ; DX = BX
    
    ; 测试算术指令
    add al, 0x10      ; AL = AL + 16
    add ax, 0x1000    ; AX = AX + 4096
    add bx, cx        ; BX = BX + CX
    
    ; 测试逻辑指令
    and ax, 0xf0f0    ; AX = AX & 0xf0f0
    or bx, 0x0f0f     ; BX = BX | 0x0f0f
    xor cx, dx        ; CX = CX ^ DX
    
    ; 测试移位指令
    shl ax, 1         ; AX = AX << 1
    shr bx, 1         ; BX = BX >> 1
    
    ; 测试栈操作
    push ax           ; 将AX压入栈
    push bx           ; 将BX压入栈
    pop cx            ; 从栈弹出到CX
    pop dx            ; 从栈弹出到DX
    
    ; 测试比较指令
    cmp ax, bx        ; 比较AX和BX
    
    ; 测试跳转指令
    jz skip           ; 如果ZF=1，跳转到skip
    mov si, 0x1000    ; SI = 0x1000
    jmp end_test      ; 无条件跳转到end_test
    
skip:
    mov di, 0x2000    ; DI = 0x2000
    
    ; 测试NOP指令
    nop
    nop
    nop
    
end_test:
    ; 测试RET指令
    ret
