# 8086 CPU 模拟器 - 项目结构说明

## 项目概述

这是一个 **8086 CPU 模拟器**，用于模拟 8086 处理器的指令执行过程，提供可视化的寄存器、内存和指令显示，支持单步执行、断点调试等功能。

---

## 项目目录结构

```
8086sim/
├── index.html           # 主页面
├── asm/                 # 汇编测试程序目录
├── css/                 # 样式文件目录
├── doc/                 # 文档目录
└── scripts/             # JavaScript 核心代码目录
```

---

## 根目录

### `index.html` (10.82 KB)

主页面文件，包含完整的 HTML 结构。

**功能：**
- 左右布局：左侧显示屏幕/寄存器/内存，右侧显示汇编代码
- 顶部控制按钮：加载文件、单步执行、执行、暂停、重置
- 状态指示器显示当前执行状态
- 屏幕、寄存器面板、内存面板的布局定义

**主要元素：**
- 左侧面板（left-panel）：包含屏幕、寄存器、内存三个 tab
  - 屏幕 tab：DOS 80x25 显示网格
  - 寄存器 tab：通用寄存器、指针/索引寄存器、标志位、段寄存器
  - 内存 tab：内存段选择（CS/DS/SS/ES）、地址输入框、内存网格
- 右侧面板（right-panel）：代码显示面板
  - 代码控制头部：状态指示器、控制按钮
  - 指令面板：指令列表（地址、机器码、汇编指令、注释）

---

## `asm/` - 汇编测试程序目录

存放各种测试用的 8086 汇编程序，用于验证模拟器的功能。

### `simple_model.asm` (1.27 KB)
简单的 Hello World 程序
```assembly
.model small
.stack 100h
.data
    message db 'Hello, World!', 0dh, 0ah, '$'
.code
main proc
    mov ax, @data
    mov ds, ax
    lea dx, message
    mov ah, 9
    int 21h
    mov ah, 4ch
    int 21h
main endp
end main
```

### `test.asm` (318 B)
基础指令测试（ADD、MOV、NOP、RET）

### `memory_test.asm` (539 B)
内存操作测试

### `io_test.asm` (1.2 KB)
输入输出测试

### `call_test.asm` (1.27 KB)
调用指令测试（CALL、RET）

### `comprehensive_test.asm` (1.19 KB)
综合功能测试

### `test_lea.asm` (703 B)
LEA 指令测试

### `output_30_lines.asm` (3.25 KB)
输出30行测试，用于验证显示功能

---

## `css/` - 样式目录

### `styles.css` (23.08 KB)
项目主样式文件，定义所有界面样式。

**主要样式定义：**
- 页面布局样式（左右分栏、容器）
- Tab 切换样式
- 寄存器表格样式
- 内存网格样式
- 指令列表样式
- 按钮状态样式
- 高亮样式（寄存器改变、当前指令、断点、写入操作等）

---

## `doc/` - 文档目录

### `layout.md` (1.77 KB)
页面布局结构说明文档。

详细描述了页面的 HTML 结构层次：
- 浏览器窗口 → body → container → main-content
- 左侧区域（left-panel）：屏幕/寄存器/内存 tab
- 右侧区域（right-panel）：代码控制头部、指令面板

### `states.md` (2.28 KB)
状态转换图文档（PlantUML 格式）。

包含完整的按钮状态机：
- 7种状态：初始状态、已加载文件、单步执行、执行中、已暂停、已执行完毕、遇到断点
- 各状态之间的转换条件
- 每种状态下各按钮的可用/禁用状态

---

## `scripts/` - JavaScript 核心代码目录

### `memory.js` (4.67 KB)

内存模拟类。

**功能：**
- 模拟 1MB 内存空间 (0x00000-0xFFFFF)
- 初始化内存为随机值，模拟真实环境中的垃圾数据
- 提供字节读写方法：`read8()`, `write8()`
- 提供字读写方法：`read16()`, `write16()`
- 提供连续字节读取方法：`readBytes()`
- 内存转储方法：`getMemoryDump()`

**主要方法：**
```javascript
class Memory {
    constructor()                    // 创建1MB内存，初始化为随机值
    read8(address)                   // 读取8位数据
    write8(address, value)           // 写入8位数据
    read16(address)                  // 读取16位数据（小端序）
    write16(address, value)          // 写入16位数据（小端序）
    readBytes(address, length)       // 读取连续字节
    getMemoryDump(address, length)   // 获取内存转储
}
```

---

### `cpu.js` (60.4 KB)

8086 CPU 模拟器核心。

**功能：**
- 实现所有 8086 通用寄存器：AX, BX, CX, DX 及其子寄存器（AH, AL, BH, BL, CH, CL, DH, DL）
- 实现指针/索引寄存器：IP, SP, BP, SI, DI
- 实现段寄存器：CS, DS, SS, ES
- 实现标志位寄存器：CF, PF, AF, ZF, SF, TF, IF, DF, OF
- 指令执行引擎：fetch-decode-execute 循环
- 单步执行：`step()` 方法
- 连续执行：`run()` 方法
- 暂停执行：`pause()` 方法
- 断点管理：`addBreakpoint()`, `removeBreakpoint()`
- 寄存器操作跟踪
- 内存操作跟踪
- INT 21h 中断处理（DOS 中断）

**主要属性：**
- `registers`: 通用寄存器对象
- `segmentRegisters`: 段寄存器对象
- `flags`: 标志位对象
- `ip`: 指令指针
- `running`: 执行状态标志

**主要方法：**
```javascript
class CPU8086 {
    constructor(memory)              // 构造函数，接受内存对象
    reset()                          // 重置CPU（寄存器和标志位）
    step()                           // 单步执行一条指令
    run()                            // 连续执行直到遇到断点或结束
    pause()                          // 暂停执行
    getRegister(name)                // 获取寄存器值
    setRegister(name, value)         // 设置寄存器值
    getSegmentRegister(name)         // 获取段寄存器值
    setSegmentRegister(name, value)  // 设置段寄存器值
    getFlag(name)                    // 获取标志位值
    setFlag(name, value)             // 设置标志位值
    addBreakpoint(address)           // 添加断点
    removeBreakpoint(address)        // 移除断点
    getRegisterOperations()         // 获取寄存器操作跟踪
    getMemoryOperations()           // 获取内存操作跟踪
    clearRegisterOperations()       // 清除寄存器操作跟踪
    clearMemoryOperations()          // 清除内存操作跟踪
}
```

---

### `assembler.js` (50.13 KB)

汇编器。

**功能：**
- 解析 .asm 文件内容
- 将汇编代码转换为机器码
- 支持伪指令（.model, .stack, .data, .code）
- 支持数据定义（DB, DW, DD）
- 支持标签和符号
- 计算指令地址
- 处理注释

**主要属性：**
- `instructions`: 解析后的指令列表
- `dataSegments`: 数据段信息
- `symbols`: 符号表（标签）
- `memory`: 内存对象引用

**主要方法：**
```javascript
class Assembler {
    constructor(memory)              // 构造函数，接受内存对象
    loadFromFile(file)               // 从文件加载汇编代码
    parse(assemblyCode)              // 解析汇编代码
    resolveSymbols()                // 解析符号（标签）
    generateMachineCode()            // 生成机器码
}
```

---

### `ui.js` (3.85 KB)

屏幕渲染。

**功能：**
- 渲染 DOS 80x25 字符显示网格
- 处理字符输出和光标位置
- 支持清屏、换行、回车等操作

**主要方法：**
```javascript
function renderDisplayControl(container)  // 渲染显示网格
function updateDisplayOutput()            // 更新显示输出（由CPU调用）
```

---

### `script.js` (36.01 KB)

主控制脚本，协调所有模块。

**功能：**
- 初始化模拟器（内存、CPU、汇编器）
- 初始化 UI 事件监听器
- 处理文件加载
- 控制执行流程（单步/运行/暂停/重置）
- 更新寄存器显示
- 更新内存显示
- 更新指令列表显示
- 管理按钮状态
- 管理状态指示器
- 断点管理
- 寄存器/内存操作跟踪
- 高亮显示（寄存器改变、当前指令、内存写入）

**全局变量：**
```javascript
let memory;                              // 内存对象
let cpu;                                 // CPU对象
let assembler;                           // 汇编器对象
let instructions;                        // 指令列表
let breakpoints;                          // 断点集合
let currentMemorySegment;                // 当前选中的内存段
let currentLeftTab;                      // 当前选中的左侧tab
let currentState;                        // 当前状态
let segmentWriteAddresses;               // 各段写入的地址集合
let stackDisplayBase;                    // 堆栈段显示的起始地址
```

**主要函数：**
```javascript
// 初始化
function initSimulator()                 // 初始化模拟器
function initUI()                        // 初始化UI事件监听器

// 执行控制
function handleFileLoad(e)               // 处理文件加载
function stepExecution()                 // 单步执行
function runExecution()                  // 连续执行
function pauseExecution()                // 暂停执行
function resetSimulator()                // 重置模拟器

// 显示更新
function updateStatusIndicator(status)   // 更新状态指示器
function updateRegistersDisplay(ops)    // 更新寄存器显示
function updateMemoryDisplay(offset)     // 更新内存显示
function updateInstructionsDisplay()    // 更新指令列表显示
function updateUIDisplay()               // 更新屏幕显示

// 高亮和控制
function highlightIPRegister()           // 高亮IP寄存器
function highlightRegisterChanges(ops)   // 高亮寄存器改变
function clearRegisterHighlights()       // 清除寄存器高亮
function updateButtonStates(isRunning)   // 更新按钮状态

// 辅助函数
function parseAddress(addressStr)        // 解析地址字符串
function checkIfAtEnd()                  // 检查是否执行完毕
function findSegmentWriteAddresses()     // 查找各段写入的地址
function clearAllMemory()                // 清空所有段内存
function initializeSegmentMemory()       // 初始化不同段的内存值
```

---

## 执行状态机

模拟器支持7种执行状态：

1. **初始状态**
   - 页面加载后的初始状态
   - 只有"加载文件"按钮可用

2. **已加载文件**
   - 成功加载汇编文件后的状态
   - "加载文件"、"单步执行"、"执行"按钮可用

3. **单步执行**
   - 单步执行一条指令后的状态
   - "加载文件"、"单步执行"、"执行"、"重置"按钮可用

4. **执行中**
   - 连续执行过程中的状态
   - 只有"暂停"按钮可用

5. **已暂停**
   - 点击暂停按钮后的状态
   - "加载文件"、"单步执行"、"执行"、"重置"按钮可用

6. **已执行完毕**
   - 执行完最后一条指令后的状态
   - "加载文件"、"重置"按钮可用

7. **遇到断点**
   - 执行到断点时的状态
   - "加载文件"、"单步执行"、"执行"、"重置"按钮可用

---

## 核心功能特性

1. **汇编文件加载和解析**
   - 支持 .asm 文件格式
   - 自动解析为机器码和指令信息

2. **8086 CPU 指令模拟**
   - 完整实现 8086 指令集
   - 精确模拟指令执行过程

3. **寄存器实时显示**
   - 显示所有寄存器的当前值
   - 高亮显示发生变化的寄存器
   - 显示所有标志位状态

4. **四段内存可视化**
   - CS（代码段）、DS（数据段）、SS（堆栈段）、ES（附加段）
   - 显示内存地址、字节值、ASCII码
   - 高亮显示当前指令字节
   - 高亮显示写入操作的内存位置（CS段红色警告）

5. **指令列表显示**
   - 显示偏移地址、机器码、汇编指令、注释
   - 高亮当前执行的指令
   - 支持双击设置/取消断点

6. **执行控制**
   - 单步执行：每次执行一条指令
   - 连续执行：自动执行直到遇到断点或结束
   - 暂停：在执行过程中暂停
   - 重置：回到加载文件后的初始状态

7. **断点调试**
   - 支持在任意指令设置断点
   - 执行到断点自动暂停

8. **DOS 风格的输出显示**
   - 80x25 字符网格
   - 支持回车、换行、清屏等操作
   - 通过 INT 21h 中断实现

---

## 技术特点

- **纯前端实现**：无需后端服务器，直接在浏览器中运行
- **模块化设计**：内存、CPU、汇编器、UI 分离
- **实时跟踪**：寄存器操作和内存操作可追溯
- **可视化调试**：提供丰富的视觉反馈（高亮、状态指示）
- **用户友好**：直观的界面和清晰的状态管理
