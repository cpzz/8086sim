.MODEL small
.STACK 100h

.CODE
main proc
    ; 测试 CALL 指令
    call print_hello  ; 调用print_hello过程
    call print_world  ; 调用print_world过程
    
    ; 退出程序
    mov ah, 4Ch       ; 设置AH = 4Ch（退出功能）
    int 21h           ; 调用DOS中断，退出程序
main endp

; 打印 "Hello, "
print_hello proc
    mov ah, 09h       ; 设置AH = 09h（显示字符串功能）
    lea dx, hello_msg ; 设置DX = hello_msg的偏移地址
    int 21h           ; 调用DOS中断，显示"Hello, "
    ret               ; 返回调用点
print_hello endp

; 打印 "World!"
print_world proc
    mov ah, 09h       ; 设置AH = 09h（显示字符串功能）
    lea dx, world_msg ; 设置DX = world_msg的偏移地址
    int 21h           ; 调用DOS中断，显示"World!"
    ret               ; 返回调用点
print_world endp

hello_msg db 'Hello, ', '$' ; 定义字符串"Hello, "
world_msg db 'World!', 0dh, 0ah, '$' ; 定义字符串"World!"带回车换行

end main