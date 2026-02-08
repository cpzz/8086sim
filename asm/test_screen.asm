; 屏幕输出测试程序
; 测试 INT 21H 的各种输出功能

.MODEL SMALL
.STACK 100H

.DATA
    ; 字符串输出测试
    MSG1 DB 'Hello, World!', 0DH, 0AH, '$'
    MSG2 DB 'This is a test message.', 0DH, 0AH, '$'
    MSG3 DB 'Press any key to continue...', '$'

.CODE
START:
    ; 初始化数据段
    MOV AX, @DATA
    MOV DS, AX
    
    ; ========== 测试1: 单个字符输出 ==========
    ; 使用 INT 21H AH=02H 输出单个字符
    MOV AH, 02H
    MOV DL, 'A'
    INT 21H
    
    MOV DL, 'B'
    INT 21H
    
    MOV DL, 'C'
    INT 21H
    
    ; 输出换行
    MOV DL, 0DH  ; 回车
    INT 21H
    MOV DL, 0AH  ; 换行
    INT 21H
    
    ; ========== 测试2: 字符串输出 ==========
    ; 使用 INT 21H AH=09H 输出字符串
    MOV AH, 09H
    LEA DX, MSG1
    INT 21H
    
    MOV AH, 09H
    LEA DX, MSG2
    INT 21H
    
    ; ========== 测试3: 数字输出 ==========
    ; 输出数字 0-9
    MOV CX, 10
    MOV DL, '0'
    
PRINT_NUM:
    MOV AH, 02H
    INT 21H
    INC DL
    LOOP PRINT_NUM
    
    ; 换行
    MOV DL, 0DH
    INT 21H
    MOV DL, 0AH
    INT 21H
    
    ; ========== 测试4: 等待按键 ==========
    MOV AH, 09H
    LEA DX, MSG3
    INT 21H
    
    ; 等待按键 (INT 21H AH=07H)
    MOV AH, 07H
    INT 21H
    
    ; 输出按下的键
    MOV DL, AL
    MOV AH, 02H
    INT 21H
    
    ; 换行
    MOV DL, 0DH
    INT 21H
    MOV DL, 0AH
    INT 21H
    
    ; ========== 程序结束 ==========
    MOV AH, 4CH
    INT 21H

END START
