8086汇编指令全集（按功能分类）

8086指令集包含约100条基本指令，是现代x86指令集的基础。以下是完整分类：

一、数据传送指令（Data Transfer）

1. 通用数据传送

指令 格式 功能 示例

MOV MOV 目标, 源 传送数据 MOV AX, BX

XCHG XCHG 操作数1, 操作数2 交换数据 XCHG AX, BX

PUSH PUSH 源 压栈 PUSH AX

POP POP 目标 出栈 POP BX

PUSHF PUSHF 标志寄存器压栈 PUSHF

POPF POPF 标志寄存器出栈 POPF

2. 地址传送
指令 格式 功能 示例

LEA LEA 目标, 源 取有效地址 LEA DX, MSG

LDS LDS 目标, 源 取指针到DS:reg LDS SI, [BX]

LES LES 目标, 源 取指针到ES:reg LES DI, [BX]
3. 输入输出
指令 格式 功能 示例

IN IN 累加器, 端口 输入 IN AL, 60h

OUT OUT 端口, 累加器 输出 OUT 61h, AL

二、算术运算指令（Arithmetic）

1. 加法

指令 格式 功能 示例

ADD ADD 目标, 源 加法 ADD AX, BX

ADC ADC 目标, 源 带进位加法 ADC AX, CX

INC INC 目标 加1 INC AX

AAA AAA ASCII加法调整 AAA

DAA DAA 十进制加法调整 DAA
2. 减法
指令 格式 功能 示例

SUB SUB 目标, 源 减法 SUB AX, 10

SBB SBB 目标, 源 带借位减法 SBB AX, BX

DEC DEC 目标 减1 DEC CX

NEG NEG 目标 求补（取负） NEG AX

CMP CMP 目标, 源 比较 CMP AL, 0

AAS AAS ASCII减法调整 AAS

DAS DAS 十进制减法调整 DAS
3. 乘法
指令 格式 功能 示例

MUL MUL 源 无符号乘法 MUL BL

IMUL IMUL 源 有符号乘法 IMUL BX

AAM AAM ASCII乘法调整 AAM
4. 除法
指令 格式 功能 示例

DIV DIV 源 无符号除法 DIV BL

IDIV IDIV 源 有符号除法 IDIV BX

AAD AAD ASCII除法调整 AAD

三、逻辑运算指令（Logical）

1. 基本逻辑

指令 格式 功能 示例

AND AND 目标, 源 逻辑与 AND AL, 0Fh

OR OR 目标, 源 逻辑或 OR AL, 80h

XOR XOR 目标, 源 逻辑异或 XOR AX, AX

NOT NOT 目标 逻辑非 NOT AL

TEST TEST 目标, 源 测试位 TEST AL, 01h
2. 移位
指令 格式 功能 示例

SHL/SAL SHL 目标, 计数 逻辑/算术左移 SHL AX, 1

SHR SHR 目标, 计数 逻辑右移 SHR AX, 1

SAR SAR 目标, 计数 算术右移 SAR AX, 1
3. 循环移位
指令 格式 功能 示例

ROL ROL 目标, 计数 循环左移 ROL AL, 1

ROR ROR 目标, 计数 循环右移 ROR AL, 1

RCL RCL 目标, 计数 带进位循环左移 RCL AX, 1

RCR RCR 目标, 计数 带进位循环右移 RCR AX, 1
四、串操作指令（String）
指令 格式 功能 示例

MOVS MOVSB/MOVSW 串传送 MOVSB

CMPS CMPSB/CMPSW 串比较 CMPSB

SCAS SCASB/SCASW 串扫描 SCASB

LODS LODSB/LODSW 取串 LODSB

STOS STOSB/STOSW 存串 STOSB

REP REP 串指令 重复前缀 REP MOVSB

REPE/REPZ REPE 串指令 相等时重复 REPE CMPSB

REPNE/REPNZ REPNE 串指令 不等时重复 REPNE SCASB

五、控制转移指令（Control Transfer）

1. 无条件转移

指令 格式 功能 示例

JMP JMP 目标 无条件跳转 JMP START

CALL CALL 目标 调用子程序 CALL DELAY

RET RET [n] 返回 RET

RETF RETF [n] 远返回 RETF
2. 条件转移
指令 格式 条件 描述

JZ/JE JZ 目标 ZF=1 为零/相等跳转

JNZ/JNE JNZ 目标 ZF=0 非零/不等跳转

JC/JB/JNAE JC 目标 CF=1 有进位/低于跳转

JNC/JNB/JAE JNC 目标 CF=0 无进位/不低于跳转

JS JS 目标 SF=1 符号为负跳转

JNS JNS 目标 SF=0 符号为正跳转

JO JO 目标 OF=1 溢出跳转

JNO JNO 目标 OF=0 无溢出跳转

JP/JPE JP 目标 PF=1 偶校验跳转

JNP/JPO JNP 目标 PF=0 奇校验跳转
3. 有符号数比较
指令 条件 描述

JL/JNGE SF≠OF 小于/不大于等于

JNL/JGE SF=OF 不小于/大于等于

JG/JNLE ZF=0且SF=OF 大于/不小于等于

JNG/JLE ZF=1或SF≠OF 不大于/小于等于
4. 无符号数比较
指令 条件 描述

JB/JNAE CF=1 低于/不高于等于

JNB/JAE CF=0 不低于/高于等于

JA/JNBE CF=0且ZF=0 高于/不低于等于

JNA/JBE CF=1或ZF=1 不高于/低于等于
5. 循环控制
指令 格式 功能 示例

LOOP LOOP 目标 CX≠0则循环 LOOP AGAIN

LOOPZ/LOOPE LOOPZ 目标 CX≠0且ZF=1循环 LOOPZ NEXT

LOOPNZ/LOOPNE LOOPNZ 目标 CX≠0且ZF=0循环 LOOPNZ SEARCH

JCXZ JCXZ 目标 CX=0则跳转 JCXZ EXIT

六、处理器控制指令（Processor Control）

1. 标志操作

指令 功能 示例

STC 置进位标志 CF=1 STC

CLC 清进位标志 CF=0 CLC

CMC 进位标志取反 CMC

STD 置方向标志 DF=1 STD

CLD 清方向标志 DF=0 CLD

STI 开中断 IF=1 STI

CLI 关中断 IF=0 CLI
2. 其他控制
指令 功能 示例

NOP 空操作 NOP

HLT 暂停CPU HLT

WAIT 等待信号 WAIT

ESC 交权（协处理器） ESC

LOCK 总线锁定前缀 LOCK XCHG
七、中断指令（Interrupt）
指令 格式 功能 示例

INT INT n 软件中断 INT 21h

INTO INTO 溢出中断 INTO

IRET IRET 中断返回 IRET

八、指令详细参数表

寻址方式：

立即数寻址:    MOV AX, 1234h
寄存器寻址:    MOV AX, BX
直接寻址:      MOV AX, [1234h]
寄存器间接:    MOV AX, [BX]
寄存器相对:    MOV AX, [BX+10]
基址变址:      MOV AX, [BX+SI]
相对基址变址:  MOV AX, [BX+SI+10]


操作数类型：

MOV AL, BL      ; 8位寄存器
MOV AX, BX      ; 16位寄存器
MOV AX, [SI]    ; 内存操作数
MOV AX, 100h    ; 立即数


九、实用指令速查表

常用指令组合：

功能 示例代码

清零寄存器 XOR AX, AX

寄存器取反 NOT AX

寄存器取负 NEG AX

测试奇偶 TEST AL, 01h

乘10快速 MOV BX, AX<br>SHL AX, 1<br>SHL AX, 1<br>ADD AX, BX<br>SHL AX, 1

除2（有符号） SAR AX, 1

除2（无符号） SHR AX, 1

交换两变量 XCHG AX, BX

数组清零 MOV CX, 100<br>LEA DI, ARRAY<br>XOR AX, AX<br>REP STOSW
十、指令周期参考（4.77MHz）
指令类型 典型周期数 说明

寄存器操作 2-4 MOV, ADD, SUB等

内存操作 10-20 访问内存额外时间

跳转指令 15-20 跳转需要清空流水线

乘法指令 70-130 乘法较慢

除法指令 80-190 除法最慢

串操作 每个字节9-25 重复时效率高

十一、完整编程示例

; 示例：字符串转大写
.MODEL SMALL
.STACK 100H
.DATA
    STR DB 'hello world$'
.CODE
START:
    MOV AX, @DATA
    MOV DS, AX
    MOV ES, AX        ; 设置ES
    
    ; 使用串操作
    LEA DI, STR       ; DI指向字符串
    MOV AL, '$'       ; 结束符
    CLD               ; 方向向前
    
CONVERT_LOOP:
    CMP [DI], AL      ; 是否结束？
    JE DONE
    CMP BYTE PTR [DI], 'a'
    JB NEXT_CHAR
    CMP BYTE PTR [DI], 'z'
    JA NEXT_CHAR
    SUB BYTE PTR [DI], 20h  ; 转大写
NEXT_CHAR:
    INC DI
    JMP CONVERT_LOOP
    
DONE:
    ; 显示结果
    MOV AH, 09H
    LEA DX, STR
    INT 21H
    
    MOV AH, 4CH
    INT 21H
END START


十二、注意事项

1. 段超越前缀：
   MOV AL, DS:[BX]    ; 默认
   MOV AL, ES:[BX]    ; 段超越
   MOV AL, CS:[BX]    ; 代码段
   MOV AL, SS:[BX]    ; 堆栈段
   

2. 操作数大小：
   BYTE PTR [SI]      ; 字节操作
   WORD PTR [DI]      ; 字操作
   

3. 地址长度前缀：
   ; 在32位模式下用66h前缀选择16位操作
   DB 66h
   MOV AX, BX
   

十三、不常用但重要的指令

指令 功能 使用场景

XLAT 查表转换 代码转换表

BOUND 检查数组边界 数组越界检查

ENTER 建立堆栈帧 高级语言支持

LEAVE 撤销堆栈帧 高级语言支持
