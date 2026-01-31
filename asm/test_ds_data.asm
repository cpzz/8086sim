; 测试 DS 段数据写入
.model small
.stack 100h

.data
    msg1 db 'First message', 0dh, 0ah, '$'
    msg2 db 'Second message', 0dh, 0ah, '$'
    value db 99

.code
main proc
    ; 设置数据段
    mov ax, @data
    mov ds, ax

    ; 显示第一条消息
    lea dx, msg1
    mov ah, 9
    int 21h

    ; 显示第二条消息
    lea dx, msg2
    mov ah, 9
    int 21h

    ; 程序结束
    mov ah, 4ch
    int 21h
main endp
end main
