; 测试寄存器标志位
; 测试CF（进位/借位标志）
; 预期结果：CF=1, 输出"CF=1"

CODE SEGMENT
    ASSUME CS:CODE, DS:DATA

START:
    MOV AX, @DATA
    MOV DS, AX

    ; 测试1：加法进位 (0xFF + 0x01 = 0x100, CF=1)
    MOV AL, 0FFH
    ADD AL, 01H
    JB CF_SET_1      ; CF=1，应该跳转
    MOV AH, 09H
    LEA DX, MSG_CF_0
    INT 21H
    JMP TEST_DONE

CF_SET_1:
    MOV AH, 09H
    LEA DX, MSG_CF_1
    INT 21H

    ; 测试2：减法借位 (0x01 - 0x02 = 0xFF, CF=1)
    MOV AL, 01H
    SUB AL, 02H
    JB CF_SET_2      ; CF=1，应该跳转
    MOV AH, 09H
    LEA DX, MSG_CF_0_2
    INT 21H
    JMP TEST_ZF

CF_SET_2:
    MOV AH, 09H
    LEA DX, MSG_CF_1_2
    INT 21H

    ; 测试3：无进位 (0x01 + 0x01 = 0x02, CF=0)
    MOV AL, 01H
    ADD AL, 01H
    JAE CF_NOT_SET   ; CF=0，应该跳转
    MOV AH, 09H
    LEA DX, MSG_CF_1_3
    INT 21H
    JMP TEST_ZF

CF_NOT_SET:
    MOV AH, 09H
    LEA DX, MSG_CF_0_3
    INT 21H

    ; 测试4：无借位 (0x02 - 0x01 = 0x01, CF=0)
    MOV AL, 02H
    SUB AL, 01H
    JAE CF_NOT_SET_2  ; CF=0，应该跳转
    MOV AH, 09H
    LEA DX, MSG_CF_1_4
    INT 21H
    JMP TEST_ZF

CF_NOT_SET_2:
    MOV AH, 09H
    LEA DX, MSG_CF_0_4
    INT 21H

TEST_ZF:
    ; 测试5：零标志 (0x01 - 0x01 = 0x00, ZF=1)
    MOV AL, 01H
    SUB AL, 01H
    JZ ZF_SET       ; ZF=1，应该跳转
    MOV AH, 09H
    LEA DX, MSG_ZF_0
    INT 21H
    JMP TEST_SF

ZF_SET:
    MOV AH, 09H
    LEA DX, MSG_ZF_1
    INT 21H

    ; 测试6：非零标志 (0x01 - 0x00 = 0x01, ZF=0)
    MOV AL, 01H
    SUB AL, 00H
    JNZ ZF_NOT_SET   ; ZF=0，应该跳转
    MOV AH, 09H
    LEA DX, MSG_ZF_1_2
    INT 21H
    JMP TEST_SF

ZF_NOT_SET:
    MOV AH, 09H
    LEA DX, MSG_ZF_0_2
    INT 21H

TEST_SF:
    ; 测试7：符号标志 (0x80 - 0x01 = 0x7F, SF=0)
    MOV AL, 80H
    SUB AL, 01H
    JNS SF_NOT_SET   ; SF=0，应该跳转
    MOV AH, 09H
    LEA DX, MSG_SF_1
    INT 21H
    JMP TEST_OF

SF_NOT_SET:
    MOV AH, 09H
    LEA DX, MSG_SF_0
    INT 21H

    ; 测试8：符号标志 (0x7F + 0x01 = 0x80, SF=1)
    MOV AL, 7FH
    ADD AL, 01H
    JS SF_SET       ; SF=1，应该跳转
    MOV AH, 09H
    LEA DX, MSG_SF_0_2
    INT 21H
    JMP TEST_OF

SF_SET:
    MOV AH, 09H
    LEA DX, MSG_SF_1_2
    INT 21H

TEST_OF:
    ; 测试9：溢出标志 (0x7F + 0x01 = 0x80, OF=1)
    MOV AL, 7FH
    ADD AL, 01H
    JO OF_SET       ; OF=1，应该跳转
    MOV AH, 09H
    LEA DX, MSG_OF_0
    INT 21H
    JMP TEST_DONE

OF_SET:
    MOV AH, 09H
    LEA DX, MSG_OF_1
    INT 21H

TEST_DONE:
    MOV AH, 4CH
    INT 21H

CODE ENDS

DATA SEGMENT
    MSG_CF_1      DB 'CF=1 (进位/借位)', 0DH, 0AH, '$'
    MSG_CF_0      DB 'CF=0 (无进位/借位)', 0DH, 0AH, '$'
    MSG_CF_1_2    DB 'CF=1 (借位)', 0DH, 0AH, '$'
    MSG_CF_0_2    DB 'CF=0 (无借位)', 0DH, 0AH, '$'
    MSG_CF_1_3    DB 'CF=1 (进位)', 0DH, 0AH, '$'
    MSG_CF_0_3    DB 'CF=0 (无进位)', 0DH, 0AH, '$'
    MSG_CF_1_4    DB 'CF=1 (借位)', 0DH, 0AH, '$'
    MSG_CF_0_4    DB 'CF=0 (无借位)', 0DH, 0AH, '$'
    MSG_ZF_1      DB 'ZF=1 (结果为零)', 0DH, 0AH, '$'
    MSG_ZF_0      DB 'ZF=0 (结果非零)', 0DH, 0AH, '$'
    MSG_ZF_1_2    DB 'ZF=1 (结果非零)', 0DH, 0AH, '$'
    MSG_ZF_0_2    DB 'ZF=0 (结果为零)', 0DH, 0AH, '$'
    MSG_SF_0      DB 'SF=0 (正数)', 0DH, 0AH, '$'
    MSG_SF_1      DB 'SF=1 (负数)', 0DH, 0AH, '$'
    MSG_SF_0_2    DB 'SF=0 (正数)', 0DH, 0AH, '$'
    MSG_SF_1_2    DB 'SF=1 (负数)', 0DH, 0AH, '$'
    MSG_OF_0      DB 'OF=0 (无溢出)', 0DH, 0AH, '$'
    MSG_OF_1      DB 'OF=1 (溢出)', 0DH, 0AH, '$'
DATA ENDS

END START
