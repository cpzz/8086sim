; 测试LEA指令的汇编程序
.model small
.stack 100h

.data
    msg1 db 'Hello from LEA test!', 0dh, 0ah, '$'
    msg2 db 'LEA instruction works!', 0dh, 0ah, '$'
    buffer db 100 dup(0)

.code
main proc
    mov ax, @data
    mov ds, ax
    
    ; 测试LEA指令
    lea dx, msg1      ; 应该加载msg1的地址到DX
    mov ah, 9
    int 21h           ; 显示msg1
    
    lea dx, msg2      ; 应该加载msg2的地址到DX
    mov ah, 9
    int 21h           ; 显示msg2
    
    ; 测试LEA到其他寄存器
    lea bx, buffer    ; 加载buffer地址到BX
    mov ax, 1234h
    mov [bx], ax      ; 将1234h存入buffer
    
    ; 退出程序
    mov ah, 4ch
    int 21h
main endp
end main
