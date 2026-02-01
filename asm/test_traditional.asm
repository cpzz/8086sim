assume cs:code, ds:data

code segment
start:
    mov ax, data    ; 设置AX = 数据段地址
    mov ds, ax      ; 设置DS = AX，初始化数据段寄存器
    
    ; 基础指令测试
    mov ax, 1234h   ; 设置AX = 1234h
    mov bx, 5678h   ; 设置BX = 5678h
    
    ; 测试寄存器到寄存器的 MOV 指令
    mov si, ax      ; 设置SI = AX = 1234h
    mov di, bx      ; 设置DI = BX = 5678h
    
    ; 测试寄存器到寄存器的 SUB 指令
    sub bx, si      ; 执行BX = BX - SI = 5678h - 1234h = 4444h
    
    ; 测试 CMP 指令和条件跳转
    cmp si, 0       ; 比较SI和0，结果不相等
    je si_zero      ; 因为不相等，不跳转到si_zero标签
    mov ax, 1       ; 设置AX = 1
    jmp end_cmp     ; 跳转到end_cmp标签
    
si_zero:
    mov ax, 0       ; 此指令不会执行，因为上面的JE条件不满足
    
end_cmp:
    
    ; 测试 SHL 指令
    shl bx, 1       ; 执行BX = BX << 1 = 4444h << 1 = 8888h
    
    ; 退出程序
    mov ah, 4Ch     ; 设置AH = 4Ch（退出功能）
    int 21h         ; 调用DOS中断，退出程序
code ends

data segment
data ends

end start