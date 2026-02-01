.MODEL small
.STACK 100h

.DATA
    star_char db '*'
    space_char db ' '

.CODE
main proc
    mov ax, @data
    mov ds, ax

    ; 输出星形图案（菱形）
    call draw_star

    ; 退出程序
    mov ah, 4Ch
    int 21h
main endp

; 绘制菱形图案
draw_star proc
    mov cx, 0        ; cx = 行号 (0-24)
row_loop:
    cmp cx, 25
    je row_done      ; 25行结束

    ; 判断当前行相对于中心行（第12行）
    mov ax, cx
    cmp ax, 12
    jg is_bottom     ; 大于12，是下半部分

    ; 上半部分 (0-12行)
    ; 前导空格 = 12 - 行号
    mov bx, 12
    sub bx, cx
    call print_spaces

    ; 打印第一个星号
    call print_star

    ; 如果是第0行，跳过中间空格和第二个星号
    cmp cx, 0
    je after_middle_spaces

    ; 中间空格数 = 2 * 行号 - 1
    mov bx, cx
    shl bx, 1        ; bx = 行号 * 2
    dec bx           ; bx = 2*行号 - 1
    call print_spaces

    ; 打印第二个星号
    call print_star

after_middle_spaces:
    call print_newline
    inc cx
    jmp row_loop

is_bottom:
    ; 下半部分 (13-24行)
    ; 计算对称的行号: 24 - 行号
    mov ax, 24
    sub ax, cx
    mov cx, ax       ; cx = 对称行号 (11-0)

    ; 前导空格 = 12 - cx
    mov bx, 12
    sub bx, cx
    call print_spaces

    ; 打印第一个星号
    call print_star

    ; 如果cx=0，跳过中间空格和第二个星号
    cmp cx, 0
    je bottom_end

    ; 中间空格数 = 2 * cx - 1
    mov bx, cx
    shl bx, 1        ; bx = cx * 2
    dec bx           ; bx = 2*cx - 1
    call print_spaces

    ; 打印第二个星号
    call print_star

bottom_end:
    call print_newline
    mov ax, 24
    sub ax, cx       ; 恢复原始行号
    inc cx           ; 下一行
    jmp row_loop

row_done:
    ret
draw_star endp

; 打印指定数量的空格 (参数: bx = 空格数量)
print_spaces proc
    cmp bx, 0
    je spaces_done
spaces_loop:
    call print_space
    dec bx
    jnz spaces_loop
spaces_done:
    ret
print_spaces endp

print_star proc
    mov ah, 02h
    mov dl, star_char
    int 21h
    ret
print_star endp

print_space proc
    mov ah, 02h
    mov dl, space_char
    int 21h
    ret
print_space endp

print_newline proc
    mov ah, 02h
    mov dl, 0Dh  ; 回车
    int 21h
    mov dl, 0Ah  ; 换行
    int 21h
    ret
print_newline endp

end main