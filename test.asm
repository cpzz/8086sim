; 简单的8086汇编测试程序

start:
    ; 测试ADD指令
    add al, 0x10    ; AL = AL + 16
    add ax, 0x1000  ; AX = AX + 4096
    
    ; 测试MOV指令
    mov bx, ax      ; BX = AX
    mov ax, bx      ; AX = BX
    
    ; 测试NOP指令
    nop
    nop
    
    ; 测试RET指令
    ret
