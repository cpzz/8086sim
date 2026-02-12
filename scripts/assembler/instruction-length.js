// 获取指令的真实长度
Assembler.prototype.getInstructionLength = function(line) {
    // 简单实现，实际需要更复杂的解析
    const lineWithoutComment = line.split(';')[0].trim();

    const lowerLine = lineWithoutComment.toLowerCase();

    // 处理 DB 数据定义
    if (lowerLine.startsWith('db')) {
        const dataPart = lineWithoutComment.substring(2).trim();
        return this.parseDB(dataPart).length;
    }

    // 处理 DW 数据定义
    if (lowerLine.startsWith('dw')) {
        const dataPart = lineWithoutComment.substring(2).trim();
        return this.parseDW(dataPart).length;
    }

    // 处理 DD 数据定义
    if (lowerLine.startsWith('dd')) {
        const dataPart = lineWithoutComment.substring(2).trim();
        return this.parseDD(dataPart).length;
    }

    // 处理 DQ 数据定义（四字，8字节）
    if (lowerLine.startsWith('dq')) {
        const dataPart = lineWithoutComment.substring(2).trim();
        return this.parseDQ(dataPart).length;
    }

    // 处理 DT 数据定义（十字节，10字节）
    if (lowerLine.startsWith('dt')) {
        const dataPart = lineWithoutComment.substring(2).trim();
        return this.parseDT(dataPart).length;
    }

    // 处理 ORG 伪指令
    if (lowerLine.startsWith('org ')) {
        return 0; // ORG 不占用空间
    }

    // 处理 EVEN 伪指令
    if (lowerLine === 'even') {
        return 0; // EVEN 不占用空间，只是对齐
    }

    // 处理 PROC 伪指令（如 "myProc PROC" 或 "myProc PROC NEAR"）
    if (/\bproc\b/i.test(lineWithoutComment)) {
        return 0; // PROC 不占用空间
    }

    // 处理 ENDP 伪指令
    if (/\bendp\b/i.test(lineWithoutComment)) {
        return 0; // ENDP 不占用空间
    }

    // 处理 LABEL 伪指令（如 "myLabel LABEL BYTE"）
    if (/^\w+\s+label\s+(byte|word|dword|qword|tbyte|near|far)/i.test(lineWithoutComment)) {
        return 0; // LABEL 不占用空间
    }

    // 处理 EQU 常量定义
    if (lineWithoutComment.toLowerCase().includes(' equ ')) {
        return 0; // EQU 不占用空间
    }

    // 处理等号赋值（如 "count = 100"）
    if (/^\w+\s*=\s*.+$/.test(lineWithoutComment)) {
        return 0; // 等号赋值不占用空间
    }

    const opcodeEndIndex = lineWithoutComment.indexOf(' ');
    const opcode = opcodeEndIndex === -1 ? lineWithoutComment.toLowerCase() : lineWithoutComment.substring(0, opcodeEndIndex).toLowerCase();
    const operandsPart = opcodeEndIndex === -1 ? '' : lineWithoutComment.substring(opcodeEndIndex).trim();
    const operands = operandsPart.split(/[,\s]+/).filter(Boolean).map(op => op.toLowerCase());

    switch (opcode) {
        case 'nop':
        case 'ret':
        case 'retf':
        case 'pushf':
        case 'popf':
        case 'hlt':
        case 'cmc':
        case 'clc':
        case 'stc':
        case 'cld':
        case 'std':
        case 'cli':
        case 'sti':
        case 'into':
        case 'iret':
        case 'aaa':
        case 'aas':
        case 'daa':
        case 'das':
        case 'aam':
        case 'aad':
        case 'wait':
        case 'lock':
        case 'xlat':
        case 'leave':
        case 'movsb':
        case 'movsw':
        case 'cmpsb':
        case 'cmpsw':
        case 'scasb':
        case 'scasw':
        case 'lodsb':
        case 'lodsw':
        case 'stosb':
        case 'stosw':
            return 1;
        case 'rep':
            // REP前缀 + 串操作指令 = 2字节
            return 2;
        case 'repz':
        case 'repe':
        case 'repnz':
        case 'repne':
            return 1;
        case 'add':
        case 'sub':
        case 'and':
        case 'or':
        case 'xor':
            // 综合长度策略，支持寄存器、内存和立即数
            if (operands.length === 2) {
                const op0 = operands[0];
                const op1 = operands[1];
                
                // 辅助函数：检查是否为内存操作数
                const isMemoryOperand = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    return cleanOp.includes('[');
                };
                
                // 辅助函数：估计内存操作数长度
                const estimateMemoryLength = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    if (!cleanOp.includes('[')) return 0; // 不是内存操作数
                    
                    const match = cleanOp.match(/\[(.*?)\]/);
                    if (!match) return 4; // 保守估计
                    
                    const inside = match[1].toLowerCase().trim();
                    
                    // 检查是否有 + 号（带位移的间接寻址）
                    if (inside.includes('+')) {
                        // 检查位移是否在 -128 到 127 范围内
                        const parts = inside.split('+');
                        const lastPart = parts[parts.length - 1].trim();
                        // 简单判断：如果有数字或h结尾，可能是直接位移
                        if (/^\d+$/.test(lastPart) || /^\d+[hH]$/.test(lastPart)) {
                            const num = parseInt(lastPart.replace(/[hH]$/, ''), 
                                lastPart.toLowerCase().endsWith('h') ? 16 : 10);
                            if (num >= -128 && num <= 127) {
                                return 3; // 短位移
                            }
                        }
                        return 4; // 长位移或复杂位移
                    }
                    
                    // 寄存器间接寻址
                    const regNames = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'];
                    if (regNames.some(reg => inside === reg)) {
                        return 2;
                    }
                    
                    // 直接地址
                    return 4;
                };
                
                // 情况1：立即数操作 (寄存器/内存 <- 立即数)
                if (this.isImmediate(op1)) {
                    // 子情况1A：寄存器 <- 立即数
                    if (!isMemoryOperand(op0)) {
                        const reg = op0;
                        // 8位寄存器
                        if (['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'].includes(reg)) {
                            // AL有优化：2字节，其他8位寄存器：3字节
                            return reg === 'al' ? 2 : 3;
                        }
                        // 16位寄存器
                        if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(reg)) {
                            // AX有优化：3字节，其他16位寄存器：4字节
                            return reg === 'ax' ? 3 : 4;
                        }
                        // 未知寄存器或标签：保守估计6字节
                        return 6;
                    }
                    
                    // 子情况1B：内存 <- 立即数
                    const memLength = estimateMemoryLength(op0);
                    // 根据表格：内存+立即数 = 内存长度 + 立即数长度
                    // 对于直接地址+imm8: 4字节，直接地址+imm16: 5字节
                    // 保守估计：内存长度 + 2字节（立即数）
                    return memLength + 2;
                }
                
                // 情况2：内存操作 (寄存器 <- 内存 或 内存 <- 寄存器)
                const op0IsMem = isMemoryOperand(op0);
                const op1IsMem = isMemoryOperand(op1);
                
                if (op0IsMem && !op1IsMem) {
                    // 内存 <- 寄存器
                    return estimateMemoryLength(op0);
                } else if (!op0IsMem && op1IsMem) {
                    // 寄存器 <- 内存
                    return estimateMemoryLength(op1);
                } else if (op0IsMem && op1IsMem) {
                    // 内存 <- 内存（不支持，但保守估计）
                    return Math.max(estimateMemoryLength(op0), estimateMemoryLength(op1)) + 2;
                }
                
                // 情况3：寄存器 <- 寄存器
                return 2;
            }
            // 默认情况：保守估计2字节
            return 2;
        case 'adc':
        case 'sbb':
            // 使用与ADD相同的综合长度策略
            if (operands.length === 2) {
                const op0 = operands[0];
                const op1 = operands[1];
                
                // 辅助函数：检查是否为内存操作数
                const isMemoryOperand = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    return cleanOp.includes('[');
                };
                
                // 辅助函数：估计内存操作数长度
                const estimateMemoryLength = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    if (!cleanOp.includes('[')) return 0; // 不是内存操作数
                    
                    const match = cleanOp.match(/\[(.*?)\]/);
                    if (!match) return 4; // 保守估计
                    
                    const inside = match[1].toLowerCase().trim();
                    
                    // 检查是否有 + 号（带位移的间接寻址）
                    if (inside.includes('+')) {
                        // 检查位移是否在 -128 到 127 范围内
                        const parts = inside.split('+');
                        const lastPart = parts[parts.length - 1].trim();
                        // 简单判断：如果有数字或h结尾，可能是直接位移
                        if (/^\d+$/.test(lastPart) || /^\d+[hH]$/.test(lastPart)) {
                            const num = parseInt(lastPart.replace(/[hH]$/, ''), 
                                lastPart.toLowerCase().endsWith('h') ? 16 : 10);
                            if (num >= -128 && num <= 127) {
                                return 3; // 短位移
                            }
                        }
                        return 4; // 长位移或复杂位移
                    }
                    
                    // 寄存器间接寻址
                    const regNames = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'];
                    if (regNames.some(reg => inside === reg)) {
                        return 2;
                    }
                    
                    // 直接地址
                    return 4;
                };
                
                // 情况1：立即数操作 (寄存器/内存 <- 立即数)
                if (this.isImmediate(op1)) {
                    // 子情况1A：寄存器 <- 立即数
                    if (!isMemoryOperand(op0)) {
                        const reg = op0;
                        // 8位寄存器
                        if (['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'].includes(reg)) {
                            // AL有优化：2字节，其他8位寄存器：3字节
                            return reg === 'al' ? 2 : 3;
                        }
                        // 16位寄存器
                        if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(reg)) {
                            // AX有优化：3字节，其他16位寄存器：4字节
                            return reg === 'ax' ? 3 : 4;
                        }
                        // 未知寄存器或标签：保守估计6字节
                        return 6;
                    }
                    
                    // 子情况1B：内存 <- 立即数
                    const memLength = estimateMemoryLength(op0);
                    // 保守估计：内存长度 + 2字节（立即数）
                    return memLength + 2;
                }
                
                // 情况2：内存操作 (寄存器 <- 内存 或 内存 <- 寄存器)
                const op0IsMem = isMemoryOperand(op0);
                const op1IsMem = isMemoryOperand(op1);
                
                if (op0IsMem && !op1IsMem) {
                    // 内存 <- 寄存器
                    return estimateMemoryLength(op0);
                } else if (!op0IsMem && op1IsMem) {
                    // 寄存器 <- 内存
                    return estimateMemoryLength(op1);
                } else if (op0IsMem && op1IsMem) {
                    // 内存 <- 内存（不支持，但保守估计）
                    return Math.max(estimateMemoryLength(op0), estimateMemoryLength(op1)) + 2;
                }
                
                // 情况3：寄存器 <- 寄存器
                return 2;
            }
            // 默认情况：保守估计2字节
            return 2;
        case 'mov':
            // 使用最坏情况长度策略
            if (this.isImmediate(operands[1])) {
                // 立即数操作
                if (operands[0].includes('[')) {
                    // 内存寻址 + 立即数：最坏情况6字节
                    return 6;
                } else if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(operands[0])) {
                    // 16位寄存器 + 立即数：3字节
                    return 3;
                } else if (['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(operands[0])) {
                    // 8位寄存器 + 立即数：2字节
                    return 2;
                } else {
                    // 标签 + 立即数：最坏情况6字节
                    return 6;
                }
            }
            // 检查是否是从数据段变量加载数据（例如 MOV DL, SINGLE_TOP_LEFT）
                // 这种指令在8086中通常为4字节（8A /r modrm disp16）
                else if (!operands[0].includes('[') && !operands[1].includes('[')) {
                    // 检查第一个操作数是否是寄存器，第二个操作数是否是已知标签
                    const isDestReg8 = ['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(operands[0].toLowerCase());
                    const isDestReg16 = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(operands[0].toLowerCase());
                    const isSrcLabel = this.symbols.hasOwnProperty(operands[1].toLowerCase());
                    // 如果是寄存器到寄存器的操作，不是我们要处理的情况
                    const isRegToReg = (isDestReg8 || isDestReg16) && 
                                    (['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh', 'ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(operands[1].toLowerCase()));
                    
                    if ((isDestReg8 || isDestReg16) && !isRegToReg) {
                        // 如果不是寄存器到寄存器，很可能是MOV reg, label格式
                        // MOV reg, label - 这种指令通常为4字节（对于8位寄存器）或3-4字节（对于16位寄存器）
                        return isDestReg8 ? 4 : 3; // 8位寄存器：4字节；16位寄存器：3字节
                    }
                }
            // 内存寻址操作：最坏情况4字节
            if (operands[0].includes('[') || operands[1].includes('[')) {
                return 4;
            }
            // 寄存器到寄存器：2字节
            return 2;
        case 'shl':
        case 'shr':
        case 'sal':
        case 'sar':
        case 'rol':
        case 'ror':
        case 'rcl':
        case 'rcr':
            return 2;
        case 'push':
        case 'pop':
            return 1;
        case 'cmp':
        case 'test':
            // 使用与ADD相同的综合长度策略
            if (operands.length === 2) {
                const op0 = operands[0];
                const op1 = operands[1];
                
                // 辅助函数：检查是否为内存操作数
                const isMemoryOperand = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    return cleanOp.includes('[');
                };
                
                // 辅助函数：估计内存操作数长度
                const estimateMemoryLength = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    if (!cleanOp.includes('[')) return 0; // 不是内存操作数
                    
                    const match = cleanOp.match(/\[(.*?)\]/);
                    if (!match) return 4; // 保守估计
                    
                    const inside = match[1].toLowerCase().trim();
                    
                    // 检查是否有 + 号（带位移的间接寻址）
                    if (inside.includes('+')) {
                        // 检查位移是否在 -128 到 127 范围内
                        const parts = inside.split('+');
                        const lastPart = parts[parts.length - 1].trim();
                        // 简单判断：如果有数字或h结尾，可能是直接位移
                        if (/^\d+$/.test(lastPart) || /^\d+[hH]$/.test(lastPart)) {
                            const num = parseInt(lastPart.replace(/[hH]$/, ''), 
                                lastPart.toLowerCase().endsWith('h') ? 16 : 10);
                            if (num >= -128 && num <= 127) {
                                return 3; // 短位移
                            }
                        }
                        return 4; // 长位移或复杂位移
                    }
                    
                    // 寄存器间接寻址
                    const regNames = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'];
                    if (regNames.some(reg => inside === reg)) {
                        return 2;
                    }
                    
                    // 直接地址
                    return 4;
                };
                
                // 情况1：立即数操作 (寄存器/内存 <- 立即数)
                if (this.isImmediate(op1)) {
                    // 子情况1A：寄存器 <- 立即数
                    if (!isMemoryOperand(op0)) {
                        const reg = op0;
                        // 8位寄存器
                        if (['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'].includes(reg)) {
                            // AL有优化：2字节，其他8位寄存器：3字节
                            return reg === 'al' ? 2 : 3;
                        }
                        // 16位寄存器
                        if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(reg)) {
                            // AX有优化：3字节，其他16位寄存器：4字节
                            return reg === 'ax' ? 3 : 4;
                        }
                        // 未知寄存器或标签：保守估计6字节
                        return 6;
                    }
                    
                    // 子情况1B：内存 <- 立即数
                    const memLength = estimateMemoryLength(op0);
                    // 保守估计：内存长度 + 2字节（立即数）
                    return memLength + 2;
                }
                
                // 情况2：内存操作 (寄存器 <- 内存 或 内存 <- 寄存器)
                const op0IsMem = isMemoryOperand(op0);
                const op1IsMem = isMemoryOperand(op1);
                
                if (op0IsMem && !op1IsMem) {
                    // 内存 <- 寄存器
                    return estimateMemoryLength(op0);
                } else if (!op0IsMem && op1IsMem) {
                    // 寄存器 <- 内存
                    return estimateMemoryLength(op1);
                } else if (op0IsMem && op1IsMem) {
                    // 内存 <- 内存（不支持，但保守估计）
                    return Math.max(estimateMemoryLength(op0), estimateMemoryLength(op1)) + 2;
                }
                
                // 情况3：寄存器 <- 寄存器
                return 2;
            }
            // 默认情况：保守估计2字节
            return 2;
        case 'jmp':
            // 根据语法明确确定JMP指令长度
            if (operands.length === 2 && operands[0] === 'short') {
                return 2; // JMP SHORT
            } else if (operands.length === 2 && operands[0] === 'far') {
                return 5; // JMP FAR
            } else {
                return 3; // JMP NEAR 或 默认
            }
        case 'jz':
        case 'je':
        case 'jnz':
        case 'jne':
        case 'jc':
        case 'jb':
        case 'jnae':
        case 'jnc':
        case 'jnb':
        case 'jae':
        case 'js':
        case 'jns':
        case 'jo':
        case 'jno':
        case 'jp':
        case 'jpe':
        case 'jnp':
        case 'jpo':
        case 'jl':
        case 'jnge':
        case 'jnl':
        case 'jge':
        case 'ja':
        case 'jnbe':
        case 'jna':
        case 'jbe':
        case 'jg':
        case 'jnle':
        case 'jng':
        case 'jle':
        case 'loop':
        case 'loopz':
        case 'loope':
        case 'loopnz':
        case 'loopne':
        case 'jcxz':
            return 2;
        case 'call':
            // 根据语法明确确定CALL指令长度
            if (operands.length === 2 && operands[0] === 'far') {
                return 5; // CALL FAR
            } else {
                return 3; // CALL NEAR 或 默认
            }
        case 'int':
            return 2;
        case 'inc':
        case 'dec':
            if (operands.length > 0) {
                const op = operands[0];
                // 移除可能的 byte ptr 和 word ptr 前缀
                const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                
                // 检查是否是内存操作数（包含 [）
                if (cleanOp.includes('[')) {
                    // 提取括号内的内容
                    const match = cleanOp.match(/\[(.*?)\]/);
                    if (match) {
                        const inside = match[1].toLowerCase().trim();
                        // 检查是否有 + 号（带位移的间接寻址）
                        if (inside.includes('+')) {
                            return 3; // INC BYTE PTR [BX+5] 等，3字节
                        }
                        // 检查是否是寄存器间接寻址
                        const regNames = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'];
                        if (regNames.some(reg => inside === reg)) {
                            return 2; // INC BYTE PTR [BX] 等，2字节
                        }
                    }
                    // 其他情况（直接寻址、复杂寻址）：保守估计4字节
                    return 4;
                }
                
                // 寄存器操作数
                const reg = op;
                // 16位寄存器：1字节，8位寄存器：2字节
                if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(reg)) {
                    return 1;
                } else if (['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'].includes(reg)) {
                    return 2;
                }
            }
            // 默认保守估计：4字节（最坏情况的内存操作数）
            return 4;
        case 'neg':
        case 'not':
            return 2; // 总是2字节
        case 'mul':
        case 'imul':
        case 'div':
        case 'idiv':
            return 2;
        case 'lea':
        case 'lds':
        case 'les':
            return 4;
        case 'in':
            if (operands[1] === 'dx') return 1;
            return 2;
        case 'out':
            if (operands[0] === 'dx') return 1;
            return 2;
        case 'enter':
            return 4;
        case 'xchg':
            if (operands.length === 2) {
                const op0 = operands[0];
                const op1 = operands[1];
                
                const isMemoryOperand = (op) => {
                    const cleanOp = op.replace(/\b(byte|word)\s+ptr\s+/gi, '').trim();
                    return cleanOp.includes('[');
                };
                
                const op0IsMem = isMemoryOperand(op0);
                const op1IsMem = isMemoryOperand(op1);
                
                if (op0IsMem && op1IsMem) {
                    return 0;
                } else if (op0IsMem || op1IsMem) {
                    const memOp = op0IsMem ? op0 : op1;
                    const match = memOp.match(/\[(.*?)\]/);
                    if (match) {
                        const inside = match[1].toLowerCase().trim();
                        if (inside.includes('+')) {
                            return 3;
                        } else {
                            return 4;
                        }
                    }
                    return 4;
                } else {
                    const axRegs = ['ax', 'bx', 'cx', 'dx'];
                    if ((op0 === 'ax' && axRegs.includes(op1)) || (op1 === 'ax' && axRegs.includes(op0))) {
                        return 1;
                    }
                    return 2;
                }
            }
            return 2;
        default:
            return 2;
    }
}
