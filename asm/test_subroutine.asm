; test_subroutine.asm
; 8086 汇编 — 测试子程序调用（CALL/RET）、参数传递和栈平衡

org 100h

start:
    ; 初始化 DS/ES，便于观察内存写入
    mov ax, 2000h
    mov ds, ax
    mov es, ax

    ; --- 测试单参数子程序：add_one (返回 param+1 -> AX) ---
    mov ax, 5
    push ax              ; param1 = 5
    call add_one         ; 调用后 AX = 6
    ; 存储结果到 DS:0100
    mov [0100h], ax

    ; --- 测试双参数子程序：add_two (返回 a+b -> AX) ---
    push 3               ; param2
    push 4               ; param1（注意压栈顺序可以根据约定）
    call add_two         ; 调用后 AX = 7
    mov [0102h], ax

    ; 进入无限循环，便于在模拟器中单步/观察寄存器和内存
loop_forever:
    jmp loop_forever

; ---------------- 子程序区（使用 PROC/ENDP 测试伪指令） ----------------

add_one proc near
    push bp
    mov bp, sp
    mov ax, [bp+4]
    add ax, 1
    pop bp
    ret 2
add_one endp

add_two proc near
    push bp
    mov bp, sp
    mov ax, [bp+6]  ; 注意：参数顺序依压栈顺序，这里示例为先push 3 then push 4
    add ax, [bp+4]
    pop bp
    ret 4
add_two endp

; 结束
