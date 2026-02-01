; 测试所有8086指令
.MODEL SMALL
.STACK 100H
.CODE
START:
    ; 数据传送指令
    MOV AX, BX
    MOV AX, 1234h
    MOV AL, 0FFh
    XCHG AX, BX
    PUSH AX
    POP BX
    PUSHF
    POPF
    LEA DX, MSG
    LDS SI, [BX]
    LES DI, [BX]
    IN AL, 60h
    IN AX, 60h
    IN AL, DX
    OUT 61h, AL
    OUT DX, AL

    ; 算术运算指令
    ADD AX, BX
    ADD AX, 1000h
    ADD AL, 10h
    ADC AX, CX
    ADC AL, 1
    SBB AX, BX
    SBB AL, 1
    INC AX
    INC AL
    DEC AX
    DEC AL
    NEG AX
    NEG AL
    MUL BX
    MUL BL
    IMUL BX
    IMUL BL
    DIV BX
    DIV BL
    IDIV BX
    IDIV BL
    AAA
    AAS
    DAA
    DAS
    AAM
    AAD

    ; 逻辑运算指令
    AND AL, 0Fh
    OR AL, 80h
    XOR AX, AX
    NOT AL
    TEST AL, 01h
    SHL AX, 1
    SHR AX, 1
    SAR AX, 1
    ROL AL, 1
    ROR AL, 1
    RCL AX, 1
    RCR AX, 1

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

    ; 控制转移指令
    JMP START
    CALL SUB1
    RET
    RETF

    ; 条件跳转
    CMP AX, 0
    JZ label1
    JNZ label2
    JC label3
    JNC label4
    JS label5
    JNS label6
    JO label7
    JNO label8
    JP label9
    JNP label10
    JL label11
    JNL label12
    JG label13
    JNG label14
    JA label15
    JNA label16
    LOOP loop1
    LOOPZ loop2
    LOOPNZ loop3
    JCXZ exit

    ; 处理器控制指令
    NOP
    HLT
    STC
    CLC
    CMC
    STD
    CLD
    STI
    CLI
    WAIT
    ESC 0, [BX]
    LOCK

    ; 其他指令
    XLAT
    ENTER 4, 0
    LEAVE

    ; 中断指令
    INT 21h
    INTO
    IRET

label1:
label2:
label3:
label4:
label5:
label6:
label7:
label8:
label9:
label10:
label11:
label12:
label13:
label14:
label15:
label16:

loop1:
loop2:
loop3:
    ; 子程序
SUB1:
    RET

exit:
    HLT

MSG DB 'Test$'

END START
