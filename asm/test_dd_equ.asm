; 测试DD和EQU伪指令
.MODEL SMALL
.STACK 100h

.DATA
    ; 数据定义测试
    byte_val    DB 12h           ; 字节
    word_val    DW 1234h         ; 字
    dword_val   DD 12345678h     ; 双字 - 4字节
    dword2      DD 0AABBCCDDh    ; 另一个双字
    
    ; 常量定义测试
    MAX_SIZE    EQU 100
    PORT        EQU 3F8h
    CR          EQU 0Dh
    LF          EQU 0Ah

.CODE
main PROC
    MOV AX, @DATA
    MOV DS, AX
    
    ; 使用EQU常量
    MOV CX, MAX_SIZE             ; CX = 0064h (100)
    MOV DX, PORT                 ; DX = 03F8h
    MOV AL, CR                   ; AL = 0Dh
    MOV BL, LF                   ; BL = 0Ah
    
    ; 测试完成
    MOV AH, 4Ch
    INT 21h
main ENDP

END main