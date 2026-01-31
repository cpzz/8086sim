.model small
.stack 100h

.data
    message db 'Hello, World!', 0dh, 0ah, '$'

.code
main proc
    mov ax, @data
    mov ds, ax
    
    lea dx, message
    mov ah, 9
    int 21h
    
    mov ah, 4ch
    int 21h
main endp
end main
