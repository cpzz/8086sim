8086 CPU 模拟器
================

一个基于浏览器的 8086 CPU 模拟器，支持汇编代码的加载、汇编、单步执行和连续运行。

功能特点
--------
- 两遍汇编器：支持 MASM 风格的汇编语法，包括多段程序（CODE/DATA/STACK SEGMENT）
- CPU 模拟执行：单步执行、连续运行、断点调试
- 寄存器显示：实时显示通用寄存器、段寄存器、标志寄存器，变化高亮
- 内存显示：支持 CS/DS/SS/ES/IVT 段切换查看，读写操作高亮
- 屏幕输出：模拟 DOS 文本模式屏幕
- 中断支持：INT 21H 常用子功能（字符输入输出、字符串显示、程序退出、中断向量读写等）
- 键盘输入：支持键盘中断输入
- 中文支持：DB 字符串支持 UTF-8 编码的中文字符

支持的指令
----------
- 数据传送：MOV、PUSH、POP、XCHG、LEA、LDS、LES
- 算术运算：ADD、SUB、INC、DEC、MUL、IMUL、DIV、IDIV、NEG、CMP、CBW、CWD
- 逻辑运算：AND、OR、XOR、NOT、TEST、SHL、SHR、SAR、ROL、ROR、RCL、RCR
- 串操作：MOVSB、MOVSW、STOSB、STOSW、LODSB、LODSW、CMPSB、CMPSW、REP
- 控制转移：JMP、CALL、RET、IRET、条件跳转（JE/JNE/JG/JL/JA/JB 等）、LOOP
- 中断：INT、IRET
- 其他：NOP、CLC、STC、CLI、STI、CLD、STD、HLT

支持的伪指令
------------
- 段定义：SEGMENT/ENDS、ASSUME
- 过程定义：PROC/ENDP
- 数据定义：DB、DW、DD、DQ、DT、DUP
- 常量定义：EQU、=
- 其他：ORG、EVEN、END

项目结构
--------
index.html          主页面
css/styles.css      样式表
scripts/
  simulator.js      模拟器主控逻辑（状态机、UI 交互）
  memory.js         内存模块（1MB 地址空间）
  keyboard.js       键盘输入处理
  assembler/
    core.js         汇编器核心（三遍扫描）
    data-parser.js  数据定义解析（DB/DW/DD）
    directives.js   伪指令处理
    instruction-length.js  指令长度计算
    instruction-parser.js  指令解析与机器码生成
    operand-parser.js      操作数解析
  cpu/
    core.js         CPU 核心定义
    execution.js    指令执行
    registers.js    寄存器操作
    flags.js        标志位操作
    memory.js       CPU 内存访问
    addressing.js   寻址模式
    breakpoints.js  断点管理
    interrupts/
      int21h.js     DOS INT 21H 中断处理
      int16h.js     BIOS INT 16H 键盘中断
  display/
    instruction.js  指令列表显示
    memory.js       内存面板显示
    register.js     寄存器面板显示
    screen.js       屏幕显示
asm/                测试用汇编程序
doc/                设计文档

使用方法
--------
1. 用浏览器打开 index.html
2. 点击"加载文件"按钮，选择 .asm 汇编源文件
3. 使用"单步执行"逐条执行指令，或"执行"连续运行
4. 在寄存器、内存、屏幕面板查看执行结果
5. 点击指令行设置/取消断点
6. 点击"重置"恢复到加载后的初始状态
