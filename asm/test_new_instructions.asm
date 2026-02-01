; 测试新增的8086指令
.MODEL SMALL
.STACK 100H
.CODE
START:
    ; 数据传送指令
    PUSHF
    POPF
    LDS SI, [BX]
    LES DI, [BX]
    IN AL, 60h
    IN AX, 60h
    IN AL, DX
    IN AX, DX
    OUT 61h, AL
    OUT 61h, AX
    OUT DX, AL
    OUT DX, AX

    ; 串操作指令
    MOVSB
    MOVSW
    CMPSB
    CMPSW
    SCASB
    SCASW
    LODSB
    LODSW
    STOSB
    STOSW
    REP MOVSB
    REPZ CMPSB
    REPE SCASB
    REPNE STOSW
    REPNZ LODSW

    ; 条件跳转指令 (JG/JNLE, JNG/JLE 已在之前实现，这里测试别名)
    JG label1
    JNLE label1
    JNG label2
    JLE label2
    JB label3
    JC label3
    JNAE label3
    JNB label4
    JNC label4
    JAE label4

    ; 处理器控制指令
    WAIT
    ESC 0, [BX]
    LOCK

    ; 其他指令
    XLAT
    ENTER 4, 0
    LEAVE

label1:
label2:
label3:
label4:

    HLT
END START
