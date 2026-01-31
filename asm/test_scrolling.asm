; 测试显示控制界面滚动功能的汇编程序
; 输出30行文本，验证超过25行时的滚动效果

.model small
.stack 100h

.data
    line1 db 'Line 1: Testing scrolling functionality', 0dh, 0ah, '$'
    line2 db 'Line 2: This is line 2 of output', 0dh, 0ah, '$'
    line3 db 'Line 3: More lines to come', 0dh, 0ah, '$'
    line4 db 'Line 4: Line 4 here', 0dh, 0ah, '$'
    line5 db 'Line 5: Halfway to 25 lines', 0dh, 0ah, '$'
    line6 db 'Line 6: Continuing output', 0dh, 0ah, '$'
    line7 db 'Line 7: Line 7 of text', 0dh, 0ah, '$'
    line8 db 'Line 8: Testing display', 0dh, 0ah, '$'
    line9 db 'Line 9: Almost 10 lines', 0dh, 0ah, '$'
    line10 db 'Line 10: Double digits', 0dh, 0ah, '$'
    line11 db 'Line 11: Line 11 here', 0dh, 0ah, '$'
    line12 db 'Line 12: More output', 0dh, 0ah, '$'
    line13 db 'Line 13: Testing scroll', 0dh, 0ah, '$'
    line14 db 'Line 14: Line 14 of text', 0dh, 0ah, '$'
    line15 db 'Line 15: Halfway point', 0dh, 0ah, '$'
    line16 db 'Line 16: Line 16 here', 0dh, 0ah, '$'
    line17 db 'Line 17: More scrolling', 0dh, 0ah, '$'
    line18 db 'Line 18: Line 18 of text', 0dh, 0ah, '$'
    line19 db 'Line 19: Almost 20 lines', 0dh, 0ah, '$'
    line20 db 'Line 20: Twenty lines done', 0dh, 0ah, '$'
    line21 db 'Line 21: Line 21 here', 0dh, 0ah, '$'
    line22 db 'Line 22: Testing limit', 0dh, 0ah, '$'
    line23 db 'Line 23: Line 23 of text', 0dh, 0ah, '$'
    line24 db 'Line 24: Almost 25 lines', 0dh, 0ah, '$'
    line25 db 'Line 25: Twenty-five lines', 0dh, 0ah, '$'
    line26 db 'Line 26: Now scrolling starts', 0dh, 0ah, '$'
    line27 db 'Line 27: Line 27 of text', 0dh, 0ah, '$'
    line28 db 'Line 28: Testing scroll', 0dh, 0ah, '$'
    line29 db 'Line 29: Line 29 here', 0dh, 0ah, '$'
    line30 db 'Line 30: Final line of output', 0dh, 0ah, '$'

.code
main proc
    mov ax, @data
    mov ds, ax

    ; 输出30行文本
    lea dx, line1
    mov ah, 9
    int 21h

    lea dx, line2
    mov ah, 9
    int 21h

    lea dx, line3
    mov ah, 9
    int 21h

    lea dx, line4
    mov ah, 9
    int 21h

    lea dx, line5
    mov ah, 9
    int 21h

    lea dx, line6
    mov ah, 9
    int 21h

    lea dx, line7
    mov ah, 9
    int 21h

    lea dx, line8
    mov ah, 9
    int 21h

    lea dx, line9
    mov ah, 9
    int 21h

    lea dx, line10
    mov ah, 9
    int 21h

    lea dx, line11
    mov ah, 9
    int 21h

    lea dx, line12
    mov ah, 9
    int 21h

    lea dx, line13
    mov ah, 9
    int 21h

    lea dx, line14
    mov ah, 9
    int 21h

    lea dx, line15
    mov ah, 9
    int 21h

    lea dx, line16
    mov ah, 9
    int 21h

    lea dx, line17
    mov ah, 9
    int 21h

    lea dx, line18
    mov ah, 9
    int 21h

    lea dx, line19
    mov ah, 9
    int 21h

    lea dx, line20
    mov ah, 9
    int 21h

    lea dx, line21
    mov ah, 9
    int 21h

    lea dx, line22
    mov ah, 9
    int 21h

    lea dx, line23
    mov ah, 9
    int 21h

    lea dx, line24
    mov ah, 9
    int 21h

    lea dx, line25
    mov ah, 9
    int 21h

    lea dx, line26
    mov ah, 9
    int 21h

    lea dx, line27
    mov ah, 9
    int 21h

    lea dx, line28
    mov ah, 9
    int 21h

    lea dx, line29
    mov ah, 9
    int 21h

    lea dx, line30
    mov ah, 9
    int 21h

    ; 退出程序
    mov ah, 4ch
    int 21h
main endp
end main