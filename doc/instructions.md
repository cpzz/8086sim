8086汇编指令格式详解

一、8086指令的基本格式

8086汇编指令的一般格式为：

[标号:] 操作码 [操作数1 [, 操作数2]] [;注释]


二、指令长度分类

1. 单字节指令

NOP        ; 无操作
XLAT       ; 查表转换
AAA        ; ASCII加法调整


2. 双字节指令

INC CX     ; 寄存器加1
DEC AL     ; 寄存器减1
PUSH AX    ; 入栈


3. 三字节指令

MOV AX, 1234H  ; 立即数传送到寄存器
ADD BX, 5678H  ; 立即数加法


4. 四字节及更多字节指令

MOV AX, [BX+SI+1234H]  ; 带位移的基址变址寻址


三、操作数寻址方式

1. 立即寻址

MOV AX, 1234H    ; 立即数 → AX
ADD BL, 5        ; 立即数加法
CMP CX, 100      ; 与立即数比较


2. 寄存器寻址

MOV AX, BX       ; 寄存器 → 寄存器
ADD AL, CL       ; 寄存器加法
INC SI           ; 寄存器自增


3. 直接寻址

MOV AX, [2000H]  ; 内存单元 → 寄存器
MOV [1000H], BX  ; 寄存器 → 内存单元


4. 寄存器间接寻址

使用BX、BP、SI、DI：
MOV AX, [BX]     ; DS:[BX] → AX
MOV [SI], CL     ; CL → DS:[SI]
MOV AX, [BP]     ; SS:[BP] → AX


5. 寄存器相对寻址

MOV AX, [BX+10]  ; DS:[BX+10] → AX
MOV CL, [SI+5]   ; DS:[SI+5] → CL
MOV [BP-4], DX   ; DX → SS:[BP-4]


6. 基址变址寻址

MOV AX, [BX+SI]  ; DS:[BX+SI] → AX
MOV [BP+DI], CX  ; CX → SS:[BP+DI]


7. 相对基址变址寻址

MOV AX, [BX+SI+10]  ; DS:[BX+SI+10] → AX
MOV [BP+DI-5], DL   ; DL → SS:[BP+DI-5]


四、主要指令类别及格式

1. 数据传送指令

MOV - 传送

MOV dest, src     ; src → dest
; 格式限制：两者不能同时为内存操作数
MOV AX, BX        ; 合法
MOV [DI], AX      ; 合法
MOV DS, AX        ; 段寄存器操作


PUSH/POP - 堆栈操作

PUSH src          ; SP-2, src → [SS:SP]
POP dest          ; [SS:SP] → dest, SP+2
PUSH AX
POP BX


XCHG - 交换

XCHG op1, op2     ; 交换op1和op2
XCHG AX, BX       ; 寄存器交换
XCHG AL, [SI]     ; 寄存器和内存交换


2. 算术运算指令

ADD/ADC - 加法/带进位加法

ADD dest, src     ; dest ← dest + src
ADC dest, src     ; dest ← dest + src + CF
ADD AX, CX
ADC WORD PTR [BX], 5


SUB/SBB - 减法/带借位减法

SUB dest, src     ; dest ← dest - src
SBB dest, src     ; dest ← dest - src - CF
SUB AL, 10
SBB WORD PTR [DI], AX


MUL/IMUL - 乘法

MUL src           ; 无符号乘法: AX ← AL×src 或 DX:AX ← AX×src
IMUL src          ; 有符号乘法
MUL BL            ; AL×BL → AX
IMUL WORD PTR [BX] ; AX×[BX] → DX:AX


DIV/IDIV - 除法

DIV src           ; 无符号除法
IDIV src          ; 有符号除法
DIV CL            ; AX÷CL → AL(商), AH(余)


3. 逻辑运算指令

AND/OR/XOR/NOT

AND dest, src     ; 逻辑与
OR  dest, src     ; 逻辑或
XOR dest, src     ; 异或
NOT dest          ; 取反
AND AX, 00FFH
XOR BX, BX        ; BX清零


TEST - 测试

TEST dest, src    ; dest AND src, 只影响标志
TEST AL, 80H      ; 测试最高位


4. 移位指令

SHL/SHR - 逻辑左移/右移

SHL dest, count   ; 逻辑左移
SHR dest, count   ; 逻辑右移
SHL AX, 1
SHR BL, CL        ; CL存放移位次数


SAL/SAR - 算术左移/右移

SAL dest, count   ; 同SHL
SAR dest, count   ; 算术右移(保持符号)
SAR BYTE PTR [SI], 1


ROL/ROR - 循环左移/右移

ROL dest, count   ; 循环左移
ROR dest, count   ; 循环右移
ROL DH, 1


5. 转移指令

JMP - 无条件转移

JMP label         ; 直接转移
JMP BX            ; 寄存器间接转移
JMP WORD PTR [BX] ; 内存间接转移
JMP FAR PTR label ; 段间转移


条件转移

JZ  label         ; ZF=1时转移
JNZ label         ; ZF=0时转移
JC  label         ; CF=1时转移
JA  label         ; 高于转移(无符号)
JG  label         ; 大于转移(有符号)


循环指令

LOOP label        ; CX-1, 若CX≠0则转移
LOOPZ label       ; CX-1, 若CX≠0且ZF=1则转移
LOOPNZ label      ; CX-1, 若CX≠0且ZF=0则转移


6. 串操作指令

MOVSB/MOVSW - 串传送

MOVSB            ; [DS:SI] → [ES:DI], 修改SI/DI
MOVSW            ; 传送字
REP MOVSB        ; 重复传送


CMPSB/CMPSW - 串比较

CMPSB            ; [DS:SI] - [ES:DI], 修改SI/DI
REPZ CMPSB       ; 相等时继续比较


SCASB/SCASW - 串扫描

SCASB            ; AL - [ES:DI], 修改DI
REPNZ SCASB      ; 不相等时继续扫描


7. 处理器控制指令

标志操作

STC              ; CF ← 1
CLC              ; CF ← 0
STD              ; DF ← 1 (地址递减)
CLD              ; DF ← 0 (地址递增)
STI              ; IF ← 1 (开中断)
CLI              ; IF ← 0 (关中断)


五、指令前缀

1. 段超越前缀

ES: MOV AL, [BX]   ; ES段
CS: JMP label      ; CS段
SS: MOV AX, [BP]   ; SS段
DS: MOV [DI], AX   ; DS段


2. 重复前缀

REP MOVSB         ; 重复执行
REPZ CMPSB        ; 为零/相等时重复
REPNZ SCASB       ; 不为零/不相等时重复


3. 锁定前缀

LOCK XCHG AL, [BX] ; 锁定总线


六、操作数类型说明

1. 数据类型

BYTE PTR [BX]     ; 字节类型
WORD PTR [SI]     ; 字类型
DWORD PTR [DI]    ; 双字类型


2. 段间操作

JMP FAR PTR label      ; 段间直接转移
JMP DWORD PTR [BX]     ; 段间间接转移
CALL FAR PTR procedure ; 段间调用


七、指令编码结构

8086指令的一般编码格式：

[前缀] [操作码] [寻址方式字节] [位移量] [立即数]


示例分析：

MOV AX, [BX+SI+1234H]
; 编码格式：
; 操作码: 1000101w
; MOD-REG-R/M: 00-000-000
; 位移量低8位: 34H
; 位移量高8位: 12H


八、注意事项

1. 操作数方向：目标操作数在前，源操作数在后
2. 类型匹配：操作数类型必须一致
3. 段寄存器限制：段寄存器不能直接与立即数传送
4. 标志影响：大部分指令会影响标志寄存器
5. 寻址限制：某些寻址方式只能用于特定寄存器

九、完整示例

DATA SEGMENT
    ARRAY DW 10 DUP(?)
    COUNT EQU 10
DATA ENDS

CODE SEGMENT
    ASSUME CS:CODE, DS:DATA
    
START:
    MOV AX, DATA
    MOV DS, AX           ; 初始化DS
    
    MOV CX, COUNT        ; 设置循环次数
    MOV SI, OFFSET ARRAY ; SI指向数组
    XOR AX, AX           ; 清AX用于求和
    
SUM_LOOP:
    ADD AX, [SI]         ; 累加
    ADD SI, 2            ; 指向下一个字
    LOOP SUM_LOOP        ; 循环
    
    MOV AH, 4CH          ; 程序结束
    INT 21H
CODE ENDS
END START


这个详细说明涵盖了8086汇编指令的主要格式和参数形式，包括各种寻址方式、指令类别和实际使用示例。