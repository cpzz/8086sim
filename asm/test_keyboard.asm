; 键盘输入测试程序
; 测试 INT 21h 的键盘相关功能

.MODEL SMALL
.STACK 100h

.DATA
    ; 消息定义
    msg_title       DB '=== DOS Keyboard Functions Test ===', 0Dh, 0Ah, '$'
    
    ; AH=01h 测试
    msg_ah01        DB 0Dh, 0Ah, '1. Test INT 21h AH=01h (Input with echo):', 0Dh, 0Ah
                    DB '   Press a key: $'
    msg_ah01_result DB 0Dh, 0Ah, '   You pressed: $'
    
    ; AH=07h 测试
    msg_ah07        DB 0Dh, 0Ah, '2. Test INT 21h AH=07h (Input without echo):', 0Dh, 0Ah
                    DB '   Press a key (no echo on screen): $'
    msg_ah07_result DB 0Dh, 0Ah, '   You pressed (now displayed): $'
    
    ; AH=06h 输出测试
    msg_ah06_out    DB 0Dh, 0Ah, '3. Test INT 21h AH=06h (Direct console output):', 0Dh, 0Ah
                    DB '   Characters: $'
    
    ; AH=06h 输入测试
    msg_ah06_in     DB 0Dh, 0Ah, '4. Test INT 21h AH=06h (Direct console input):', 0Dh, 0Ah
                    DB '   Press a key (non-blocking check): $'
    msg_ah06_nokey  DB '[No key pressed yet]', 0Dh, 0Ah
                    DB '   Press a key now: $'
    msg_ah06_gotkey DB '[Key detected!]', 0Dh, 0Ah
                    DB '   You pressed: $'
    
    ; AH=0Ah 测试
    msg_ah0a        DB 0Dh, 0Ah, '5. Test INT 21h AH=0Ah (String input):', 0Dh, 0Ah
                    DB '   Enter a string (max 20 chars, press Enter to finish):', 0Dh, 0Ah, '$'
    msg_ah0a_result DB 0Dh, 0Ah, '   You entered: $'
    
    ; 缓冲区定义
    ; 格式：第1字节=最大长度，第2字节=实际长度，第3字节起=字符串
    input_buffer    DB 20          ; 最大长度20
                    DB ?           ; 实际长度（由DOS填写）
                    DB 20 DUP(?)   ; 字符串缓冲区
    
    ; 结束消息
    msg_end         DB 0Dh, 0Ah, 0Dh, 0Ah, '=== Test Completed ===', 0Dh, 0Ah, '$'

.CODE
MAIN PROC
    ; 初始化数据段
    MOV AX, @DATA
    MOV DS, AX
    
    ; 显示标题
    MOV AH, 09h
    LEA DX, msg_title
    INT 21h
    
    ; ========== 测试 AH=01h: 带回显的键盘输入 ==========
    MOV AH, 09h
    LEA DX, msg_ah01
    INT 21h
    
    ; 等待键盘输入（带回显）
    MOV AH, 01h
    INT 21h
    ; 输入的字符在AL中
    MOV BL, AL          ; 保存输入的字符
    
    ; 显示结果
    MOV AH, 09h
    LEA DX, msg_ah01_result
    INT 21h
    
    MOV DL, BL
    MOV AH, 02h
    INT 21h
    
    ; ========== 测试 AH=07h: 无回显直接输入 ==========
    MOV AH, 09h
    LEA DX, msg_ah07
    INT 21h
    
    ; 等待键盘输入（不回显）
    MOV AH, 07h
    INT 21h
    ; 输入的字符在AL中
    MOV BL, AL          ; 保存输入的字符
    
    ; 显示结果（现在才显示）
    MOV AH, 09h
    LEA DX, msg_ah07_result
    INT 21h
    
    MOV DL, BL
    MOV AH, 02h
    INT 21h
    
    ; ========== 测试 AH=06h: 直接控制台输出 ==========
    MOV AH, 09h
    LEA DX, msg_ah06_out
    INT 21h
    
    ; 使用AH=06h输出字符
    MOV DL, 'A'
    MOV AH, 06h
    INT 21h
    
    MOV DL, 'B'
    MOV AH, 06h
    INT 21h
    
    MOV DL, 'C'
    MOV AH, 06h
    INT 21h
    
    ; ========== 测试 AH=06h: 直接控制台输入（非阻塞） ==========
    MOV AH, 09h
    LEA DX, msg_ah06_in
    INT 21h
    
    ; 第一次检查（可能没有按键）
    MOV DL, 0FFh        ; DL=0xFF表示输入模式
    MOV AH, 06h
    INT 21h
    
    ; 检查ZF标志
    JZ  AH06_WAIT       ; ZF=1表示无按键，等待用户按键
    
    ; 有按键，显示结果
    MOV BL, AL          ; 保存按键
    MOV AH, 09h
    LEA DX, msg_ah06_gotkey
    INT 21h
    
    MOV DL, BL
    MOV AH, 02h
    INT 21h
    
    JMP AH06_DONE
    
AH06_WAIT:
    ; 无按键，提示用户按键
    MOV AH, 09h
    LEA DX, msg_ah06_nokey
    INT 21h
    
    ; 等待用户按键（使用AH=01h阻塞等待）
    MOV AH, 01h
    INT 21h
    MOV BL, AL          ; 保存按键
    
    ; 显示结果
    MOV AH, 09h
    LEA DX, msg_ah06_gotkey
    INT 21h
    
    MOV DL, BL
    MOV AH, 02h
    INT 21h
    
AH06_DONE:
    
    ; ========== 测试 AH=0Ah: 字符串输入 ==========
    MOV AH, 09h
    LEA DX, msg_ah0a
    INT 21h
    
    ; 调用字符串输入功能
    LEA DX, input_buffer
    MOV AH, 0Ah
    INT 21h
    
    ; 显示结果
    MOV AH, 09h
    LEA DX, msg_ah0a_result
    INT 21h
    
    ; 显示输入的字符串
    ; 首先添加字符串结束符'$'
    XOR CX, CX
    MOV CL, [input_buffer+1]    ; 获取实际长度
    LEA SI, [input_buffer+2]    ; 指向字符串开始
    
    ; 在字符串末尾添加'$'
    MOV BX, SI
    ADD BX, CX
    MOV BYTE PTR [BX], '$'
    
    ; 显示字符串
    MOV DX, SI
    MOV AH, 09h
    INT 21h
    
    ; 显示换行
    MOV DL, 0Dh
    MOV AH, 02h
    INT 21h
    MOV DL, 0Ah
    MOV AH, 02h
    INT 21h
    
    ; ========== 结束 ==========
    MOV AH, 09h
    LEA DX, msg_end
    INT 21h
    
    ; 程序结束
    MOV AH, 4Ch
    INT 21h

MAIN ENDP
END MAIN
