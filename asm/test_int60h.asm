; 功能：将自定义程序加入INT 60H，调用后恢复原向量
STACK   SEGMENT STACK
        DW 100H DUP(0)
STACK   ENDS

DATA    SEGMENT
    MSG     DB '自定义中断程序执行！$'
    OLD_INT60 DW 0, 0  ; 保存原INT 60H向量（偏移+段地址）
DATA    ENDS

CODE    SEGMENT
ASSUME CS:CODE, DS:DATA

; ===================== 自定义中断服务程序 =====================
MY_ISR PROC
    ; 现场保护：保存用到的所有寄存器
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH DS

    ; 中断核心逻辑：显示提示信息
    MOV AX, DATA
    MOV DS, AX
    MOV AH, 09H
    LEA DX, MSG
    INT 21H

    ; 现场恢复：按保存顺序反向恢复
    POP DS
    POP DX
    POP CX
    POP BX
    POP AX

    IRET  ; 中断返回（必须！IRET会恢复CS:IP和FLAGS）
MY_ISR ENDP

; ===================== 设置中断向量 =====================
SET_INT PROC
    ; 步骤1：读取原INT 60H向量并保存
    MOV AH, 35H        ; DOS子功能：读取中断向量
    MOV AL, 60H        ; 要操作的中断号（60H是用户自定义安全号）
    INT 21H            ; 返回：ES=原段地址，BX=原偏移地址
    MOV OLD_INT60, BX  ; 保存偏移
    MOV OLD_INT60+2, ES; 保存段地址

    ; 步骤2：设置新的INT 60H向量（指向MY_ISR）
    MOV AH, 25H        ; DOS子功能：设置中断向量
    MOV AL, 60H        ; 中断号60H
    LEA DX, MY_ISR     ; DX=MY_ISR的偏移地址（CS段内）
    MOV DS, CS         ; DS=CS（MY_ISR在CS段）
    INT 21H            ; 执行后，IVT 60H项已更新为MY_ISR的地址

    RET
SET_INT ENDP

; ===================== 恢复原中断向量 =====================
RESTORE_INT PROC
    MOV AH, 25H        ; DOS子功能：设置中断向量
    MOV AL, 60H        ; 中断号60H
    LDS DX, OLD_INT60  ; DS:DX=原中断向量
    INT 21H            ; 恢复原向量

    RET
RESTORE_INT ENDP

; ===================== 主程序 =====================
START:
    MOV AX, DATA
    MOV DS, AX

    ; 步骤1：设置自定义中断向量
    CALL SET_INT

    ; 步骤2：调用自定义中断（INT 60H）
    INT 60H            ; CPU查IVT 60H项，跳转到MY_ISR执行

    ; 步骤3：恢复原中断向量（必须！否则退出后系统异常）
    CALL RESTORE_INT

    ; 退出程序
    MOV AH, 4CH
    INT 21H

CODE    ENDS
END START
