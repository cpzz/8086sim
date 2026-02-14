; test_mem_rw.asm
; 8086 汇编 — 测试内存读写（DS/ES/SS）、堆栈与字符串写

org 100h

start:
    ; --- 初始化 DS = 2000h ---
    mov ax, 2000h
    mov ds, ax

    ; 写入 word 到 DS:0000
    mov ax, 1111h
    mov [0000h], ax        ; DS:[0000] <- 1111h

    ; 写入 byte 到 DS:0010
    mov byte ptr [0010h], 22h

    ; 读回到寄存器
    mov bx, [0000h]        ; BX <- word at DS:0000
    mov al, [0010h]        ; AL <- byte at DS:0010

    ; --- 用 ES + REP STOSB 在 DS:0020 开始写一段字节 ---
    mov ax, 2000h
    mov es, ax
    mov di, 0020h
    mov cx, 16
    mov al, 5Ah
    rep stosb              ; ES:DI.. <- 0x5A * 16

    ; --- 切换 DS 到 3000h, 写/读 ---
    mov ax, 3000h
    mov ds, ax
    mov ax, 3333h
    mov [0100h], ax        ; DS:[0100] <- 3333h
    mov cx, [0100h]        ; CX <- word at DS:0100

    ; --- 测试堆栈（SS）写入 ---
    mov ax, 3000h
    mov ss, ax
    mov sp, 0FFFEh
    push cx                ; 写入 SS:[SP-2]
    pop dx                 ; DX <- 从栈顶弹出的值

    ; --- 用 ES 写一个 word（通过 AX -> [DI]）---
    mov ax, 2000h
    mov es, ax
    mov di, 0040h
    mov ax, 1234h
    mov [di], ax           ; ES:[0040] <- 1234h

    ; --- 切回 CS 段的当前指令（用作展示） ---
    ; 在模拟器中对 CS 段的写入通常标记为异常/关注点，下面只是跳转回循环，便于观察：
loop_forever:
    jmp loop_forever
