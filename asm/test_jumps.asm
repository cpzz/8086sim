; 全面测试所有条件跳转指令
; 测试有符号和无符号比较的跳转

.MODEL SMALL
.STACK 100H

.DATA
    MSG_EQUAL   DB 'EQ ', 0DH, 0AH, '$'  ; JZ/JE 测试通过
    MSG_NOTEQ   DB 'NE ', 0DH, 0AH, '$'  ; JNZ/JNE 测试通过
    MSG_LESS    DB 'LT ', 0DH, 0AH, '$'  ; JL/JB 测试通过
    MSG_GTE     DB 'GE ', 0DH, 0AH, '$'  ; JGE/JAE 测试通过
    MSG_GT      DB 'GT ', 0DH, 0AH, '$'  ; JG/JA 测试通过
    MSG_LTE     DB 'LE ', 0DH, 0AH, '$'  ; JLE/JBE 测试通过
    MSG_PASS    DB 'PASS', 0DH, 0AH, '$'
    MSG_DONE    DB 'DONE', 0DH, 0AH, '$'

.CODE
START:
    MOV AX, @DATA
    MOV DS, AX
    
    ; ========== 测试1: JZ/JE (等于) ==========
    MOV AX, 5
    CMP AX, 5
    JZ TEST_JZ_PASS
    JMP TEST_JZ_FAIL
TEST_JZ_PASS:
    MOV DX, OFFSET MSG_EQUAL
    CALL PRINT_STRING
    JMP TEST1_DONE
TEST_JZ_FAIL:
    MOV DX, OFFSET MSG_NOTEQ
    CALL PRINT_STRING
TEST1_DONE:

    ; ========== 测试2: JNZ/JNE (不等于) ==========
    MOV AX, 5
    CMP AX, 3
    JNZ TEST_JNZ_PASS
    JMP TEST_JNZ_FAIL
TEST_JNZ_PASS:
    MOV DX, OFFSET MSG_NOTEQ
    CALL PRINT_STRING
    JMP TEST2_DONE
TEST_JNZ_FAIL:
    MOV DX, OFFSET MSG_EQUAL
    CALL PRINT_STRING
TEST2_DONE:

    ; ========== 测试3: JL/JB (小于) ==========
    MOV AX, 3
    CMP AX, 5
    JL TEST_JL_PASS
    JMP TEST_JL_FAIL
TEST_JL_PASS:
    MOV DX, OFFSET MSG_LESS
    CALL PRINT_STRING
    JMP TEST3_DONE
TEST_JL_FAIL:
    MOV DX, OFFSET MSG_GTE
    CALL PRINT_STRING
TEST3_DONE:

    ; ========== 测试4: JGE/JAE (大于等于) ==========
    MOV AX, 5
    CMP AX, 3
    JGE TEST_JGE_PASS
    JMP TEST_JGE_FAIL
TEST_JGE_PASS:
    MOV DX, OFFSET MSG_GTE
    CALL PRINT_STRING
    JMP TEST4_DONE
TEST_JGE_FAIL:
    MOV DX, OFFSET MSG_LESS
    CALL PRINT_STRING
TEST4_DONE:

    ; ========== 测试5: JG/JA (大于) ==========
    MOV AX, 7
    CMP AX, 5
    JG TEST_JG_PASS
    JMP TEST_JG_FAIL
TEST_JG_PASS:
    MOV DX, OFFSET MSG_GT
    CALL PRINT_STRING
    JMP TEST5_DONE
TEST_JG_FAIL:
    MOV DX, OFFSET MSG_LTE
    CALL PRINT_STRING
TEST5_DONE:

    ; ========== 测试6: JLE/JBE (小于等于) ==========
    MOV AX, 5
    CMP AX, 7
    JLE TEST_JLE_PASS
    JMP TEST_JLE_FAIL
TEST_JLE_PASS:
    MOV DX, OFFSET MSG_LTE
    CALL PRINT_STRING
    JMP TEST6_DONE
TEST_JLE_FAIL:
    MOV DX, OFFSET MSG_GT
    CALL PRINT_STRING
TEST6_DONE:

    ; ========== 测试7: 循环中的跳转 ==========
    MOV CX, 3
LOOP_TEST:
    MOV DX, OFFSET MSG_PASS
    CALL PRINT_STRING
    
    LOOP LOOP_TEST
    
    ; ========== 完成 ==========
    MOV DX, OFFSET MSG_DONE
    CALL PRINT_STRING
    
    MOV AH, 4CH
    INT 21H

; 打印字符串子程序
PRINT_STRING:
    PUSH AX
    MOV AH, 09H
    INT 21H
    POP AX
    RET

END START