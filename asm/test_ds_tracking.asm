; 测试 DS 段内存跟踪功能
; 验证：
; 1. 初始化阶段 - DS 内存自动定位到数据段起始
; 2. 读写数据段不同位置 - DS 内存视图跟踪最后访问位置
; 3. 修改 DS 段寄存器 - DS 内存视图自动导航到新地址

data segment
    msg1  db 'Hello', 0       ; 偏移 0000
    val1  dw 1234h             ; 偏移 0006
    buf1  db 16 dup(0)         ; 偏移 0008
    msg2  db 'World', 0        ; 偏移 0018
    val2  dw 5678h             ; 偏移 001E
    ; 在较远偏移处放置数据，测试跟踪跳转
    org 0100h
    far1  dw 0ABCDh            ; 偏移 0100
    far2  db 'Far away data', 0 ; 偏移 0102
    org 0200h
    far3  dw 0FFFFh            ; 偏移 0200
data ends

code segment
assume cs:code, ds:data

main:
    ; === 测试1：读取数据段起始位置 ===
    ; DS内存应跟踪到偏移 0000 附近
    mov al, [msg1]         ; 读偏移 0000

    ; === 测试2：读取较远偏移位置 ===
    ; DS内存应跟踪到偏移 0100 附近
    mov ax, [far1]         ; 读偏移 0100

    ; === 测试3：写入中间位置 ===
    ; DS内存应跟踪到偏移 0008 附近
    mov [buf1], al         ; 写偏移 0008
    mov [buf1+1], ah       ; 写偏移 0009

    ; === 测试4：读取更远的位置 ===
    ; DS内存应跟踪到偏移 0200 附近
    mov bx, [far3]         ; 读偏移 0200

    ; === 测试5：写回起始位置 ===
    ; DS内存应跟踪回偏移 0006 附近
    mov [val1], bx         ; 写偏移 0006

    ; === 测试6：修改 DS 段寄存器 ===
    ; DS内存应自动导航到新的 DS 段地址
    mov ax, 3000h
    mov ds, ax             ; DS 从 2000h 改为 3000h
                           ; DS内存应导航到物理地址 30000h

    ; === 测试7：在新 DS 段中读写 ===
    ; DS内存应跟踪到新段的访问位置
    mov word ptr [0000h], 1111h  ; 写新DS段偏移 0000
    mov word ptr [0010h], 2222h  ; 写新DS段偏移 0010
    mov ax, [0010h]              ; 读新DS段偏移 0010

    ; === 测试8：再次切换 DS ===
    mov ax, 2000h
    mov ds, ax             ; DS 恢复为 2000h
                           ; DS内存应导航回物理地址 20000h

    ; 验证原始数据仍在
    mov ax, [val2]         ; 读偏移 001E，值应为 5678h

    ; 结束
    mov ah, 4Ch
    int 21h

code ends
end main
