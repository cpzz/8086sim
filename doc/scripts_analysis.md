# Scripts 目录结构分析

## 概述

这是一个完整的 **8086 汇编语言模拟器** 的 JavaScript 实现，支持汇编代码解析、指令执行、内存管理和 DOS 风格屏幕显示。

---

## 目录结构

```
scripts/
├── simulator.js              # 主控制器，管理整个模拟器状态
├── memory.js                 # 内存管理类（1MB内存空间）
├── keyboard.js               # 键盘输入处理
│
├── cpu/                      # CPU核心模块
│   ├── core.js               # CPU8086类定义（寄存器、标志位等）
│   ├── execution.js          # 指令执行引擎（3000+行，实现各种8086指令）
│   ├── flags.js              # 标志位更新逻辑
│   ├── addressing.js         # 寻址模式处理
│   ├── memory.js             # CPU内存访问
│   ├── registers.js          # 寄存器操作
│   ├── breakpoints.js        # 断点管理
│   └── interrupts/           # 中断处理
│       ├── int16h.js         # INT 16h（键盘）
│       └── int21h.js         # INT 21h（DOS功能调用）
│
├── assembler/                # 汇编器模块
│   ├── core.js               # Assembler类（20KB+，汇编代码解析）
│   ├── instruction-parser.js # 指令解析
│   ├── operand-parser.js     # 操作数解析
│   ├── instruction-length.js # 指令长度计算
│   ├── data-parser.js        # 数据定义解析（DB/DW/DD等）
│   └── directives.js          # 伪指令处理
│
└── display/                  # 显示模块
    ├── screen.js             # 屏幕显示（DOS 80x25文本模式）
    ├── register.js           # 寄存器显示
    ├── memory.js             # 内存显示
    └── instruction.js        # 指令列表显示
```

---

## 核心组件说明

### 1. 主控制器层

| 文件 | 功能描述 |
|------|----------|
| **simulator.js** | 全局状态管理、按钮事件处理、执行流程控制（单步/运行/暂停/重置） |

**全局变量**:
- `memory`: 内存对象
- `cpu`: CPU8086对象
- `assembler`: 汇编器对象
- `instructions`: 解析后的指令数组
- `breakpoints`: 断点集合
- `currentState`: 当前状态（初始状态/已加载文件/单步执行/执行中/已暂停/已执行完毕/遇到断点）

**核心函数**:
- `init()`: 初始化模拟器
- `stepExecution()`: 单步执行
- `runExecution()`: 连续执行
- `pauseExecution()`: 暂停执行
- `resetSimulator()`: 重置模拟器
- `handleFileLoad()`: 处理文件加载

---

### 2. 内存管理

| 文件 | 功能描述 |
|------|----------|
| **memory.js** | Memory类，管理1MB内存空间（0x00000-0xFFFFF） |

**核心方法**:
- `read8(address)`: 读取8位内存
- `write8(address, value)`: 写入8位内存
- `read16(address)`: 读取16位内存（小端序）
- `write16(address, value)`: 写入16位内存（小端序）
- `readBytes(address, length)`: 读取连续字节
- `writeBytes(address, bytes)`: 写入连续字节
- `getMemoryDump(startAddress, length)`: 获取内存转储（用于显示）
- `initRandom()`: 初始化为随机值（模拟真实环境垃圾数据）

---

### 3. CPU核心模块

#### 3.1 CPU8086类 (cpu/core.js)

**寄存器**:
```javascript
registers: {
    ax, bx, cx, dx, si, di, sp, bp  // 通用寄存器
}
segmentRegisters: {
    cs: 0x1000,  // 代码段
    ds: 0x2000,  // 数据段
    ss: 0x3000,  // 堆栈段
    es: 0x4000   // 附加段
}
ip: 0x0000  // 指令指针
```

**标志位**:
```javascript
flags: {
    cf,  // 进位标志
    pf,  // 奇偶标志
    af,  // 辅助进位标志
    zf,  // 零标志
    sf,  // 符号标志
    tf,  // 陷阱标志
    if,  // 中断允许标志
    df,  // 方向标志
    of   // 溢出标志
}
```

**核心方法**:
- `reset()`: 重置CPU
- `step()`: 单步执行
- `run()`: 连续执行
- `pause()`: 暂停执行
- `getRegister(name)`: 获取寄存器值
- `setRegister(name, value)`: 设置寄存器值
- `getSegmentRegister(name)`: 获取段寄存器值
- `setSegmentRegister(name, value)`: 设置段寄存器值

---

#### 3.2 指令执行引擎 (cpu/execution.js)

**实现的指令类别**:

| 类别 | 指令示例 |
|------|----------|
| 数据传送 | MOV, XCHG |
| 算术运算 | ADD, ADC, SUB, SBB, INC, DEC |
| 逻辑运算 | AND, OR, XOR, NOT, TEST |
| 移位指令 | SHL, SHR, SAL, SAR, ROL, ROR, RCL, RCR |
| 控制转移 | JMP, CALL, RET, Jcc（条件跳转） |
| 字符串操作 | MOVSB, MOVSW, CMPSB, CMPSW, SCASB, SCASW, LODSB, LODSW, STOSB, STOSW |
| 标志操作 | CLC, STC, CMC, CLD, STD, CLI, STI |
| 堆栈操作 | PUSH, POP |
| 中断指令 | INT, IRET |

---

#### 3.3 标志位更新 (cpu/flags.js)

**核心方法**:
- `updateFlags8(result, operand1, operand2, operation)`: 更新8位运算标志位
- `updateFlags16(result, operand1, operand2, operation)`: 更新16位运算标志位

**标志位计算规则**:
- `ZF`: 结果为0时置1
- `SF`: 结果最高位为1时置1
- `PF`: 结果中1的个数为偶数时置1
- `CF`: 加法溢出/减法借位时置1
- `AF`: 低4位进位/借位时置1
- `OF`: 有符号溢出时置1

---

#### 3.4 寻址模式 (cpu/addressing.js)

**支持的寻址模式**:
- 寄存器寻址: `AX`, `BX`, `CX`, `DX`, `SI`, `DI`, `BP`, `SP`
- 立即寻址: `1234h`, `100`
- 直接寻址: `[1234h]`
- 寄存器间接寻址: `[BX]`, `[SI]`, `[DI]`, `[BP]`
- 基址变址寻址: `[BX+SI]`, `[BX+DI]`, `[BP+SI]`, `[BP+DI]`
- 相对基址变址寻址: `[BX+SI+disp8]`, `[BX+DI+disp16]`

**核心方法**:
- `calculateEffectiveAddress(mod, rm, currentAddress)`: 计算有效地址
- `readRM8(mod, rm, currentAddress)`: 读取8位r/m操作数
- `writeRM8(mod, rm, currentAddress, value)`: 写入8位r/m操作数
- `readRM16(mod, rm, currentAddress)`: 读取16位r/m操作数
- `writeRM16(mod, rm, currentAddress, value)`: 写入16位r/m操作数

---

#### 3.5 中断处理 (cpu/interrupts/)

| 文件 | 功能描述 |
|------|----------|
| **int16h.js** | INT 16h - 键盘BIOS中断 |
| **int21h.js** | INT 21h - DOS功能调用 |

**INT 21h 支持的功能**:
- `AH=01h`: 带回显的字符输入
- `AH=02h`: 字符输出
- `AH=09h`: 字符串输出
- `AH=0Ah`: 缓冲输入
- `AH=4Ch`: 程序终止

---

### 4. 汇编器模块

#### 4.1 汇编器核心 (assembler/core.js)

**核心属性**:
```javascript
symbols: {}                    // 符号表
instructions: []               // 解析后的指令
dataSegments: []              // 数据段
codeDataSegments: []          // 代码段中的数据定义
equDefinitions: []            // EQU常量定义
currentSegment: 'code'        // 当前段
model: 'small'                // 内存模型
entryPoint: null              // 入口点
```

**核心方法**:
- `parse(code)`: 解析汇编代码（两遍扫描）
- `loadFromFile(file)`: 从文件加载汇编代码
- `getInstructionLength(line)`: 计算指令长度
- `getDirectiveType(line)`: 识别伪指令类型
- `parseDB(dataPart)`: 解析DB数据定义
- `parseDW(dataPart)`: 解析DW数据定义
- `parseDD(dataPart)`: 解析DD数据定义

**支持的伪指令**:
- 段定义: `.CODE`, `.DATA`
- 数据定义: `DB`, `DW`, `DD`, `DQ`, `DT`
- 符号定义: `EQU`, `=`, `LABEL`
- 过程定义: `PROC`, `ENDP`
- 对齐指令: `EVEN`
- 定位指令: `ORG`
- 结束指令: `END label`

---

#### 4.2 汇编器子模块

| 文件 | 功能描述 |
|------|----------|
| **instruction-parser.js** | 指令解析，将汇编指令转换为操作码 |
| **operand-parser.js** | 操作数解析，解析寄存器、立即数、内存操作数 |
| **instruction-length.js** | 指令长度计算，根据操作数类型计算指令字节数 |
| **data-parser.js** | 数据定义解析，处理DB/DW/DD/DQ/DT |
| **directives.js** | 伪指令处理 |

---

### 5. 显示模块

#### 5.1 屏幕显示 (display/screen.js)

**功能**: 模拟 DOS 80x25 文本模式屏幕

**核心方法**:
- `initScreen()`: 初始化屏幕，设置事件监听
- `updateScreenDisplay()`: 更新屏幕显示
- `renderDisplayControl(memoryGrid)`: 渲染屏幕内容

**显示特性**:
- 80列 x 25行
- 支持回车(\\r)和换行(\\n)
- 超出屏幕时自动滚动
- 光标位置显示

---

#### 5.2 寄存器显示 (display/register.js)

显示所有寄存器的当前值，包括:
- 通用寄存器: AX, BX, CX, DX, SI, DI, BP, SP
- 段寄存器: CS, DS, SS, ES
- 指令指针: IP
- 标志位: CF, PF, AF, ZF, SF, TF, IF, DF, OF

---

#### 5.3 内存显示 (display/memory.js)

显示内存内容，支持:
- 按段切换显示 (CS/DS/SS/ES)
- 按偏移地址跳转
- 上下翻页
- 十六进制 + ASCII 格式显示

---

#### 5.4 指令列表显示 (display/instruction.js)

显示解析后的指令列表，包括:
- 地址
- 机器码
- 汇编指令
- 当前执行指令高亮
- 断点标记

---

### 6. 键盘输入 (keyboard.js)

**功能**: 处理键盘输入事件

**核心函数**:
- `setupKeyboardInput()`: 设置键盘事件监听
- `handleKeyPress(callback)`: 处理键盘输入请求

**特性**:
- 支持可打印字符和特殊键
- 回车键自动添加换行符 (CR+LF)
- 等待键盘输入时阻止其他事件

---

## 执行流程

```
1. 加载.asm文件
   ↓
2. Assembler解析（两遍扫描）
   - 第一遍: 收集标签、计算地址
   - 第二遍: 生成机器码
   ↓
3. 写入Memory
   - 代码段 → CS段
   - 数据段 → DS段
   ↓
4. 用户点击"运行"或"单步"
   ↓
5. CPU执行指令
   - 取指 → 译码 → 执行
   - 更新寄存器、标志位、内存
   ↓
6. Display模块更新
   - 屏幕显示
   - 寄存器显示
   - 内存显示
   - 指令列表高亮
```

---

## 关键数据结构

### Memory类
```javascript
class Memory {
    size: 1024 * 1024  // 1MB
    memory: Uint8Array(1048576)  // 内存数组
}
```

### CPU8086类
```javascript
class CPU8086 {
    registers: {
        ax, bx, cx, dx, si, di, sp, bp
    }
    segmentRegisters: {
        cs: 0x1000,
        ds: 0x2000,
        ss: 0x3000,
        es: 0x4000
    }
    ip: 0x0000
    flags: { cf, pf, af, zf, sf, tf, if, df, of }
    breakpoints: Set
    running: boolean
    outputBuffer: string
    keyboardBuffer: array
}
```

### Assembler类
```javascript
class Assembler {
    memory: Memory
    symbols: object  // 符号表
    instructions: array
    dataSegments: array
    codeDataSegments: array
    equDefinitions: array
    currentSegment: 'code' | 'data'
    model: 'small'
    entryPoint: string | null
}
```

---

## 内存布局

| 段 | 起始地址 | 用途 |
|----|----------|------|
| CS | 0x10000 | 代码段 |
| DS | 0x20000 | 数据段 |
| SS | 0x30000 | 堆栈段 |
| ES | 0x40000 | 附加段 |

**物理地址计算**: `物理地址 = 段地址 × 16 + 偏移地址`

---

## 支持的指令集

### 数据传送
- MOV, XCHG, PUSH, POP

### 算术运算
- ADD, ADC, SUB, SBB, INC, DEC, NEG, CMP

### 逻辑运算
- AND, OR, XOR, NOT, TEST

### 移位指令
- SHL, SHR, SAL, SAR, ROL, ROR, RCL, RCR

### 控制转移
- JMP (短/近/远)
- CALL (近/远)
- RET/RETN/RETF
- 条件跳转: JA/JAE/JB/JBE/JC/JE/JG/JGE/JL/JLE/JNA/JNAE/JNB/JNBE/JNC/JNE/JNG/JNGE/JNL/JNLE/JNO/JNP/JNS/JNZ/JO/JP/JPE/JPO/JS/JZ

### 字符串操作
- MOVSB/MOVSW, CMPSB/CMPSW, SCASB/SCASW, LODSB/LODSW, STOSB/STOSW
- REP, REPE/REPZ, REPNE/REPNZ

### 标志操作
- CLC, STC, CMC, CLD, STD, CLI, STI

### 中断指令
- INT n, IRET

---

## 状态机

模拟器支持以下状态:

| 状态 | 描述 |
|------|------|
| 初始状态 | 未加载任何文件 |
| 已加载文件 | 文件已加载，等待执行 |
| 单步执行 | 单步执行中 |
| 执行中 | 连续执行中 |
| 已暂停 | 用户暂停执行 |
| 已执行完毕 | 执行到最后一条指令 |
| 遇到断点 | 执行到断点处 |

---

## 技术特点

1. **纯JavaScript实现**: 无需任何外部依赖
2. **模块化设计**: 清晰的模块划分，易于维护和扩展
3. **完整的8086指令集**: 支持大部分常用指令
4. **DOS兼容**: 支持INT 21h功能调用
5. **可视化调试**: 实时显示寄存器、内存、指令执行
6. **断点支持**: 支持设置断点进行调试
7. **键盘输入**: 支持DOS风格的键盘输入

---

## 文件依赖关系

```
index.html
    ├── simulator.js (主入口)
    │   ├── memory.js
    │   ├── keyboard.js
    │   ├── cpu/core.js
    │   │   ├── cpu/execution.js
    │   │   ├── cpu/flags.js
    │   │   ├── cpu/addressing.js
    │   │   ├── cpu/memory.js
    │   │   ├── cpu/registers.js
    │   │   ├── cpu/breakpoints.js
    │   │   └── cpu/interrupts/*.js
    │   ├── assembler/core.js
    │   │   ├── assembler/instruction-parser.js
    │   │   ├── assembler/operand-parser.js
    │   │   ├── assembler/instruction-length.js
    │   │   ├── assembler/data-parser.js
    │   │   └── assembler/directives.js
    │   └── display/*.js
```

---

## 扩展建议

1. **指令扩展**: 在 `cpu/execution.js` 中添加更多指令
2. **中断扩展**: 在 `cpu/interrupts/` 中添加更多中断处理
3. **伪指令扩展**: 在 `assembler/` 中添加更多伪指令支持
4. **显示增强**: 在 `display/` 中添加更多显示功能
5. **调试功能**: 添加变量监视、表达式求值等高级调试功能
