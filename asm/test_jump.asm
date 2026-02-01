.MODEL small
.STACK 100h

.CODE
main proc
    ; 测试 JMP 指令
    jmp start_jump  ; 跳转到start_jump标签
    
    mov ax, 1       ; 此指令不会执行，因为上面有JMP
    
start_jump:
    mov ax, 0       ; 设置AX = 0
    
    ; 测试 JE/JZ 指令
    mov ax, 1       ; 设置AX = 1
    cmp ax, 1       ; 比较AX和1，结果相等
    je equal        ; 因为相等，跳转到equal标签
    mov bx, 1       ; 此指令不会执行，因为上面有JE跳转
    jmp end_je      ; 此指令不会执行，因为上面有JE跳转
    
 equal:
    mov bx, 0       ; 设置BX = 0
    
end_je:
    
    ; 测试 JNE/JNZ 指令
    mov ax, 1       ; 设置AX = 1
    cmp ax, 2       ; 比较AX和2，结果不相等
    jne not_equal   ; 因为不相等，跳转到not_equal标签
    mov cx, 1       ; 此指令不会执行，因为上面有JNE跳转
    jmp end_jne     ; 此指令不会执行，因为上面有JNE跳转
    
not_equal:
    mov cx, 0       ; 设置CX = 0
    
end_jne:
    
    ; 测试 JG 指令
    mov ax, 13      ; 设置AX = 13
    cmp ax, 12      ; 比较AX和12，结果大于
    jg greater      ; 因为大于，跳转到greater标签
    mov dx, 1       ; 此指令不会执行，因为上面有JG跳转
    jmp end_jg      ; 此指令不会执行，因为上面有JG跳转
    
 greater:
    mov dx, 2       ; 设置DX = 2
    
end_jg:
    
    ; 测试 JL 指令
    mov ax, 11      ; 设置AX = 11
    cmp ax, 12      ; 比较AX和12，结果小于
    jl less         ; 因为小于，跳转到less标签
    mov si, 1       ; 此指令不会执行，因为上面有JL跳转
    jmp end_jl      ; 此指令不会执行，因为上面有JL跳转
    
less:
    mov si, 2       ; 设置SI = 2
    
end_jl:
    
    ; 退出程序
    mov ah, 4Ch     ; 设置AH = 4Ch（退出功能）
    int 21h         ; 调用DOS中断，退出程序
main endp

end main