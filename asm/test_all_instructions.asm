; 8086指令集全面测试文件
; 测试各种指令的功能，并在注释中给出执行结果
; 16进制数字母使用大写

; 数据段定义
.MODEL SMALL
.STACK 100h

.DATA
    ; 数据定义测试
    BYTE_VAL    DB 12h           ; 单个字节
    WORD_VAL    DW 1234h         ; 一个字
    DWORD_VAL   DD 12345678h     ; 双字
    STRING      DB 'HELLO$'      ; 字符串
    ARRAY       DB 1,2,3,4,5     ; 数组
    BUFFER      DB 10 DUP(0)     ; 10个0
    UNINIT      DB ?             ; 未初始化
    
    ; 常量定义
    MAX_SIZE    EQU 100
    PORT        EQU 3F8h
    CR          EQU 0Dh
    LF          EQU 0Ah
    EOS         EQU '$'

.CODE
MAIN PROC
    MOV AX, @DATA                ; AX = 数据段地址
    MOV DS, AX                   ; DS = AX，设置数据段寄存器
    
    ; ==================== 数据传送指令测试 ====================
    
    ; MOV指令测试
    MOV AX, 1234h                ; AX = 1234h
    MOV BX, AX                   ; BX = 1234h
    MOV CX, [WORD_VAL]           ; CX = 1234h
    MOV [BUFFER], AL             ; BUFFER[0] = 34h
    
    ; XCHG指令测试
    XCHG AX, BX                  ; AX = 1234h, BX = 1234h (交换后不变)
    MOV AX, 5678h                ; AX = 5678h
    XCHG AX, BX                  ; AX = 1234h, BX = 5678h
    
    ; PUSH/POP指令测试
    PUSH AX                      ; 栈: [1234h]
    PUSH BX                      ; 栈: [5678h, 1234h]
    POP CX                       ; CX = 5678h, 栈: [1234h]
    POP DX                       ; DX = 1234h, 栈: 空
    
    ; PUSHF/POPF指令测试
    PUSHF                        ; 标志寄存器入栈
    POPF                         ; 标志寄存器出栈
    
    ; LEA指令测试
    LEA SI, STRING               ; SI = STRING的偏移地址
    
    ; ==================== 算术运算指令测试 ====================
    
    ; ADD指令测试
    MOV AX, 1234h                ; AX = 1234h
    ADD AX, 5678h                ; AX = 68ACH
    ADD AX, 1                    ; AX = 68ADh
    
    ; ADC指令测试
    STC                          ; CF = 1
    MOV AX, 0FFFFh               ; AX = FFFFh
    ADC AX, 0                    ; AX = 0000h, CF = 1
    
    ; INC指令测试
    MOV CX, 0                    ; CX = 0000h
    INC CX                       ; CX = 0001h
    INC CX                       ; CX = 0002h
    
    ; SUB指令测试
    MOV AX, 5678h                ; AX = 5678h
    SUB AX, 1234h                ; AX = 4444h
    
    ; SBB指令测试
    STC                          ; CF = 1
    MOV AX, 1234h                ; AX = 1234h
    SBB AX, 5678h                ; AX = BBBAh, CF = 1
    
    ; DEC指令测试
    MOV CX, 5                    ; CX = 0005h
    DEC CX                       ; CX = 0004h
    
    ; NEG指令测试
    MOV AX, 0005h                ; AX = 0005h
    NEG AX                       ; AX = FFFBh (补码表示-5)
    
    ; CMP指令测试
    MOV AL, 10                   ; AL = 0Ah
    CMP AL, 5                    ; 设置标志位：ZF=0, CF=0, SF=0
    CMP AL, 10                   ; 设置标志位：ZF=1
    CMP AL, 15                   ; 设置标志位：ZF=0, CF=1, SF=1
    
    ; MUL指令测试
    MOV AL, 10h                  ; AL = 10h
    MOV BL, 20h                  ; BL = 20h
    MUL BL                       ; AX = 200h
    
    ; DIV指令测试
    MOV AX, 100h                 ; AX = 100h
    MOV BL, 10h                  ; BL = 10h
    DIV BL                       ; AL = 10h (商), AH = 00h (余数)
    
    ; ==================== 逻辑运算指令测试 ====================
    
    ; AND指令测试
    MOV AX, 1234h                ; AX = 1234h
    AND AX, 0F0Fh                ; AX = 1030h
    
    ; OR指令测试
    MOV AX, 1234h                ; AX = 1234h
    OR AX, 0F0Fh                 ; AX = 1F3Fh
    
    ; XOR指令测试
    MOV AX, 1234h                ; AX = 1234h
    XOR AX, AX                   ; AX = 0000h (清零)
    
    ; NOT指令测试
    MOV AX, 0FFFFh               ; AX = FFFFh
    NOT AX                       ; AX = 0000h
    
    ; TEST指令测试
    MOV AL, 12h                  ; AL = 12h
    TEST AL, 01h                 ; 设置标志位：ZF=1 (无最低位)
    TEST AL, 10h                 ; 设置标志位：ZF=0 (有第4位)
    
    ; 移位指令测试
    MOV AX, 0001h                ; AX = 0001h
    SHL AX, 1                    ; AX = 0002h
    SHL AX, 1                    ; AX = 0004h
    SHR AX, 1                    ; AX = 0002h
    
    ; 循环移位指令测试
    MOV AL, 80h                  ; AL = 80h
    ROL AL, 1                    ; AL = 01h, CF = 1
    ROR AL, 1                    ; AL = 80h, CF = 1
    
    ; ==================== 控制转移指令测试 ====================
    
    ; JMP指令测试
    JMP SHORT LABEL1             ; 跳转到LABEL1
    
LABEL2:
    MOV AX, 1111h                ; 不会执行到这里
    
LABEL1:
    MOV AX, 2222h                ; AX = 2222h
    
    ; 条件跳转测试
    MOV AX, 10
    CMP AX, 10
    JZ EQUAL_LABEL               ; ZF=1，跳转到EQUAL_LABEL
    JMP NOT_EQUAL_LABEL          ; 不会执行到这里
    
NOT_EQUAL_LABEL:
    MOV BX, 0                    ; 不会执行到这里
    
EQUAL_LABEL:
    MOV BX, 1                    ; BX = 0001h
    
    ; LOOP指令测试
    MOV CX, 5                    ; CX = 0005h
LOOP_TEST:
    NOP                          ; 空操作
    LOOP LOOP_TEST               ; CX减1，CX≠0则循环，最终CX=0
    
    ; ==================== 串操作指令测试 ====================
    
    ; 串操作准备
    CLD                          ; 方向标志DF=0，正向
    LEA SI, STRING               ; SI指向源串
    LEA DI, BUFFER               ; DI指向目标串
    MOV CX, 5                    ; CX=5，串长度
    
    ; MOVSB指令测试
    REP MOVSB                    ; 将STRING的前5字节复制到BUFFER
    
    ; ==================== 处理器控制指令测试 ====================
    
    ; 标志操作指令
    CLC                          ; CF=0，清进位标志
    STC                          ; CF=1，置进位标志
    CMC                          ; CF取反，变为0
    
    CLD                          ; DF=0，清方向标志
    STD                          ; DF=1，置方向标志
    CLD                          ; DF=0，恢复默认
    
    CLI                          ; IF=0，关中断
    STI                          ; IF=1，开中断
    
    ; NOP指令测试
    NOP                          ; 空操作
    NOP                          ; 空操作
    
    ; ==================== 程序结束 ====================
    
    MOV AH, 4Ch                  ; 功能号4Ch，退出程序
    MOV AL, 00h                  ; 返回码0
    INT 21h                      ; 调用DOS中断
    
MAIN ENDP

END MAIN
