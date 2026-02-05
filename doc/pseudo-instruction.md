8086汇编伪指令详解

一、伪指令概述

伪指令（Directive）是给汇编器的指令，不生成机器代码，用于控制汇编过程、定义数据、分配存储空间等。

二、数据定义伪指令

1. DB - 定义字节

DB 表达式[, 表达式...]
; 示例：
VAR1 DB 10              ; 定义字节变量，值为10
VAR2 DB 41H, 42H, 43H  ; 定义3个字节：'A','B','C'
VAR3 DB 'Hello', 0      ; 定义字符串
VAR4 DB 5 DUP(0)        ; 定义5个字节，全部为0
VAR5 DB 3 DUP(1,2,3)    ; 定义9个字节：1,2,3,1,2,3,1,2,3


2. DW - 定义字（2字节）

DW 表达式[, 表达式...]
; 示例：
WORD1 DW 1234H          ; 定义字变量
ADDR_TABLE DW OFFSET PROC1, OFFSET PROC2
ARRAY DW 100 DUP(?)     ; 定义100个未初始化字
STR_PTR DW 'AB'         ; 定义字'BA'（低位在前）


3. DD - 定义双字（4字节）

DD 表达式[, 表达式...]
; 示例：
DWORD1 DD 12345678H     ; 定义双字
FAR_PTR DD PROC1        ; 定义远指针
REAL1 DD 3.14159        ; 定义实数


4. DQ - 定义四字（8字节）

DQ 表达式[, 表达式...]
; 示例：
QUAD1 DQ 123456789ABCDEF0H
REAL2 DQ 2.718281828459045


5. DT - 定义十字节

DT 表达式[, 表达式...]
; 示例：
TBYTE1 DT 12345678901234567890


6. 问号(?)和DUP操作符

BUFFER DB 100 DUP(?)     ; 保留100字节空间
ZERO_ARRAY DW 50 DUP(0)  ; 50个字，全部为0
MIXED DB 5 DUP(1,2,3,?)  ; 20个字节


三、符号定义伪指令

1. EQU - 等价定义

符号 EQU 表达式
; 示例：
PI EQU 3.14159
PORT_A EQU 60H
BUFFER_SIZE EQU 1024
CR EQU 0DH
LF EQU 0AH


2. = - 等号赋值

符号 = 表达式
; 与EQU的区别：可以重新定义
COUNT = 10
COUNT = COUNT + 1       ; 可以重新赋值


3. LABEL - 定义类型属性

名称 LABEL 类型
; 示例：
BYTE_ARRAY LABEL BYTE
WORD_ARRAY DW 100 DUP(?)  ; 同一内存区域，两种访问方式
FAR_LABEL LABEL FAR       ; 定义远标号


四、段定义伪指令

1. SEGMENT/ENDS - 定义段

段名 SEGMENT [定位类型] [组合类型] [类别]
    ; 段内容
段名 ENDS
; 示例：
DATA SEGMENT
    VAR1 DB 10
    VAR2 DW 20
DATA ENDS

CODE SEGMENT
    ASSUME CS:CODE, DS:DATA
    ; 代码
CODE ENDS


2. ASSUME - 指定段寄存器

ASSUME 段寄存器:段名[, 段寄存器:段名...]
; 示例：
ASSUME CS:CODE, DS:DATA, ES:DATA, SS:STACK
ASSUME NOTHING          ; 取消所有设定


3. GROUP - 组定义

组名 GROUP 段名[, 段名...]
; 示例：
DGROUP GROUP DATA1, DATA2, STACK


五、过程定义伪指令

1. PROC/ENDP - 定义过程

过程名 PROC [NEAR/FAR]
    ; 过程体
    RET
过程名 ENDP
; 示例：
DISPLAY PROC NEAR
    MOV AH, 2
    INT 21H
    RET
DISPLAY ENDP

FAR_PROC PROC FAR       ; 远过程
    PUSH DS
    XOR AX, AX
    PUSH AX
    RET
FAR_PROC ENDP


六、结构定义伪指令

1. STRUC/ENDS - 结构定义

结构名 STRUC
    字段定义
结构名 ENDS
; 示例：
PERSON STRUC
    NAME DB 20 DUP(?)
    AGE DB ?
    SALARY DW ?
PERSON ENDS

; 使用结构：
JOHN PERSON <'John', 25, 3000>


七、程序开始和结束伪指令

1. ORG - 设置位置计数器

ORG 表达式
; 示例：
ORG 100H              ; 从偏移100H开始
ORG $+10             ; 跳过10个字节


2. END - 程序结束

END [起始地址]
; 示例：
END START            ; 程序从START开始
END                  ; 无起始地址


3. $ - 当前位置计数器

OFFSET_VAR DW $      ; 保存当前位置
BUFFER DB 100 DUP(?)
BUF_SIZE EQU $-OFFSET_VAR  ; 计算缓冲区大小


八、条件汇编伪指令

1. IF/ELSE/ENDIF

IF 表达式
    ; 表达式非0时汇编
ELSE
    ; 表达式为0时汇编
ENDIF
; 示例：
DEBUG = 1
IF DEBUG
    MOV AH, 2
    MOV DL, 'D'
    INT 21H
ENDIF


2. IFE/IFDEF/IFNDEF

IFE 表达式           ; 表达式为0
IFDEF 符号          ; 符号已定义
IFNDEF 符号         ; 符号未定义
; 示例：
IFDEF DEBUG
    CALL DEBUG_PROC
ENDIF


九、包含文件伪指令

1. INCLUDE - 包含文件

INCLUDE 文件名
; 示例：
INCLUDE MACRO.LIB
INCLUDE IO.INC


十、宏定义伪指令

1. MACRO/ENDM - 定义宏

宏名 MACRO [参数1[, 参数2...]]
    ; 宏体
ENDM
; 示例：
PRINT_STR MACRO STRING
    MOV AH, 9
    MOV DX, OFFSET STRING
    INT 21H
ENDM

DISPLAY MACRO MSG
    LOCAL MSG_LABEL
    JMP SHORT MSG_END
MSG_LABEL DB MSG, '$'
MSG_END:
    MOV AH, 9
    LEA DX, MSG_LABEL
    INT 21H
ENDM


2. LOCAL - 定义局部标号

LOCAL 标号1[, 标号2...]
; 在宏内使用，避免多次展开时的标号重复


十一、列表控制伪指令

1. PAGE - 分页

PAGE [长度][, 宽度]
; 示例：
PAGE 60, 132


2. TITLE - 设置标题

TITLE 文本
; 示例：
TITLE 'Main Program'


3. SUBTTL - 设置子标题

SUBTTL 文本


十二、处理器选择伪指令

.8086           ; 默认8086指令集
.286
.386
.486
.586


十三、对齐伪指令

1. EVEN - 偶地址对齐

EVEN
; 示例：
EVEN
WORD_VAR DW 0


2. ALIGN - 指定对齐

ALIGN n
; 示例：
ALIGN 4         ; 4字节对齐


十四、外部符号伪指令

1. EXTRN - 声明外部符号

EXTRN 符号:类型
; 示例：
EXTRN PRINT:NEAR, BUFFER:BYTE


2. PUBLIC - 声明公共符号

PUBLIC 符号[, 符号...]
; 示例：
PUBLIC MAIN, PROC1, VAR1


十五、简化段定义伪指令

1. .DATA/.STACK/.CODE

.MODEL SMALL
.STACK 100H
.DATA
    MSG DB 'Hello$'
.CODE
START:
    MOV AX, @DATA
    MOV DS, AX
    ; 程序代码
END START


十六、完整示例程序

; 使用标准段定义
DATA SEGMENT
    ; 数据定义
    COUNT EQU 100
    ARRAY DW COUNT DUP(0)
    SUM DW ?
    PROMPT DB 'Enter number: $'
    CRLF DB 0DH, 0AH, '$'
DATA ENDS

STACK SEGMENT STACK
    DW 100 DUP(?)
    TOP LABEL WORD
STACK ENDS

CODE SEGMENT
    ASSUME CS:CODE, DS:DATA, SS:STACK, ES:DATA
    
MAIN PROC FAR
    ; 程序开始
    MOV AX, DATA
    MOV DS, AX
    MOV ES, AX
    MOV AX, STACK
    MOV SS, AX
    LEA SP, TOP
    
    ; 清零数组
    MOV CX, COUNT
    LEA SI, ARRAY
    XOR AX, AX
CLEAR_LOOP:
    MOV [SI], AX
    ADD SI, 2
    LOOP CLEAR_LOOP
    
    ; 计算和
    MOV CX, COUNT
    LEA SI, ARRAY
    XOR AX, AX
    XOR DX, DX
SUM_LOOP:
    ADD AX, [SI]
    ADC DX, 0
    ADD SI, 2
    LOOP SUM_LOOP
    MOV SUM, AX
    
    ; 程序结束
    MOV AH, 4CH
    INT 21H
MAIN ENDP

; 显示字符串子程序
DISPLAY_MSG PROC NEAR
    ; DX包含字符串偏移
    PUSH AX
    MOV AH, 9
    INT 21H
    POP AX
    RET
DISPLAY_MSG ENDP

CODE ENDS
END MAIN


十七、使用简化段定义

.MODEL SMALL
.STACK 100H

.DATA
    MSG DB 'Hello, Assembly!$'

.CODE
MAIN PROC
    MOV AX, @DATA
    MOV DS, AX
    
    ; 显示消息
    MOV AH, 9
    LEA DX, MSG
    INT 21H
    
    ; 退出程序
    MOV AH, 4CH
    INT 21H
MAIN ENDP
END MAIN


十八、伪指令使用注意事项

1. 区分大小写：默认不区分，但可以设置
2. 作用域：
   • EQU定义的符号不能重新定义

   • =定义的符号可以重新定义

3. 段对齐：
   • WORD对齐：从偶地址开始

   • PARA对齐：从16字节边界开始

4. 位置计数器：
   • $表示当前位置

   • ORG可以修改位置计数器

5. 条件汇编：
   • 用于编写可配置的代码

   • 常用于调试版本和发布版本的区别

这些伪指令是8086汇编程序的重要组成部分，合理使用可以大大提高编程效率和代码可读性。


8086汇编伪指令格式详解

一、伪指令通用语法格式


伪指令名 [操作数1 [, 操作数2] ...] [; 注释]


二、详细伪指令格式分类

1. 数据定义伪指令格式

格式模板：


[变量名] DB|DW|DD|DQ|DT 初始值表达式 [, 初始值表达式...]


详细格式：


变量名 数据类型 表达式 [, 表达式...] [; 注释]


表达式格式：

• 单个数值：DB 10

• 多个数值：DB 1, 2, 3, 4

• 字符/字符串：DB 'A' 或 DB "Hello"

• 重复定义：DB 5 DUP(?)

• 复合重复：DB 3 DUP(1, 2, 3)

• 算术表达式：DW 10*5+2

• 地址表达式：DW OFFSET 标号

示例：

; 格式：名称 DB 表达式列表
BYTE_VAR  DB  41H, 42H, 43H, 0     ; 4个字节
WORD_VAR  DW  1234H, 5678H         ; 2个字
DWORD_VAR DD  12345678H            ; 1个双字
RESERVED  DB  100 DUP(0)          ; 100个0
MIXED     DB  'A', 0DH, 0AH, 0     ; 混合类型


2. 符号定义伪指令格式

EQU 格式：


符号 EQU 表达式

• 符号：必须是一个有效的标识符

• 表达式：可以是数值、字符、地址、指令等

• 特点：一经定义，不可重新定义
; 示例：
BUFFER_SIZE EQU 1024
PORT_A      EQU 60H
NEWLINE     EQU 0DH, 0AH
CR          EQU 0DH
LF          EQU 0AH
COUNT       EQU BUFFER_SIZE/2


= 格式：


符号 = 表达式

• 可以重新定义

• 表达式必须是数值
; 示例：
COUNT = 10
COUNT = COUNT + 5    ; 重新赋值
INDEX = 0
INDEX = 100


LABEL 格式：


标号名 LABEL 类型

• 类型：BYTE、WORD、DWORD、NEAR、FAR、PROC等
; 示例：
BUFFER_BYTE LABEL BYTE
BUFFER_WORD DW 100 DUP(?)  ; 同一数据，不同访问方式

FAR_LABEL   LABEL FAR
NEAR_LABEL  LABEL NEAR


3. 段定义伪指令格式

SEGMENT/ENDS 格式：


段名 SEGMENT [对齐类型] [组合类型] ['类别名']
    ; 段内容
段名 ENDS


参数说明：

• 对齐类型：

  • BYTE    - 从任何地址开始

  • WORD    - 从偶地址开始

  • PARA    - 从16字节边界开始（默认）

  • PAGE    - 从256字节边界开始

• 组合类型：

  • PUBLIC  - 同名段连接在一起

  • STACK   - 堆栈段

  • COMMON  - 同名段重叠

  • MEMORY  - 放在最高地址

  • AT 地址 - 指定绝对地址

• 类别名：用单引号括起来的字符串
; 示例：
DATA SEGMENT WORD PUBLIC 'DATA'
    VAR1 DB 10
DATA ENDS

STACK SEGMENT PARA STACK 'STACK'
    DW 100 DUP(?)
    TOP LABEL WORD
STACK ENDS

CODE SEGMENT PARA PUBLIC 'CODE'
    ASSUME CS:CODE, DS:DATA, SS:STACK
    ; 代码
CODE ENDS


4. ASSUME 伪指令格式


ASSUME 段寄存器:段名 [, 段寄存器:段名]...
ASSUME NOTHING

; 示例：
ASSUME CS:CODE, DS:DATA, ES:EXTRA, SS:STACK
ASSUME DS:NOTHING, ES:NOTHING


5. 过程定义伪指令格式

PROC/ENDP 格式：


过程名 PROC [NEAR|FAR] [USES 寄存器列表]
    ; 过程体
    RET
过程名 ENDP

; 示例：
DISPLAY PROC NEAR
    PUSH AX
    PUSH DX
    MOV AH, 9
    INT 21H
    POP DX
    POP AX
    RET
DISPLAY ENDP

FAR_PROC PROC FAR
    PUSH BP
    MOV BP, SP
    ; 过程体
    POP BP
    RETF
FAR_PROC ENDP


6. 结构定义伪指令格式

STRUC/ENDS 格式：


结构名 STRUC
    字段名 数据类型 表达式 [, 表达式...]
    [字段名 数据类型 表达式 [, 表达式...] ...]
结构名 ENDS

; 示例：
PERSON STRUC
    NAME   DB 20 DUP(' ')
    AGE    DB ?
    SALARY DW ?
PERSON ENDS

; 使用格式：
EMPLOYEE PERSON <'John', 25, 3000>


7. 程序控制伪指令格式

ORG 格式：


ORG 表达式

ORG 100H        ; 设置当前位置为100H
ORG $+10        ; 跳过10个字节


END 格式：


END [起始标号]

END START       ; 程序从START开始执行
END             ; 无起始地址


8. 条件汇编伪指令格式

基本格式：


IF 条件表达式
    ; 条件为真时汇编
[ELSE
    ; 条件为假时汇编]
ENDIF


条件类型：

IF 表达式        ; 表达式≠0
IFE 表达式       ; 表达式=0
IFDEF 符号       ; 符号已定义
IFNDEF 符号      ; 符号未定义
IFB <参数>       ; 参数为空
IFNB <参数>      ; 参数不为空
IFIDN <串1>,<串2> ; 串相同
IFDIF <串1>,<串2> ; 串不同

; 示例：
DEBUG = 1
IF DEBUG
    CALL DEBUG_PROC
ENDIF

IFDEF VERSION_2
    MOV AX, 2
ELSE
    MOV AX, 1
ENDIF


9. 宏定义伪指令格式

MACRO/ENDM 格式：


宏名 MACRO [形式参数1[, 形式参数2]...]
    [LOCAL 局部标号1[, 局部标号2]...]
    ; 宏体
ENDM

; 示例：
PRINT_STR MACRO STRING
    PUSH AX
    PUSH DX
    MOV AH, 9
    LEA DX, STRING
    INT 21H
    POP DX
    POP AX
ENDM

DELAY MACRO TIME
    LOCAL LOOP1, LOOP2
    PUSH CX
    MOV CX, TIME
LOOP1:
    PUSH CX
    MOV CX, 1000
LOOP2:
    LOOP LOOP2
    POP CX
    LOOP LOOP1
    POP CX
ENDM


10. 包含文件伪指令格式


INCLUDE 文件名
INCLUDE 路径\文件名

INCLUDE MACRO.LIB
INCLUDE C:\ASM\IO.INC


11. 简化段定义伪指令格式

模型定义格式：


.MODEL 存储模型 [, 语言类型] [, 其他选项]


存储模型：

• TINY     - 代码和数据<=64K

• SMALL    - 代码<=64K, 数据<=64K

• MEDIUM   - 代码>64K, 数据<=64K

• COMPACT  - 代码<=64K, 数据>64K

• LARGE    - 代码>64K, 数据>64K

• HUGE     - 同LARGE，但数组可超过64K

• FLAT     - 32位平面模型
; 完整简化段示例格式：
.MODEL SMALL
.STACK 100H
.DATA
    ; 数据定义
.CODE
程序名 PROC
    MOV AX, @DATA
    MOV DS, AX
    ; 程序代码
程序名 ENDP
END 程序名


12. 外部/公共符号伪指令格式

EXTRN 格式：


EXTRN 符号:类型 [, 符号:类型]...


PUBLIC 格式：


PUBLIC 符号 [, 符号]...

; 示例：
EXTRN PRINT:NEAR, GETCHAR:NEAR, BUFFER:BYTE
PUBLIC MAIN, PROC1, VAR1, VAR2


13. 对齐伪指令格式

EVEN 格式：



ALIGN 格式：


ALIGN 边界值

; 示例：
EVEN            ; 对齐到偶地址
WORD_VAR DW ?

ALIGN 4         ; 对齐到4字节边界
DWORD_VAR DD ?

ALIGN 16        ; 对齐到16字节边界
BUFFER DB 100 DUP(?)


三、伪指令参数的详细形式

1. 表达式形式

; 数值表达式
NUM DB 10 + 20 * 3      ; 算术运算
OFFSET_VAR DW OFFSET ARRAY  ; 地址偏移
SIZE_VAR DW LENGTH ARRAY    ; 数组长度
TYPE_VAR DB TYPE BYTE_VAR  ; 类型大小

; 地址表达式
PTR_VAR DD NEAR PTR PROC1, FAR PTR PROC2
SEG_VAR DW SEG DATA_ARRAY


2. 重复子句格式


重复次数 DUP (表达式 [, 表达式...])

; 示例：
ZEROS DB 100 DUP(0)           ; 100个0
PATTERN DB 5 DUP(1, 2, 3, 4)  ; 1,2,3,4重复5次
UNINIT DW 50 DUP(?)           ; 50个未初始化字
STRING DB 3 DUP('A', 0)       ; 重复字符串


3. 结构成员初始化格式


结构变量名 结构类型 <初始值列表>

; 示例：
PERSON STRUC
    NAME DB 20 DUP(' ')
    AGE DB 0
PERSON ENDS

; 初始化格式：
JOHN PERSON <'John Smith', 25>     ; 完全初始化
MARY PERSON <'Mary'>               ; 部分初始化
TOM PERSON <>                      ; 全部默认值


四、伪指令的书写规则

1. 基本规则


[标号:] 伪指令 操作数 [;注释]
    ↑      ↑       ↑
    可选   必须    可选


2. 标号要求

• 必须以字母或特殊字符（@, _, $, ?）开头

• 长度通常不超过31个字符

• 不能是保留字

3. 数值格式

BINARY     DB 1010B     ; 二进制
DECIMAL    DB 10        ; 十进制
HEX        DB 0AH       ; 十六进制
CHAR       DB 'A'       ; 字符
STRING     DB "Hello"   ; 字符串


五、综合示例

; 数据段定义格式
DATA SEGMENT PARA PUBLIC 'DATA'
    ; 符号定义
    COUNT EQU 100
    TRUE  EQU 1
    FALSE EQU 0
    
    ; 数据定义
    ARRAY DW COUNT DUP(0)
    SUM   DD ?
    
    ; 带重复的数据
    TABLE DB 3 DUP(1, 2, 3, 4, 5)
    
    ; 字符串定义
    PROMPT DB 'Enter value: ', '$'
    RESULT DB 'Result: ', 0
    
    ; 对齐
    EVEN
    ALIGNED_VAR DW ?
DATA ENDS

; 堆栈段
STACK SEGMENT PARA STACK 'STACK'
    DW 256 DUP(?)
    TOP LABEL WORD
STACK ENDS

; 代码段
CODE SEGMENT PARA PUBLIC 'CODE'
    ASSUME CS:CODE, DS:DATA, SS:STACK, ES:DATA
    
    ; 宏定义
    PRINT_STR MACRO MSG
        PUSH AX
        PUSH DX
        MOV AH, 9
        LEA DX, MSG
        INT 21H
        POP DX
        POP AX
    ENDM
    
    ; 主程序
    MAIN PROC FAR
        ; 段寄存器初始化
        MOV AX, DATA
        MOV DS, AX
        MOV ES, AX
        MOV AX, STACK
        MOV SS, AX
        LEA SP, TOP
        
        ; 使用宏
        PRINT_STR PROMPT
        
        ; 程序结束
        MOV AX, 4C00H
        INT 21H
    MAIN ENDP
    
    ; 子程序
    CALCULATE PROC NEAR
        ; 计算过程
        RET
    CALCULATE ENDP
CODE ENDS
END MAIN


六、重要注意事项

1. 区分大小写：默认不区分，但可通过设置改变
2. 段排列顺序：通常按DATA、STACK、CODE顺序
3. END伪指令：必须是程序的最后一条语句
4. 位置计数器$：表示当前偏移地址
5. 类型检查：确保操作数类型匹配
6. 符号作用域：在定义后可用，直到重新定义或模块结束

这个格式说明详细列出了8086汇编中所有主要伪指令的完整语法格式和使用方法。