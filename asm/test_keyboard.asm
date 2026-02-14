; INT 21H 键盘输入功能测试程序
; 测试所有键盘相关的 INT 21H 子功能
;
; AH=01H  带回显键盘输入（阻塞）
; AH=07H  无回显无过滤键盘输入（阻塞）
; AH=08H  无回显有过滤键盘输入（阻塞，检查Ctrl+C）
; AH=06H  直接控制台I/O - DL=FFH 非阻塞输入
; AH=0BH  检查键盘状态（非阻塞）
; AH=0AH  缓冲字符串输入（阻塞）

.MODEL SMALL
.STACK 100h

.DATA
    ; ---- 标题 ----
    msg_title       DB '================================', 0Dh, 0Ah
                    DB ' INT 21H Keyboard Input Tests', 0Dh, 0Ah
                    DB '================================', 0Dh, 0Ah, '$'

    ; ---- 分隔线 ----
    msg_sep         DB 0Dh, 0Ah, '--------------------------------', 0Dh, 0Ah, '$'

    ; ---- 测试1: AH=01H 带回显键盘输入 ----
    msg_t1          DB '[1] AH=01H  Input with echo', 0Dh, 0Ah
                    DB '    Press a key: $'
    msg_t1_r        DB 0Dh, 0Ah, '    AL=$'

    ; ---- 测试2: AH=07H 无回显无过滤输入 ----
    msg_t2          DB '[2] AH=07H  No echo, no filter', 0Dh, 0Ah
                    DB '    Press a key (no echo): $'
    msg_t2_r        DB 0Dh, 0Ah, '    You pressed: $'

    ; ---- 测试3: AH=08H 无回显有过滤输入 ----
    msg_t3          DB '[3] AH=08H  No echo, filtered', 0Dh, 0Ah
                    DB '    Press a key (Ctrl+C check): $'
    msg_t3_r        DB 0Dh, 0Ah, '    You pressed: $'

    ; ---- 测试4: AH=0BH 检查键盘状态 ----
    msg_t4          DB '[4] AH=0BH  Check status', 0Dh, 0Ah
                    DB '    Checking... $'
    msg_t4_none     DB 'AL=00 (no key)', 0Dh, 0Ah, '$'
    msg_t4_has      DB 'AL=FF (key ready)', 0Dh, 0Ah, '$'

    ; ---- 测试5: AH=06H 非阻塞输入 ----
    msg_t5          DB '[5] AH=06H  DL=FFH non-blocking', 0Dh, 0Ah
                    DB '    Checking... $'
    msg_t5_zf1      DB 'ZF=1 (no key)', 0Dh, 0Ah, '$'
    msg_t5_zf0      DB 'ZF=0, key=$'
    msg_t5_wait     DB 0Dh, 0Ah
                    DB '    Now press a key: $'
    msg_t5_got      DB 0Dh, 0Ah, '    Got: $'

    ; ---- 测试6: AH=0AH 字符串输入 ----
    msg_t6          DB '[6] AH=0AH  Buffered string input', 0Dh, 0Ah
                    DB '    Type up to 16 chars, Enter:', 0Dh, 0Ah
                    DB '    > $'
    msg_t6_r        DB 0Dh, 0Ah, '    You entered: $'

    ; 字符串输入缓冲区
    inbuf           DB 16         ; 最大长度
                    DB ?          ; 实际长度
                    DB 16 DUP(?)  ; 字符数据

    ; ---- 结束 ----
    msg_end         DB 0Dh, 0Ah, '================================', 0Dh, 0Ah
                    DB ' All tests completed!', 0Dh, 0Ah
                    DB '================================', 0Dh, 0Ah, '$'

    ; 换行
    msg_crlf        DB 0Dh, 0Ah, '$'

.CODE
MAIN PROC
    MOV AX, @DATA
    MOV DS, AX

    ; ---- 显示标题 ----
    MOV AH, 09h
    LEA DX, msg_title
    INT 21h

    ; ================================================
    ; 测试1: AH=01H 带回显键盘输入（阻塞）
    ; 按键后字符自动回显到屏幕，AL=字符
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_t1
    INT 21h

    MOV AH, 01h        ; 阻塞等待，按键回显到屏幕
    INT 21h
    MOV BL, AL          ; 保存字符

    MOV AH, 09h
    LEA DX, msg_t1_r
    INT 21h
    MOV DL, BL
    MOV AH, 02h
    INT 21h

    MOV AH, 09h
    LEA DX, msg_sep
    INT 21h

    ; ================================================
    ; 测试2: AH=07H 无回显无过滤输入（阻塞）
    ; 按键后不回显，AL=字符
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_t2
    INT 21h

    MOV AH, 07h        ; 阻塞等待，不回显
    INT 21h
    MOV BL, AL

    MOV AH, 09h
    LEA DX, msg_t2_r
    INT 21h
    MOV DL, BL
    MOV AH, 02h
    INT 21h

    MOV AH, 09h
    LEA DX, msg_sep
    INT 21h

    ; ================================================
    ; 测试3: AH=08H 无回显有过滤输入（阻塞）
    ; 与07H类似，但会检查Ctrl+C
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_t3
    INT 21h

    MOV AH, 08h        ; 阻塞等待，不回显，检查Ctrl+C
    INT 21h
    MOV BL, AL

    MOV AH, 09h
    LEA DX, msg_t3_r
    INT 21h
    MOV DL, BL
    MOV AH, 02h
    INT 21h

    MOV AH, 09h
    LEA DX, msg_sep
    INT 21h

    ; ================================================
    ; 测试4: AH=0BH 检查键盘状态（非阻塞）
    ; 此时缓冲区应为空，预期 AL=00
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_t4
    INT 21h

    MOV AH, 0Bh        ; 非阻塞检查
    INT 21h

    CMP AL, 0FFh
    JE  T4_HAS_KEY

    MOV AH, 09h
    LEA DX, msg_t4_none
    INT 21h
    JMP T4_DONE

T4_HAS_KEY:
    MOV AH, 09h
    LEA DX, msg_t4_has
    INT 21h

T4_DONE:
    MOV AH, 09h
    LEA DX, msg_sep
    INT 21h

    ; ================================================
    ; 测试5: AH=06H DL=FFH 非阻塞输入
    ; 先检查缓冲区（预期ZF=1无键），
    ; 再用AH=01H阻塞等待一个键并用06H验证消费
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_t5
    INT 21h

    MOV AH, 06h
    MOV DL, 0FFh       ; DL=FF -> 输入模式
    INT 21h
    JZ  T5_NO_KEY       ; ZF=1 无按键

    ; 有按键（缓冲区残留）
    MOV BL, AL
    MOV AH, 09h
    LEA DX, msg_t5_zf0
    INT 21h
    MOV DL, BL
    MOV AH, 02h
    INT 21h
    MOV AH, 09h
    LEA DX, msg_crlf
    INT 21h
    JMP T5_DONE

T5_NO_KEY:
    MOV AH, 09h
    LEA DX, msg_t5_zf1
    INT 21h

    ; 阻塞等待一个键
    MOV AH, 09h
    LEA DX, msg_t5_wait
    INT 21h

    MOV AH, 01h
    INT 21h
    MOV BL, AL

    MOV AH, 09h
    LEA DX, msg_t5_got
    INT 21h
    MOV DL, BL
    MOV AH, 02h
    INT 21h

T5_DONE:
    MOV AH, 09h
    LEA DX, msg_sep
    INT 21h

    ; ================================================
    ; 测试6: AH=0AH 缓冲字符串输入（阻塞）
    ; 输入整行字符串，回车结束
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_t6
    INT 21h

    LEA DX, inbuf
    MOV AH, 0Ah
    INT 21h

    ; 在输入字符串末尾添加'$'
    XOR CX, CX
    MOV CL, [inbuf+1]      ; 实际输入长度
    LEA SI, [inbuf+2]       ; 字符串起始
    MOV BX, SI
    ADD BX, CX
    MOV BYTE PTR [BX], '$'

    ; 显示结果
    MOV AH, 09h
    LEA DX, msg_t6_r
    INT 21h

    MOV DX, SI
    MOV AH, 09h
    INT 21h

    ; ================================================
    ; 结束
    ; ================================================
    MOV AH, 09h
    LEA DX, msg_end
    INT 21h

    MOV AH, 4Ch
    INT 21h

MAIN ENDP
END MAIN
