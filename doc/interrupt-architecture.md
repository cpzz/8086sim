# 中断架构说明

## 概述

本模拟器实现了基于中断向量表 (IVT) 的标准 8086 中断架构，通过 BIOS 存根 (stub) + JavaScript 处理函数的方式模拟 BIOS/DOS 中断服务。

## 内存布局

```
物理地址范围          用途
─────────────────────────────────────────
0000:0000 ~ 0000:03FF  中断向量表 (IVT), 256个条目, 每条目4字节
F000:0020              INT 10H 存根 (IRET, 0xCF)
F000:002C              INT 16H 存根 (IRET, 0xCF)
F000:0042              INT 21H 存根 (IRET, 0xCF)
F000:01FF              默认存根 (IRET, 0xCF) — 未注册的中断统一指向此处
```

## 中断向量表 (IVT)

位于物理地址 `0000:0000` ~ `0000:03FF`，共 1KB，256 个条目。

每个条目 4 字节：

| 偏移 | 内容 |
|------|------|
| +0   | 处理程序偏移地址低字节 |
| +1   | 处理程序偏移地址高字节 |
| +2   | 处理程序段地址低字节 |
| +3   | 处理程序段地址高字节 |

例如 INT 21H 的 IVT 条目在地址 `0000:0084` (0x21 × 4 = 0x84)：

```
0000:0084  42 00 00 F0    → 向量地址 F000:0042
```

## IVT 初始化

在 `cpu.reset()` → `initInterruptSystem()` 中完成：

1. **已注册的中断**：为 INT 10H / 16H / 21H 分配独立存根地址
   - 存根偏移 = `intNum × 2` (INT 10H → 0x0020, INT 16H → 0x002C, INT 21H → 0x0042)
   - 在存根物理地址写入 `IRET` 指令 (0xCF)
   - 在 IVT 中写入 `F000:存根偏移`
   - 在 `biosHandlers` 映射中注册对应的 JS 处理函数

2. **未注册的中断**：统一指向默认存根 `F000:01FF`（也是一条 IRET）

## BIOS 存根机制

存根地址的物理内存中确实存放了一条 `IRET` (0xCF) 指令，但 CPU 的 `step()` 函数在执行前会**拦截**这些地址：

```
存根地址        对应中断    JS 处理函数
──────────────────────────────────────
F000:0020      INT 10H    () => true（暂未实现）
F000:002C      INT 16H    handleInt16()
F000:0042      INT 21H    handleInt21()
F000:01FF      默认         无（直接执行 IRET 返回）
```

## 软件中断流程 (INT 指令)

当 CPU 执行 `INT n` 指令 (操作码 0xCD) 时：

```
用户程序             CPU (execution.js)              BIOS 存根 (core.js)
   │                      │                              │
   │  INT 21H             │                              │
   ├─────────────────────►│                              │
   │                      │ 1. PUSH FLAGS                │
   │                      │ 2. PUSH CS                   │
   │                      │ 3. PUSH IP (返回地址)         │
   │                      │ 4. 清除 IF, TF               │
   │                      │ 5. 读取 IVT[0x84]            │
   │                      │    → F000:0042               │
   │                      │ 6. CS:IP = F000:0042         │
   │                      │                              │
   │                      │ 检测到 BIOS 存根地址          │
   │                      │──────────────────────────────►│
   │                      │    调用 JS handleInt21()      │
   │                      │◄──────────────────────────────│
   │                      │    返回 true/false            │
   │                      │                              │
   │                      │ 若返回 true (成功):           │
   │                      │ 7. POP IP                    │
   │                      │ 8. POP CS                    │
   │                      │ 9. POP FLAGS                 │
   │◄─────────────────────│                              │
   │  继续执行下一条指令    │                              │
```

### 阻塞处理

若 JS 处理函数返回 `false`（如 INT 16H AH=00 等待键盘输入）：

- CPU 回退栈指针，恢复 CS:IP:FLAGS
- IP 回退到 INT 指令自身（下次 step 会重新执行）
- `step()` 返回 `false`，模拟器进入"中断"状态等待输入

## 硬件中断流程

外部设备通过 `cpu.triggerInterrupt(n)` 将中断号推入 `pendingInterrupts` 队列。

在 `step()` 开始时检查：

```
if (IF === 1 && pendingInterrupts.length > 0) {
    intNum = pendingInterrupts.shift()
    PUSH FLAGS, CS, IP
    清除 IF, TF
    CS:IP = IVT[intNum]
}
```

随后 `step()` 继续执行 — 如果 CS:IP 指向 BIOS 存根，立即拦截并调用 JS 处理函数。

## BIOS 存根拦截点

`step()` 函数中有两个拦截点调用 JS 处理函数：

1. **INT 指令内部** (0xCD 分支)：执行 INT 后检测目标是否为 BIOS 存根，是则直接调用 JS 函数并自动 IRET，整个中断在一次 `step()` 内完成。

2. **step() 开头** (通用拦截)：如果 CPU 当前 CS:IP 恰好在 BIOS 存根地址（如用户 ISR 通过 `JMP FAR` 链回原始向量），也会拦截处理。

## 已实现的中断服务

### INT 21H — DOS 功能调用

| AH  | 功能         | 说明 |
|-----|-------------|------|
| 01H | 键盘输入回显 | 等待按键，AL=字符，回显到屏幕 |
| 02H | 字符输出     | 输出 DL 中的字符 |
| 06H | 直接控制台 I/O | DL=FF 时读键盘，否则输出字符 |
| 07H | 无回显键盘输入 | 等待按键，AL=字符，不回显 |
| 08H | 无回显键盘输入 | 同 07H |
| 09H | 字符串输出   | DS:DX 指向 '$' 结尾的字符串 |
| 0AH | 缓冲键盘输入 | 读取一行输入到缓冲区 |
| 0BH | 检查键盘状态 | AL=FF 有按键，AL=00 无按键 |
| 4CH | 程序终止     | 返回码在 AL |

### INT 16H — BIOS 键盘服务

| AH  | 功能         | 说明 |
|-----|-------------|------|
| 00H | 等待按键     | 阻塞等待，AH=扫描码，AL=ASCII |
| 01H | 检查按键     | ZF=0 有按键，ZF=1 无按键 |

### INT 10H — BIOS 显示服务

暂未实现具体功能，处理函数返回 `true`（空操作后直接返回）。

## ISR 链接 (Chaining)

如果用户汇编程序修改了 IVT 来安装自定义 ISR，例如：

```asm
; 保存原始向量
MOV AX, [0000:0084]     ; INT 21H 原偏移
MOV [old_21_off], AX
MOV AX, [0000:0086]     ; INT 21H 原段地址
MOV [old_21_seg], AX

; 安装新 ISR
MOV WORD PTR [0000:0084], OFFSET my_isr
MOV WORD PTR [0000:0086], CS
```

当自定义 ISR 执行完毕后通过 `JMP FAR [old_21]` 跳到 `F000:0042`，`step()` 开头的通用拦截会检测到 BIOS 存根地址，调用 JS 处理函数并执行 IRET，完成链式调用。

## 相关源码文件

| 文件 | 职责 |
|------|------|
| `scripts/cpu/core.js` | `initInterruptSystem()` — IVT 初始化、BIOS 存根写入、处理函数注册 |
| `scripts/cpu/execution.js` | `step()` — 硬件中断派发、BIOS 存根拦截；`INT 0xCD` / `IRET 0xCF` 指令实现；`triggerInterrupt()` |
| `scripts/cpu/interrupts/int21h.js` | INT 21H 各子功能的 JS 实现 |
| `scripts/cpu/interrupts/int16h.js` | INT 16H 各子功能的 JS 实现 |
| `scripts/display/ivt.js` | 中断向量表 UI 显示 |
