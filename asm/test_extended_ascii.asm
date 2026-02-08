; 扩展 ASCII 字符测试程序
; 测试各种扩展 ASCII 字符（0x80-0xFF）的显示

.MODEL SMALL
.STACK 100H

.DATA
    ; 标题
    TITLE1 DB 'Extended ASCII Characters Test', 0DH, 0AH, '$'
    TITLE2 DB '=============================', 0DH, 0AH, '$'
    
    ; 分类标题
    LINE_DRAW  DB 'Line Drawing Characters:', 0DH, 0AH, '$'
    BLOCK_CHAR DB 'Block Characters:', 0DH, 0AH, '$'
    MATH_CHAR  DB 'Math Symbols:', 0DH, 0AH, '$'
    SPECIAL_MSG DB 'Special Symbols:', 0DH, 0AH, '$'
    SHADES     DB 'Shade Patterns:', 0DH, 0AH, '$'
    
    ; 行绘制字符表 (0xB0-0xDF)
    LINE_CHARS DB 0B0H, 0B1H, 0B2H, 0B3H, 0C4H, 0C5H, 0C6H, 0C7H
               DB 0C8H, 0C9H, 0CAH, 0CBH, 0CCH, 0CDH, 0CEH, 0CFH
               DB 0D0H, 0D1H, 0D2H, 0D3H, 0D4H, 0D5H, 0D6H, 0D7H
               DB 0D8H, 0D9H, 0DAH, 0DBH, 0DCH, 0DDH, 0DEH, 0DFH
    
    ; 方块字符表
    BLOCK_CHARS DB 0DBH, 0DCH, 0DDH, 0DEH, 0DFH, 0B0H, 0B1H, 0B2H
    
    ; 数学符号表
    MATH_SYMBOLS DB 0F0H, 0F1H, 0F2H, 0F3H, 0F4H, 0F5H, 0F6H, 0F7H
                 DB 0F8H, 0F9H, 0FAH, 0FBH, 0FCH, 0FDH, 0FEH, 0FFH
    
    ; 特殊符号表 (使用扩展 ASCII)
    SPECIAL_CHARS DB 0B0H, 0B1H, 0B2H, 0DBH, 0DCH, 0DDH, 0DEH, 0DFH
    
    ; 阴影图案表
    SHADE_CHARS DB 0B0H, 0B1H, 0B2H, 20H, 0DBH
    
    ; 所有扩展字符标题
    ALL_CHARS_MSG DB 0DH, 0AH, 'All Extended ASCII (0x80-0xFF):', 0DH, 0AH, '$'

.CODE
START:
    ; 初始化数据段
    MOV AX, @DATA
    MOV DS, AX
    
    ; ========== 打印标题 ==========
    CALL PRINT_TITLE
    
    ; ========== 测试1: 行绘制字符 ==========
    MOV AH, 09H
    LEA DX, LINE_DRAW
    INT 21H
    
    MOV CX, 32
    LEA SI, LINE_CHARS
    CALL PRINT_CHAR_TABLE
    CALL NEWLINE
    CALL NEWLINE
    
    ; ========== 测试2: 方块字符 ==========
    MOV AH, 09H
    LEA DX, BLOCK_CHAR
    INT 21H
    
    MOV CX, 8
    LEA SI, BLOCK_CHARS
    CALL PRINT_CHAR_TABLE
    CALL NEWLINE
    CALL NEWLINE
    
    ; ========== 测试3: 数学符号 ==========
    MOV AH, 09H
    LEA DX, MATH_CHAR
    INT 21H
    
    MOV CX, 16
    LEA SI, MATH_SYMBOLS
    CALL PRINT_CHAR_TABLE
    CALL NEWLINE
    CALL NEWLINE
    
    ; ========== 测试4: 特殊符号 ==========
    MOV AH, 09H
    LEA DX, SPECIAL_MSG
    INT 21H
    
    MOV CX, 8
    LEA SI, SPECIAL_CHARS
    CALL PRINT_CHAR_TABLE
    CALL NEWLINE
    CALL NEWLINE
    
    ; ========== 测试5: 阴影图案 ==========
    MOV AH, 09H
    LEA DX, SHADES
    INT 21H
    
    MOV CX, 5
    LEA SI, SHADE_CHARS
    CALL PRINT_CHAR_TABLE
    CALL NEWLINE
    CALL NEWLINE
    
    ; ========== 测试6: 所有扩展字符 (0x80-0xFF) ==========
    CALL PRINT_ALL_EXTENDED
    
    ; ========== 程序结束 ==========
    MOV AH, 4CH
    INT 21H

; ========== 子程序 ==========

; 打印标题
PRINT_TITLE:
    PUSH AX
    PUSH DX
    MOV AH, 09H
    LEA DX, TITLE1
    INT 21H
    LEA DX, TITLE2
    INT 21H
    POP DX
    POP AX
    RET

; 打印字符表
; 输入: CX = 字符数量, SI = 字符表地址
PRINT_CHAR_TABLE:
    PUSH AX
    PUSH CX
    PUSH BX
    MOV BX, SI            ; 使用 BX 保存地址
    
PRINT_LOOP:
    MOV DL, [BX]
    CALL PRINT_CHAR
    MOV DL, ' '           ; 空格分隔
    CALL PRINT_CHAR
    INC BX
    LOOP PRINT_LOOP
    
    POP BX
    POP CX
    POP AX
    RET

; 打印所有扩展 ASCII 字符 (0x80-0xFF)
PRINT_ALL_EXTENDED:
    PUSH AX
    PUSH CX
    PUSH DX
    PUSH BX
    
    ; 打印标题
    MOV AH, 09H
    LEA DX, ALL_CHARS_MSG
    INT 21H
    CALL NEWLINE          ; 先换一行
    
    ; 打印 0x80-0xFF
    MOV CX, 128           ; 128个字符 (0x80-0xFF)
    MOV BL, 80H           ; 从 0x80 开始，使用 BL 保存字符
    
PRINT_ALL_LOOP:
    ; 打印字符
    MOV DL, BL
    CALL PRINT_CHAR
    MOV DL, ' '
    CALL PRINT_CHAR
    
    INC BL                ; 下一个字符
    
    ; 每16个字符换行
    MOV AL, BL
    AND AL, 0FH           ; 检查低4位是否为0
    JNZ NO_NEWLINE
    CALL NEWLINE
NO_NEWLINE:
    
    LOOP PRINT_ALL_LOOP
    
    CALL NEWLINE
    POP BX
    POP DX
    POP CX
    POP AX
    RET

; 打印单个字符
PRINT_CHAR:
    PUSH AX
    MOV AH, 02H
    INT 21H
    POP AX
    RET

; 换行
NEWLINE:
    PUSH AX
    PUSH DX
    MOV AH, 02H
    MOV DL, 0DH
    INT 21H
    MOV DL, 0AH
    INT 21H
    POP DX
    POP AX
    RET

END START
