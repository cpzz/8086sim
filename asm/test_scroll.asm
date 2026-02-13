; 测试屏幕滚动功能
; 输出100行文本以测试滚动条和键盘导航

.model small
.stack 100h

.data
    line_prefix db 'Line ', '$'
    line_suffix db 0dh, 0ah, '$'
    counter dw 1

.code
main proc
    ; 初始化数据段
    mov ax, @data
    mov ds, ax
    
    ; 输出100行
    mov cx, 100
    
output_loop:
    ; 保存循环计数器
    push cx
    
    ; 输出 "Line "
    mov ah, 09h
    lea dx, line_prefix
    int 21h
    
    ; 输出行号
    mov ax, counter
    call print_number
    
    ; 输出换行
    mov ah, 09h
    lea dx, line_suffix
    int 21h
    
    ; 增加计数器
    inc counter
    
    ; 恢复循环计数器
    pop cx
    loop output_loop
    
    ; 程序结束
    mov ah, 4ch
    int 21h
main endp

; 打印数字（AX中的值）
print_number proc
    push ax
    push bx
    push cx
    push dx
    
    mov cx, 0
    mov bx, 10
    
divide_loop:
    xor dx, dx
    div bx
    push dx
    inc cx
    test ax, ax
    jnz divide_loop
    
print_digits:
    pop dx
    add dl, '0'
    mov ah, 02h
    int 21h
    loop print_digits
    
    pop dx
    pop cx
    pop bx
    pop ax
    ret
print_number endp

end main
