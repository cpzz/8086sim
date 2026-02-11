; 8086汇编语言Hello World程序
; 测试程序用于验证模拟器的功能

.model small
.stack 100h

.data
hello db 'Hello, World!', '$'

.code
main proc
    ; 初始化数据段
    mov ax, @data
    mov ds, ax
    
    ; 显示字符串
    mov ah, 09h        ; DOS功能号：显示字符串
    mov dx, offset hello
    int 21h
    
    ; 程序结束
    mov ah, 4ch        ; DOS功能号：程序终止
    int 21h
main endp

end main