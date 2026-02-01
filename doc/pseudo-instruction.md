8086汇编伪指令（伪操作）全集详解

伪指令（Directives/Pseudo-ops）是给汇编器的命令，不是给CPU的指令。它们控制汇编过程、定义数据、控制程序结构等。

一、数据定义伪指令

1. DB/DW/DD/DQ/DT - 定义数据

; DB - Define Byte (1字节)
byte1    DB 12h          ; 单个字节
bytes    DB 1,2,3,4      ; 多个字节
string   DB 'Hello$'     ; 字符串
array    DB 10 DUP(0)    ; 10个0
uninit   DB ?            ; 未初始化

; DW - Define Word (2字节)
word1    DW 1234h        ; 一个字
words    DW 100,200,300  ; 多个字
offset1  DW offset label ; 偏移地址
segment1 DW seg data     ; 段值

; DD - Define Doubleword (4字节)
dword1   DD 12345678h    ; 双字
ptr1     DD offset label ; 32位指针(段:偏移)
far_ptr  DD label        ; 同 offset label

; DQ - Define Quadword (8字节)
qword    DQ 123456789ABCDEF0h
float    DQ 3.1415926535 ; 浮点数

; DT - Define Tenbytes (10字节)
bcd      DT 1234567890   ; 压缩BCD


2. EQU/= - 符号定义

; EQU - 定义常量（不可重定义）
MAX_SIZE EQU 100
PORT     EQU 3F8h
CR       EQU 0Dh
LF       EQU 0Ah
EOS      EQU '$'

; = - 定义符号（可重定义）
count = 0
count = count + 1     ; 允许重定义
buffsize = 1024


3. DUP - 重复操作符

; 重复初始化
zeros    DB 20 DUP(0)      ; 20个0
pattern  DB 5 DUP(1,2,3)   ; 1,2,3,1,2,3,1,2,3,1,2,3,1,2,3
table    DW 10 DUP(?)      ; 10个未初始化字
matrix   DB 3 DUP(4 DUP(0)); 3×4零矩阵（某些汇编器）


二、段定义伪指令

1. SEGMENT/ENDS - 段定义

; 完整段定义
DATA_SEG SEGMENT           ; 数据段开始
    var1 DB ?
DATA_SEG ENDS              ; 数据段结束

STACK_SEG SEGMENT STACK    ; 堆栈段
    DB 100h DUP(?)
STACK_SEG ENDS

CODE_SEG SEGMENT           ; 代码段
    ASSUME CS:CODE_SEG, DS:DATA_SEG, SS:STACK_SEG
    main PROC FAR
        ; 代码
    main ENDP
CODE_SEG ENDS


2. ASSUME - 段寄存器关联

; 告诉汇编器各段寄存器指向哪个段
ASSUME CS:CODE_SEG, DS:DATA_SEG, SS:STACK_SEG, ES:NOTHING
ASSUME DS:MY_DATA, ES:MY_EXTRA
ASSUME NOTHING             ; 清除所有关联


3. .MODEL - 内存模型（简化段定义）

; MASM/TASM的简化模型
.MODEL TINY       ; 一个段 ≤ 64KB (COM程序)
.MODEL SMALL      ; 代码+数据各一个段
.MODEL MEDIUM     ; 多代码段，单数据段
.MODEL COMPACT    ; 单代码段，多数据段
.MODEL LARGE      ; 多代码段，多数据段
.MODEL HUGE       ; 多代码段，多数据段（数组可>64KB）

; 使用示例
.MODEL SMALL
.STACK 100h       ; 定义堆栈
.DATA             ; 数据段
.CODE             ; 代码段


三、过程定义伪指令

1. PROC/ENDP - 过程定义

; 过程定义
myproc PROC NEAR          ; 近过程
    push ax
    ; 过程体
    pop ax
    ret
myproc ENDP

; 远程过程
far_proc PROC FAR
    retf
far_proc ENDP

; 带参数
calc_sum PROC
    ARG val1:WORD, val2:WORD = ARGSIZE
    push bp
    mov bp, sp
    mov ax, [bp+val1]
    add ax, [bp+val2]
    pop bp
    ret ARGSIZE
calc_sum ENDP


2. PUBLIC/EXTRN - 符号共享

; module1.asm
PUBLIC func1, var1       ; 声明为公共
func1 PROC
    ; ...
var1 DW 100

; module2.asm
EXTRN func1:PROC, var1:WORD  ; 声明为外部
    call func1
    mov ax, var1


四、程序控制伪指令

1. ORG - 设置位置计数器

; 设置汇编地址
ORG 100h           ; COM程序从100h开始
ORG 7C00h          ; 引导扇区
ORG $+10           ; 跳过10字节

; 引导扇区示例
ORG 7C00h
    jmp start
    DB 90h
start:
    ; ...


2. END - 程序结束

; 指定程序入口点
END START          ; 入口点为START
END MAIN           ; 入口点为MAIN
END                ; 无入口点（库文件）

; 在简化模型中
.MODEL SMALL
.CODE
START:            ; 程序从这里开始
    ; ...
END START


3. EVEN/ALIGN - 对齐

; 对齐到偶地址
EVEN              ; 对齐到偶地址
word_array DW 100 DUP(?)  ; 字数组应对齐

; MASM 6.0+
ALIGN 2           ; 对齐到2的倍数
ALIGN 4           ; 对齐到4的倍数


五、条件汇编伪指令

1. IF/ELSE/ENDIF

; 条件汇编
DEBUG = 1

IF DEBUG
    MOV AH, 09h
    LEA DX, debug_msg
    INT 21h
ENDIF

; 条件定义
IF Version GT 5
    NEW_FEATURE = 1
ELSE
    NEW_FEATURE = 0
ENDIF


2. IFDEF/IFNDEF

; 检查符号是否定义
IFDEF DEBUG
    ; 调试代码
ENDIF

IFNDEF RELEASE
    ; 非发布版本代码
ENDIF


3. IFB/IFNB（检查参数是否为空）

; 宏参数检查
MYMACRO MACRO param
    IFB <param>
        ; 参数为空
    ELSE
        ; 参数非空
    ENDIF
ENDM


六、重复块伪指令

1. REPEAT/ENDM（TASM风格）

; 重复代码块
REPEAT 10
    DB 0
ENDM

; 带计数的重复
count = 0
REPEAT 5
    DB count
    count = count + 1
ENDM


2. REPT/ENDM（MASM风格）

; 重复块
REPT 8
    NOP
ENDM


3. IRP/IRPC - 参数化重复

; IRP - 迭代参数列表
IRP reg, <AX,BX,CX,DX>
    PUSH reg
ENDM
; 展开为: PUSH AX, PUSH BX, PUSH CX, PUSH DX

; IRPC - 迭代字符串
IRPC char, ABCD
    DB '&char'
ENDM
; 展开为: DB 'A','B','C','D'


七、结构体定义伪指令

1. STRUC/ENDS（TASM风格）

; 定义结构体
POINT STRUC
    x DW ?
    y DW ?
POINT ENDS

; 使用结构体
p1 POINT <10, 20>
p2 POINT <>

; 访问字段
MOV AX, p1.x
MOV BX, (POINT PTR [SI]).y


2. STRUCT/ENDS（MASM风格）

; 结构体定义
RECT STRUCT
    left   DW ?
    top    DW ?
    right  DW ?
    bottom DW ?
RECT ENDS

; 实例化
window RECT <0,0,80,25>


3. UNION - 联合体

; 联合体定义
VARIANT UNION
    as_word  DW ?
    as_byte1 DB ?
    as_byte2 DB ?
VARIANT ENDS

var VARIANT <>
MOV var.as_word, 1234h
MOV AL, var.as_byte1    ; AL = 34h


八、宏定义伪指令

1. MACRO/ENDM - 定义宏

; 简单宏
PRINT_STR MACRO msg
    MOV AH, 09h
    LEA DX, msg
    INT 21h
ENDM

; 使用宏
PRINT_STR hello_msg

; 带参数的宏
ADD_VAR MACRO var, value
    MOV AX, value
    ADD var, AX
ENDM

ADD_VAR total, 100


2. LOCAL - 局部标号

; 宏内的局部标号
DELAY MACRO count
    LOCAL loop1
    MOV CX, count
loop1:
    NOP
    LOOP loop1
ENDM
; 每次展开生成唯一的标号


3. PURGE - 删除宏定义

; 删除宏
MYMACRO MACRO
    ; ...
ENDM

PURGE MYMACRO    ; 删除宏定义


九、列表控制伪指令

1. PAGE - 分页

PAGE            ; 开始新页
PAGE 60, 132    ; 设置每页60行，每行132字符


2. TITLE/SUBTTL - 标题

TITLE "My Program"      ; 设置列表文件标题
SUBTTL "Version 1.0"    ; 子标题


3. .LIST/.XLIST - 列表控制

.XLIST          ; 关闭列表
; 这部分不会出现在列表文件中
.LIST           ; 开启列表


4. %OUT - 输出消息

%OUT Compiling math module...
%OUT Building version 1.0


十、处理器控制伪指令

1. .8086/.286/.386 - 处理器模式

.8086           ; 只允许8086指令
.286            ; 允许286指令
.286P           ; 允许286保护模式指令
.386            ; 允许386指令
.386P           ; 允许386保护模式指令
.486
.586           ; Pentium


2. NOLIST/LIST - 包含文件控制

; 包含文件时不列出
NOLIST
INCLUDE macros.inc
LIST


十一、特殊符号伪指令

1. $ - 当前位置计数器

; $ 表示当前位置
HERE:   JMP $          ; 死循环（跳转到自己）
SIZE = $ - ARRAY       ; 计算数组大小
        ORG $+10       ; 跳过10字节


2. ? - 未初始化

buffer DB 100 DUP(?)   ; 100字节未初始化空间
temp   DW ?            ; 未初始化字


3. DUP 的特殊形式

; 重复特殊值
DB 5 DUP(?)           ; 5个未初始化字节
DW 3 DUP(?)           ; 3个未初始化字
DB 4 DUP('A','B')     ; 重复序列


十二、完整程序结构示例

示例1：简化模型程序

; 简化模型示例
.MODEL SMALL
.STACK 100h           ; 256字节堆栈

.DATA                  ; 数据段
    msg DB 'Hello!$'
    count DW 0
    array DB 10 DUP(0)

.CODE                  ; 代码段
main PROC
    MOV AX, @DATA
    MOV DS, AX
    
    MOV AH, 09h
    LEA DX, msg
    INT 21h
    
    MOV AX, 4C00h
    INT 21h
main ENDP

END main              ; 程序入口


示例2：完整段定义程序

; 完整段定义示例
STACK_SEG SEGMENT STACK
    DB 100h DUP('S')   ; 100h字节堆栈
STACK_SEG ENDS

DATA_SEG SEGMENT
    message DB 'Complete segment example$'
    number  DW 1234h
DATA_SEG ENDS

CODE_SEG SEGMENT
    ASSUME CS:CODE_SEG, DS:DATA_SEG, SS:STACK_SEG
    
main PROC FAR
    ; 程序入口
    PUSH DS
    XOR AX, AX
    PUSH AX
    
    MOV AX, DATA_SEG
    MOV DS, AX
    
    ; 显示消息
    MOV AH, 09h
    LEA DX, message
    INT 21h
    
    RET      ; 返回到DOS
main ENDP

CODE_SEG ENDS
END main


十三、条件汇编完整示例

; 条件汇编应用
DEBUG = 1
USE_COLOR = 0
VERSION = 2

; 根据版本选择代码
IF VERSION EQ 1
    FEATURE_SET = 0
ELSEIF VERSION EQ 2
    FEATURE_SET = 1
    NEW_API = 1
ELSE
    FEATURE_SET = 2
    NEW_API = 1
    ADVANCED = 1
ENDIF

; 调试版本包含额外代码
IF DEBUG
    %OUT Debug version
    CHECK_ERROR MACRO
        JC error_handler
    ENDM
    
    error_handler:
        MOV AH, 09h
        LEA DX, err_msg
        INT 21h
        RET
ELSE
    %OUT Release version
    CHECK_ERROR MACRO
    ENDM
ENDIF

; 在代码中使用
    MOV AH, 0Fh
    INT 10h
    CHECK_ERROR        ; 调试版本会展开为错误检查


十四、宏库使用示例

; macros.inc 文件
; 宏定义库

; 显示字符串
DISPLAY_STRING MACRO msg
    MOV AH, 09h
    LEA DX, msg
    INT 21h
ENDM

; 延迟近似1秒
DELAY_1S MACRO
    LOCAL outer, inner
    PUSH CX
    PUSH BX
    MOV CX, 1000
outer:
    MOV BX, 0FFFFh
inner:
    DEC BX
    JNZ inner
    LOOP outer
    POP BX
    POP CX
ENDM

; 主程序
INCLUDE macros.inc
.MODEL SMALL
.CODE
START:
    DISPLAY_STRING hello
    DELAY_1S
    MOV AH, 4Ch
    INT 21h
.DATA
hello DB 'Hello from macro!$'
END START


十五、常见汇编器差异

伪指令 MASM TASM NASM 说明

注释 ; ; ; 相同

包含文件 INCLUDE INCLUDE %include NASM用%

字符串定义 DB DB db NASM小写

段定义 .CODE .CODE SECTION .text NASM不同

位置计数器 $ $ $ 相同

结构体 STRUCT STRUC struc 不同

程序结束 END END 无END NASM无END

十六、重要注意事项

1. 数据对齐

; 字/双字数据应该对齐
EVEN
word_data DW 100 DUP(?)

ALIGN 4
dword_data DD 50 DUP(?)


2. 段寄存器设置

; 必须用ASSUME告诉汇编器
ASSUME DS:SEG_DATA, ES:SEG_EXTRA

; 但ASSUME不实际设置寄存器！
; 必须用代码设置：
MOV AX, SEG_DATA
MOV DS, AX


3. ORG的使用时机

; 通常只在特殊情况下使用
ORG 100h          ; COM程序
ORG 7C00h         ; 引导扇区
ORG 0100h         ; DOS程序起始


4. PUBLIC/EXTRN配对

; module1.asm
PUBLIC func1, data1
; module2.asm  
EXTRN func1:PROC, data1:WORD
; 链接时需要两个模块


十七、调试技巧

1. 查看符号值

; 在调试时查看EQU值
%OUT Buffer size is BUFFER_SIZE


2. 条件调试代码

IFDEF DEBUG
    ; 调试专用代码
    MOV AH, 02h
    MOV DL, 'D'
    INT 21h
ENDIF


3. 使用%OUT跟踪编译

%OUT Starting compilation...
%OUT Data segment defined
%OUT Code segment compiled


总结

8086汇编伪指令是汇编器的元语言，主要功能：

类别 主要伪指令 用途

数据定义 DB/DW/DD, EQU, DUP 定义变量、常量、数组

段控制 SEGMENT/ENDS, ASSUME, .MODEL 管理内存分段

过程控制 PROC/ENDP, PUBLIC/EXTRN 函数和模块化

程序结构 ORG, END, ALIGN 控制程序布局

条件汇编 IF/ELSE/ENDIF, IFDEF 条件编译

重复块 REPEAT, IRP, IRPC 代码生成

宏定义 MACRO/ENDM, LOCAL 代码复用

结构体 STRUC/ENDS, UNION 数据结构

列表控制 TITLE, PAGE, .LIST 输出控制

记住：伪指令不会生成机器码，它们只是告诉汇编器如何汇编。掌握伪指令是写出可维护、模块化汇编代码的关键。