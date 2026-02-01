.MODEL small
.STACK 100h

.CODE
main proc
    ; 基础指令测试
    mov ax, 1234h  ; 设置AX = 1234h
    mov bx, 5678h  ; 设置BX = 5678h
    mov cx, 9abch  ; 设置CX = 9abch
    mov dx, 0def0h ; 设置DX = 0def0h
    
    ; 测试 ADD 指令
    add ax, bx     ; 执行AX = AX + BX = 1234h + 5678h = 68ach
    add cx, dx     ; 执行CX = CX + DX = 9abch + 0def0h = 79ach
    
    ; 测试 SUB 指令
    sub ax, bx     ; 执行AX = AX - BX = 68ach - 5678h = 1234h
    sub cx, dx     ; 执行CX = CX - DX = 79ach - 0def0h = 8bbch
    
    ; 测试 AND 指令
    and ax, bx     ; 执行AX = AX & BX = 1234h & 5678h = 1230h
    and cx, dx     ; 执行CX = CX & DX = 8bbch & 0def0h = 8a30h
    
    ; 测试 OR 指令
    or ax, bx      ; 执行AX = AX | BX = 1230h | 5678h = 5678h
    or cx, dx      ; 执行CX = CX | DX = 8a30h | 0def0h = dffch
    
    ; 测试 XOR 指令
    xor ax, bx     ; 执行AX = AX ^ BX = 5678h ^ 5678h = 0000h
    xor cx, dx     ; 执行CX = CX ^ DX = dffch ^ 0def0h = 0540h
    
    ; 测试 ADC 指令
    adc ax, bx     ; 执行AX = AX + BX + CF = 0000h + 5678h + 0 = 5678h
    
    ; 测试 SBB 指令
    sbb cx, dx     ; 执行CX = CX - DX - CF = 0540h - 0def0h - 0 = fb90h
    
    ; 测试 MOV 指令（立即数到寄存器）
    mov ax, 1234h  ; 设置AX = 1234h
    mov bx, 5678h  ; 设置BX = 5678h
    
    ; 退出程序
    mov ah, 4Ch    ; 设置AH = 4Ch（退出功能）
    int 21h        ; 调用DOS中断，退出程序
main endp

end main