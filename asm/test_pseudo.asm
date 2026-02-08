; 测试新实现的伪指令
; ORG, DQ, DT, EVEN, LABEL, =, PROC/ENDP

.MODEL SMALL
.STACK 100H

.DATA
    ; 测试 ORG - 设置偏移地址
    ORG 100H
DATA_START LABEL BYTE
    
    ; 测试 EVEN - 偶地址对齐
    BYTE1 DB 1          ; 在 100H, 占用1字节
    EVEN                ; 当前地址101H是奇数, 对齐到102H
    WORD1 DW 1234H      ; 在 102H (偶地址)
    
    ; 测试 DQ - 定义四字（8字节）
    QWORD1 DQ 123456789ABCDEF0H
    QWORD2 DQ 5         ; 8字节零
    
    ; 测试 DT - 定义十字节（10字节）
    TBYTE1 DT 1234567890
    
    ; 测试 LABEL 定义不同类型
    WORD_ARRAY LABEL WORD
    BYTE_ARRAY DB 10 DUP(10)
    
    ; 测试 = (等号赋值)
    COUNT = 10
    SIZE = 20
    ; = 可以重新定义
    COUNT = 15

.CODE
START:
    ; 初始化数据段
    MOV AX, @DATA
    MOV DS, AX
    
    ; 测试代码
    MOV AX, WORD1       ; AX = 1234H
    
    ; 测试代码段的 EVEN - 地址对齐（不添加填充字节到内存）
    NOP                 ; 1字节指令，假设当前地址是奇数
    EVEN                ; 对齐到偶地址
    MOV BX, AX          ; 这条指令从偶地址开始
    
    ; 测试访问 DQ 数据
    MOV SI, OFFSET QWORD1
    MOV AX, [SI]        ; 读取低16位
    
    ; 使用 = 定义的常量
    MOV CX, COUNT       ; CX = 15 (重新定义后的值)
    
    ; 调用过程
    CALL DISPLAY_PROC
    
    ; 程序结束
    MOV AH, 4CH
    INT 21H

; 测试 PROC/ENDP
DISPLAY_PROC PROC NEAR
    PUSH AX
    MOV AH, 2
    MOV DL, 'b'
    INT 21H
    POP AX
    RET
DISPLAY_PROC ENDP

END START
