; ================================
; 模板2：标准EXE格式程序
; 适用于较复杂程序
; ================================
.MODEL SMALL         ; 小内存模型
.STACK 100H          ; 定义256字节堆栈（100H=256）

.DATA                ; 数据段开始
    ; 数据定义
    MSG  DB 'Hello, World!', '$'
    NUM  DW 1234H
    ARR  DB 10 DUP(5)  ; 10字节数组，初始为0

.CODE                ; 代码段开始
MAIN PROC FAR        ; 主过程（远程调用）
    ; 初始化段寄存器
    MOV AX, @DATA
    MOV DS, AX        ; DS指向数据段
    MOV ES, AX        ; ES也指向数据段（可选）
    
    ; ============ 你的代码从这里开始 ============
    
    ; 示例：显示字符串
    MOV AH, 09H       ; DOS功能：显示字符串
    LEA DX, MSG       ; DX=字符串地址
    INT 21H
    
    ; 示例：两数相加
    MOV AX, 100       ; AX=100
    ADD AX, 200       ; AX=300
    MOV NUM, AX       ; 存回变量
    
    ; ============ 你的代码到这里结束 ============
    
    ; 程序结束，返回DOS
    MOV AH, 4CH       ; DOS功能：程序终止
    INT 21H
MAIN ENDP

; 可以定义其他子程序
MYPROC PROC NEAR      ; 子过程（近调用）
    ; 子程序代码
    RET               ; 返回调用者
MYPROC ENDP

END MAIN              ; 指定程序入口
