// 解析指令
Assembler.prototype.parseInstruction = function(line, address) {
    const originalLine = line; // 保存原始行
    // 先移除注释，然后分割指令
    const lineWithoutComment = line.split(';')[0].trim();

    // 检查是否是 EVEN 伪指令（不应该作为可执行指令）
    if (lineWithoutComment.toLowerCase() === 'even') {
        return null; // EVEN 不是可执行指令
    }

    // 分割操作码和操作数
    const opcodeEndIndex = lineWithoutComment.indexOf(' ');
    const opcode = opcodeEndIndex === -1 ? lineWithoutComment.toLowerCase() : lineWithoutComment.substring(0, opcodeEndIndex).toLowerCase();
    // 提取操作数，移除逗号并分割
    const operandsPart = opcodeEndIndex === -1 ? '' : lineWithoutComment.substring(opcodeEndIndex).trim();

    // 检测是否指定了 byte ptr 或 word ptr
    const hasBytePtr = /\bbyte\s+ptr\s+/i.test(operandsPart);
    const hasWordPtr = /\bword\s+ptr\s+/i.test(operandsPart);

    // 处理 offset 操作符：将 "offset label" 转换为 "label"
    let operandsPartProcessed = operandsPart.replace(/\boffset\s+/gi, '');
    // 处理 byte ptr 和 word ptr 操作符
    operandsPartProcessed = operandsPartProcessed.replace(/\bbyte\s+ptr\s+/gi, '');
    operandsPartProcessed = operandsPartProcessed.replace(/\bword\s+ptr\s+/gi, '');

    const operands = operandsPartProcessed.split(/[,\s]+/).filter(Boolean).map(op => op.toLowerCase());
    // 提取原始操作数（不转换为小写），用于标签匹配
    const originalOperands = operandsPartProcessed.split(/[,\s]+/).filter(Boolean);

    const length = this.getInstructionLength(line);

    switch (opcode) {
        case 'nop':
            return {
                address,
                opcode: 'NOP',
                operands: [],
                machineCode: [0x90],
                length,
                originalLine: originalLine.trim()
            };
        case 'add':
            // 处理 ADD r8, imm8 指令
            const addReg8Map = {
                'al': 0, 'cl': 1, 'dl': 2, 'bl': 3,
                'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7
            };
            if (addReg8Map.hasOwnProperty(operands[0]) && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(operands[1]);
                if (operands[0] === 'al') {
                    // ADD AL, imm8 - 操作码04
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['AL', operands[1]],
                        machineCode: [0x04, imm8],
                        length,
                        originalLine: originalLine.trim()
                    };
                } else {
                    // ADD r/m8, imm8 - 操作码80, mod=11, reg=0(ADD), rm=寄存器编码
                    const rm = addReg8Map[operands[0]];
                    const modRM = (3 << 6) | (0 << 3) | rm;
                    return {
                        address,
                        opcode: 'ADD',
                        operands: [operands[0].toUpperCase(), operands[1]],
                        machineCode: [0x80, modRM, imm8],
                        length,
                        originalLine: originalLine.trim()
                    };
                    }
            }
            // 处理 ADD r16, imm16 指令
            if (operands[0] === 'ax' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'ADD',
                    operands: ['AX', operands[1]],
                    machineCode: [0x05, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多16位寄存器的立即数ADD指令
            const addRegMap16 = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (addRegMap16.hasOwnProperty(operands[0]) && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(operands[1]);
                // ADD r/m16, imm16 - 操作码81, mod=11, reg=0(ADD), rm=寄存器编码
                const rm = addRegMap16[operands[0]];
                const modRM = (3 << 6) | (0 << 3) | rm;
                return {
                    address,
                    opcode: 'ADD',
                    operands: [operands[0].toUpperCase(), operands[1]],
                    machineCode: [0x81, modRM, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多寄存器到寄存器的ADD指令
            const addRegMap = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (addRegMap.hasOwnProperty(operands[0]) && addRegMap.hasOwnProperty(operands[1])) {
                const dstReg = addRegMap[operands[0]];
                const srcReg = addRegMap[operands[1]];
                // ADD r/m16, r16 - 操作码01, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'ADD',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x01, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持8位寄存器到寄存器的ADD指令
            if (reg8Map.hasOwnProperty(operands[0]) && reg8Map.hasOwnProperty(operands[1])) {
                const dstReg = reg8Map[operands[0]];
                const srcReg = reg8Map[operands[1]];
                // ADD r/m8, r8 - 操作码00, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'ADD',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x00, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'sub':
            if (operands[0] === 'al') {
                const imm8 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['AL', operands[1]],
                    machineCode: [0x2c, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['AX', operands[1]],
                    machineCode: [0x2d, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1] === 'cx') {
                // SUB BX, CX - mod=11, reg=001(CX), rm=011(BX), opcode=29
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['BX', 'CX'],
                    machineCode: [0x29, 0xcb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'cx') {
                // SUB AX, CX - mod=11, reg=001(CX), rm=000(AX), opcode=2b
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['AX', 'CX'],
                    machineCode: [0x2b, 0xc8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'bx') {
                // SUB AX, BX - mod=11, reg=011(BX), rm=000(AX), opcode=2b
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['AX', 'BX'],
                    machineCode: [0x2b, 0xd8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1] === 'ax') {
                // SUB BX, AX - mod=11, reg=000(AX), rm=011(BX), opcode=29
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['BX', 'AX'],
                    machineCode: [0x29, 0xd8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === 'ax') {
                // SUB CX, AX - mod=11, reg=000(AX), rm=001(CX), opcode=29
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['CX', 'AX'],
                    machineCode: [0x29, 0xc8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === 'bx') {
                // SUB CX, BX - mod=11, reg=011(BX), rm=001(CX), opcode=29
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['CX', 'BX'],
                    machineCode: [0x29, 0xd9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && operands[1] === 'ax') {
                // SUB DX, AX - mod=11, reg=000(AX), rm=010(DX), opcode=29
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['DX', 'AX'],
                    machineCode: [0x29, 0xc2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && operands[1] === 'bx') {
                // SUB DX, BX - mod=11, reg=011(BX), rm=010(DX), opcode=29
                return {
                    address,
                    opcode: 'SUB',
                    operands: ['DX', 'BX'],
                    machineCode: [0x29, 0xda],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多寄存器到寄存器的SUB指令
            const subRegMap = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (subRegMap.hasOwnProperty(operands[0]) && subRegMap.hasOwnProperty(operands[1])) {
                const dstReg = subRegMap[operands[0]];
                const srcReg = subRegMap[operands[1]];
                // SUB r/m16, r16 - 操作码29, mod=11, reg=源寄存器, rm=目标寄存器
                // mod=11 (二进制) 表示寄存器寻址模式
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'SUB',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x29, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'and':
            // 处理 AND r8, imm8 指令
            const andReg8Map = {
                'al': 0, 'cl': 1, 'dl': 2, 'bl': 3,
                'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7
            };
            if (andReg8Map.hasOwnProperty(operands[0]) && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(operands[1]);
                if (operands[0] === 'al') {
                    // AND AL, imm8 - 操作码24
                    return {
                        address,
                        opcode: 'AND',
                        operands: ['AL', operands[1]],
                        machineCode: [0x24, imm8],
                        length,
                        originalLine: originalLine.trim()
                    };
                } else {
                    // AND r/m8, imm8 - 操作码80, mod=11, reg=4(AND), rm=寄存器编码
                    const rm = andReg8Map[operands[0]];
                    const modRM = (3 << 6) | (4 << 3) | rm;
                    return {
                        address,
                        opcode: 'AND',
                        operands: [operands[0].toUpperCase(), operands[1]],
                        machineCode: [0x80, modRM, imm8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            // 处理 AND r16, imm16 指令
            if (operands[0] === 'ax' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'AND',
                    operands: ['AX', operands[1]],
                    machineCode: [0x25, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多16位寄存器的立即数AND指令
            const andRegMap16 = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (andRegMap16.hasOwnProperty(operands[0]) && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(operands[1]);
                // AND r/m16, imm16 - 操作码81, mod=11, reg=4(AND), rm=寄存器编码
                const rm = andRegMap16[operands[0]];
                const modRM = (3 << 6) | (4 << 3) | rm;
                return {
                    address,
                    opcode: 'AND',
                    operands: [operands[0].toUpperCase(), operands[1]],
                    machineCode: [0x81, modRM, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多寄存器到寄存器的AND指令
            const andRegMap = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (andRegMap.hasOwnProperty(operands[0]) && andRegMap.hasOwnProperty(operands[1])) {
                const dstReg = andRegMap[operands[0]];
                const srcReg = andRegMap[operands[1]];
                // AND r/m16, r16 - 操作码21, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'AND',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x21, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持8位寄存器到寄存器的AND指令
            if (andReg8Map.hasOwnProperty(operands[0]) && andReg8Map.hasOwnProperty(operands[1])) {
                const dstReg = andReg8Map[operands[0]];
                const srcReg = andReg8Map[operands[1]];
                // AND r/m8, r8 - 操作码20, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'AND',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x20, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'or':
            if (operands[0] === 'al') {
                const imm8 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'OR',
                    operands: ['AL', operands[1]],
                    machineCode: [0x0c, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'OR',
                    operands: ['AX', operands[1]],
                    machineCode: [0x0d, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1].startsWith('0x')) {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'OR',
                    operands: ['BX', operands[1]],
                    machineCode: [0x81, 0xcb, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多寄存器到寄存器的OR指令
            const orRegMap = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (orRegMap.hasOwnProperty(operands[0]) && orRegMap.hasOwnProperty(operands[1])) {
                const dstReg = orRegMap[operands[0]];
                const srcReg = orRegMap[operands[1]];
                // OR r/m16, r16 - 操作码09, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'OR',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x09, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'xor':
            if (operands[0] === 'al') {
                const imm8 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['AL', operands[1]],
                    machineCode: [0x34, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'ax') {
                // XOR AX, AX - 清零寄存器，使用2字节编码
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['AX', 'AX'],
                    machineCode: [0x31, 0xc0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['AX', operands[1]],
                    machineCode: [0x35, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === 'dx') {
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['CX', 'DX'],
                    machineCode: [0x31, 0xd1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === 'cx') {
                // XOR CX, CX - 清零寄存器
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['CX', 'CX'],
                    machineCode: [0x31, 0xc9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && operands[1] === 'dx') {
                // XOR DX, DX - 清零寄存器
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['DX', 'DX'],
                    machineCode: [0x31, 0xd2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1] === 'bx') {
                // XOR BX, BX - 清零寄存器
                return {
                    address,
                    opcode: 'XOR',
                    operands: ['BX', 'BX'],
                    machineCode: [0x31, 0xdb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 通用寄存器-寄存器 XOR (16位) - 使用 0x31 指令
            const reg16MapXor = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
            if (reg16MapXor.hasOwnProperty(operands[0]) && reg16MapXor.hasOwnProperty(operands[1])) {
                const reg1 = reg16MapXor[operands[0]];
                const reg2 = reg16MapXor[operands[1]];
                // 0x31: XOR r/m16, r16
                // ModR/M: mod=11(寄存器), reg=reg1, rm=reg2
                const modRM = (3 << 6) | (reg1 << 3) | reg2;
                return {
                    address,
                    opcode: 'XOR',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x31, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'adc':
            if (operands[0] === 'al') {
                const imm8 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'ADC',
                    operands: ['AL', operands[1]],
                    machineCode: [0x14, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'ADC',
                    operands: ['AX', operands[1]],
                    machineCode: [0x15, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'mov':
            if (operands[0] === 'ax' && operands[1] === 'bx') {
                // MOV AX, BX - mod=11, reg=000(AX), rm=011(BX)
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', 'BX'],
                    machineCode: [0x8b, 0xc3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1] === 'ax') {
                // MOV BX, AX - 操作码89, mod=11, reg=000(AX), rm=011(BX)
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['BX', 'AX'],
                    machineCode: [0x89, 0xc3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多寄存器到寄存器的MOV指令
            const regMap = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (regMap.hasOwnProperty(operands[0]) && regMap.hasOwnProperty(operands[1])) {
                const dstReg = regMap[operands[0]];
                const srcReg = regMap[operands[1]];
                // MOV r/m16, r16 - 操作码89, mod=11, reg=源寄存器, rm=目标寄存器
                // mod=11 (二进制) 表示寄存器寻址模式
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'MOV',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x89, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持8位寄存器到寄存器的MOV指令
            const reg8Map = {
                'al': 0, 'cl': 1, 'dl': 2, 'bl': 3,
                'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7
            };
            if (reg8Map.hasOwnProperty(operands[0]) && reg8Map.hasOwnProperty(operands[1])) {
                const dstReg = reg8Map[operands[0]];
                const srcReg = reg8Map[operands[1]];
                // MOV r/m8, r8 - 操作码88, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'MOV',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x88, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['CX', 'AX'],
                    machineCode: [0x8b, 0xc8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && operands[1] === 'bx') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DX', 'BX'],
                    machineCode: [0x8b, 0xda],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'cx') {
                // MOV AX, CX - mod=11, reg=000(AX), rm=001(CX)
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', 'CX'],
                    machineCode: [0x8b, 0xc1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1] === 'cx') {
                // MOV BX, CX - mod=11, reg=001(CX), rm=011(BX)
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['BX', 'CX'],
                    machineCode: [0x89, 0xcb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === '[bx]') {
                // MOV CX, [BX] - reg=001(CX), r/m=111([BX])
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['CX', '[BX]'],
                    machineCode: [0x8b, 0x0f],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && operands[1] === '[bx]') {
                // MOV DX, [BX] - reg=010(DX), r/m=111([BX])
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DX', '[BX]'],
                    machineCode: [0x8b, 0x17],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl' && operands[1] === '[si]') {
                // MOV DL, [SI] - reg=010(DL), r/m=100([SI])
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DL', '[SI]'],
                    machineCode: [0x8a, 0x14],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'al' && operands[1] === '[si]') {
                // MOV AL, [SI] - reg=000(AL), r/m=100([SI])
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AL', '[SI]'],
                    machineCode: [0x8a, 0x04],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === '[bx]' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['[BX]', 'AX'],
                    machineCode: [0x89, 0x07],
                    length,
                    originalLine: originalLine.trim()
                };
            }

            // 使用parseMemoryOperand处理通用内存寻址模式
            // MOV reg, [mem] - 从内存读取到寄存器
            const memOp0 = this.parseMemoryOperand(operands[0]);
            const memOp1 = this.parseMemoryOperand(operands[1]);

            // 16位寄存器到内存: MOV [mem], reg16
            if (memOp0 && !memOp1) {
                const reg16Map = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
                const reg8Map = { 'al': 0, 'cl': 1, 'dl': 2, 'bl': 3, 'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7 };

                if (reg16Map.hasOwnProperty(operands[1])) {
                    // MOV [mem], r16 - 操作码89
                    const reg = reg16Map[operands[1]];
                    const modRM = (memOp0.mod << 6) | (reg << 3) | memOp0.rm;
                    const machineCode = [0x89, modRM];
                    if (memOp0.dispSize === 1) machineCode.push(memOp0.disp & 0xff);
                    else if (memOp0.dispSize === 2) {
                        machineCode.push(memOp0.disp & 0xff, (memOp0.disp >> 8) & 0xff);
                    }
                    return {
                        address,
                        opcode: 'MOV',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: machineCode.length,
                        originalLine: originalLine.trim()
                    };
                } else if (reg8Map.hasOwnProperty(operands[1])) {
                    // MOV [mem], r8 - 操作码88
                    const reg = reg8Map[operands[1]];
                    const modRM = (memOp0.mod << 6) | (reg << 3) | memOp0.rm;
                    const machineCode = [0x88, modRM];
                    if (memOp0.dispSize === 1) machineCode.push(memOp0.disp & 0xff);
                    else if (memOp0.dispSize === 2) {
                        machineCode.push(memOp0.disp & 0xff, (memOp0.disp >> 8) & 0xff);
                    }
                    return {
                        address,
                        opcode: 'MOV',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: machineCode.length,
                        originalLine: originalLine.trim()
                    };
                }
            }

            // 处理 MOV r8, label 格式，其中 label 是数据段中的变量
            if (reg8Map.hasOwnProperty(operands[0]) && !memOp0 && !memOp1) {
                // 检查第二个操作数是否是数据段中的变量
                const op1Lower = operands[1].toLowerCase();
                let labelDataVar = null;
                for (const dataVar of this.dataVariables) {
                    if (dataVar.toLowerCase() === op1Lower) {
                        labelDataVar = dataVar;
                        break;
                    }
                }
                if (labelDataVar) {
                    // 8位寄存器不能直接加载16位地址，应该使用MOV r16, label格式
                    // 或者使用LEA指令
                    throw new Error(`Invalid instruction: Cannot load 16-bit address into 8-bit register ${operands[0]}. Use MOV ${operands[0].replace(/[lh]$/, 'x')}, ${operands[1]} or LEA ${operands[0].replace(/[lh]$/, 'x')}, ${operands[1]}`);
                }
            }

            // 处理 MOV r16, label 格式，其中 label 是数据段中的变量
            const reg16Map = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
            if (reg16Map.hasOwnProperty(operands[0]) && !memOp0 && !memOp1) {
                // 检查第二个操作数是否是数据段中的变量
                const op1Lower = operands[1].toLowerCase();
                let labelDataVar = null;
                for (const dataVar of this.dataVariables) {
                    if (dataVar.toLowerCase() === op1Lower) {
                        labelDataVar = dataVar;
                        break;
                    }
                }
                if (labelDataVar) {
                    // 查找标签地址
                    let labelOffset = null;
                    for (const key in this.symbols) {
                        if (key.toLowerCase() === op1Lower) {
                            labelOffset = this.symbols[key];
                            break;
                        }
                    }
                    if (labelOffset !== null) {
                        // 正确的处理：MOV r16, imm16 - 将标签地址作为立即数加载到寄存器
                        // 使用 B8 + reg 操作码（例如：MOV AX, imm16 -> B8, MOV DX, imm16 -> BA）
                        const reg = reg16Map[operands[0]];
                        const opcode = 0xb8 + reg; // B8+0=AX, B8+1=CX, B8+2=DX, B8+3=BX, 等等
                        return {
                            address,
                            opcode: 'MOV',
                            operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                            machineCode: [opcode, labelOffset & 0xff, (labelOffset >> 8) & 0xff],
                            length: 3,
                            originalLine: originalLine.trim()
                        };
                    }
                    }
            }

            // 内存到16位寄存器: MOV reg16, [mem]
            if (memOp1 && !memOp0) {

                if (reg16Map.hasOwnProperty(operands[0])) {
                    // MOV r16, [mem] - 操作码8B
                    const reg = reg16Map[operands[0]];
                    const modRM = (memOp1.mod << 6) | (reg << 3) | memOp1.rm;
                    const machineCode = [0x8b, modRM];

                    // 处理标签寻址
                    if (memOp1.hasLabel && memOp1.labelName) {
                        // 查找标签地址
                        let labelOffset = null;
                        for (const key in this.symbols) {
                            if (key.toLowerCase() === memOp1.labelName.toLowerCase()) {
                                labelOffset = this.symbols[key];
                                break;
                            }
                        }
                        if (labelOffset !== null) {
                            const finalOffset = (labelOffset + memOp1.disp) & 0xFFFF;
                            machineCode.push(finalOffset & 0xff, (finalOffset >> 8) & 0xff);
                        } else {
                            // 标签未找到，使用0作为占位符
                            machineCode.push(memOp1.disp & 0xff, (memOp1.disp >> 8) & 0xff);
                        }
                    } else if (memOp1.dispSize === 1) {
                        machineCode.push(memOp1.disp & 0xff);
                    } else if (memOp1.dispSize === 2) {
                        machineCode.push(memOp1.disp & 0xff, (memOp1.disp >> 8) & 0xff);
                    }
                    return {
                        address,
                        opcode: 'MOV',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: machineCode.length,
                        originalLine: originalLine.trim()
                    };
                } else if (reg8Map.hasOwnProperty(operands[0])) {
                    // MOV r8, [mem] - 操作码8A
                    const reg = reg8Map[operands[0]];
                    const modRM = (memOp1.mod << 6) | (reg << 3) | memOp1.rm;
                    const machineCode = [0x8a, modRM];

                    // 处理标签寻址
                    if (memOp1.hasLabel && memOp1.labelName) {
                        // 查找标签地址
                        let labelOffset = null;
                        for (const key in this.symbols) {
                            if (key.toLowerCase() === memOp1.labelName.toLowerCase()) {
                                labelOffset = this.symbols[key];
                                break;
                            }
                        }
                        if (labelOffset !== null) {
                            const finalOffset = (labelOffset + memOp1.disp) & 0xFFFF;
                            machineCode.push(finalOffset & 0xff, (finalOffset >> 8) & 0xff);
                        } else {
                            // 标签未找到，使用0作为占位符
                            machineCode.push(memOp1.disp & 0xff, (memOp1.disp >> 8) & 0xff);
                        }
                    } else if (memOp1.dispSize === 1) {
                        machineCode.push(memOp1.disp & 0xff);
                    } else if (memOp1.dispSize === 2) {
                        machineCode.push(memOp1.disp & 0xff, (memOp1.disp >> 8) & 0xff);
                    }
                    return {
                        address,
                        opcode: 'MOV',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: machineCode.length,
                        originalLine: originalLine.trim()
                    };
                }
            }

            // 处理直接内存寻址：MOV CX, [label] - 从内存读取16位到CX
            if (operands[0] === 'cx' && operands[1].startsWith('[') && operands[1].endsWith(']')) {
                const labelName = operands[1].substring(1, operands[1].length - 1).trim();
                // 检查是否是标签
                let offset = null;
                for (const key in this.symbols) {
                    if (key.toLowerCase() === labelName.toLowerCase()) {
                        offset = this.symbols[key];
                        break;
                    }
                }
                if (offset !== null) {
                    // MOV CX, [disp16] - 8B 0E disp16 (小端序)
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['CX', operands[1].toUpperCase()],
                        machineCode: [0x8b, 0x0e, offset & 0xff, (offset >> 8) & 0xff],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }

            // 处理直接内存寻址：MOV [label], AL - 将AL写入内存
            if (operands[0].startsWith('[') && operands[0].endsWith(']') && operands[1] === 'al') {
                const labelName = operands[0].substring(1, operands[0].length - 1).trim();
                // 检查是否是标签
                let offset = null;
                for (const key in this.symbols) {
                    if (key.toLowerCase() === labelName.toLowerCase()) {
                        offset = this.symbols[key];
                        break;
                    }
                }
                if (offset !== null) {
                    // MOV [disp16], AL - 88 06 disp16 (小端序)
                    return {
                        address,
                        opcode: 'MOV',
                        operands: [operands[0].toUpperCase(), 'AL'],
                        machineCode: [0x88, 0x06, offset & 0xff, (offset >> 8) & 0xff],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }

            // 支持MOV立即数寻址（16位寄存器）
            if (operands[0] === 'ax' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', originalOperands[1]],
                    machineCode: [0xb8, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // MOV段寄存器到通用寄存器
            if (operands[0] === 'ax' && operands[1] === 'cs') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', 'CS'],
                    machineCode: [0x8c, 0xc8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'ds') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', 'DS'],
                    machineCode: [0x8c, 0xd8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'ss') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', 'SS'],
                    machineCode: [0x8c, 0xe0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'es') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AX', 'ES'],
                    machineCode: [0x8c, 0xe8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // MOV通用寄存器到段寄存器
            if (operands[0] === 'ds' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DS', 'AX'],
                    machineCode: [0x8e, 0xd8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'es' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['ES', 'AX'],
                    machineCode: [0x8e, 0xc0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ss' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['SS', 'AX'],
                    machineCode: [0x8e, 0xd0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cs' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['CS', 'AX'],
                    machineCode: [0x8e, 0xc8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持MOV 标签, 寄存器 格式（如 MOV NUM, AX）
            if (originalOperands.length > 0) {
                // 先尝试使用原始操作数（保持大小写）匹配
                let label = originalOperands[0];
                if (this.symbols.hasOwnProperty(label)) {
                    const srcReg = operands[1].toLowerCase();
                    const regMap = {
                        'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                        'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                    };

                    if (regMap.hasOwnProperty(srcReg)) {
                        const offset = this.symbols[label];
                        // MOV m16, r16 - 操作码89, mod=00, reg=源寄存器, r/m=110(直接寻址)
                        const modRM = (regMap[srcReg] << 3) | 0x06; // 0b00rrr110
                        return {
                            address,
                            opcode: 'MOV',
                            operands: [label, operands[1].toUpperCase()],
                            machineCode: [0x89, modRM, offset & 0xff, (offset >> 8) & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                // 如果原始操作数匹配失败，尝试使用小写匹配
                label = operands[0];
                if (this.symbols.hasOwnProperty(label)) {
                    const srcReg = operands[1].toLowerCase();
                    const regMap = {
                        'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                        'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                    };

                    if (regMap.hasOwnProperty(srcReg)) {
                        const offset = this.symbols[label];
                        // MOV m16, r16 - 操作码89, mod=00, reg=源寄存器, r/m=110(直接寻址)
                        const modRM = (regMap[srcReg] << 3) | 0x06; // 0b00rrr110
                        return {
                            address,
                            opcode: 'MOV',
                            operands: [label, operands[1].toUpperCase()],
                            machineCode: [0x89, modRM, offset & 0xff, (offset >> 8) & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }
            }
            if (operands[0] === 'bx' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['BX', originalOperands[1]],
                    machineCode: [0xbb, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['CX', originalOperands[1]],
                    machineCode: [0xb9, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DX', originalOperands[1]],
                    machineCode: [0xba, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'si' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['SI', originalOperands[1]],
                    machineCode: [0xbe, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'di' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DI', originalOperands[1]],
                    machineCode: [0xbf, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bp' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['BP', originalOperands[1]],
                    machineCode: [0xbd, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'sp' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['SP', originalOperands[1]],
                    machineCode: [0xbc, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持MOV立即数寻址（8位寄存器）
            if (operands[0] === 'al' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AL', originalOperands[1]],
                    machineCode: [0xb0, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ah' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['AH', originalOperands[1]],
                    machineCode: [0xb4, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bl' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['BL', originalOperands[1]],
                    machineCode: [0xb3, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bh' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['BH', originalOperands[1]],
                    machineCode: [0xb7, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['CL', originalOperands[1]],
                    machineCode: [0xb1, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ch' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['CH', originalOperands[1]],
                    machineCode: [0xb5, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DL', originalOperands[1]],
                    machineCode: [0xb2, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dh' && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(originalOperands[1]);
                return {
                    address,
                    opcode: 'MOV',
                    operands: ['DH', originalOperands[1]],
                    machineCode: [0xb6, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持 MOV [reg], imm16 和 MOV [label], imm16 格式
            // 检查第一个操作数是否是内存操作数（以[开头）或标签
            const isMemoryOp0 = operands[0].startsWith('[');
            // 对于标签，检查是否在symbols表中（需要处理 arr[si] 这种格式）
            let isLabelOp0 = false;
            if (!isMemoryOp0) {
                // 检查是否是纯标签
                if (this.symbols.hasOwnProperty(originalOperands[0])) {
                    isLabelOp0 = true;
                } else {
                    // 检查是否是 label[reg] 格式
                    const bracketMatch = originalOperands[0].match(/^(.+?)\[(.+?)\]$/);
                    if (bracketMatch) {
                        const labelPart = bracketMatch[1];
                        if (this.symbols.hasOwnProperty(labelPart)) {
                            isLabelOp0 = true;
                        }
                    }
                }
            }

            if (this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(originalOperands[1]);
                // 判断是否是8位立即数
                let is8BitImm = imm16 >= 0 && imm16 <= 255;
                // 如果指定了 word ptr，强制使用 16 位操作
                if (hasWordPtr) {
                    is8BitImm = false;
                } else if (hasBytePtr) {
                    is8BitImm = true;
                }

                // 处理 arr[si], num[si], arr[di] 等格式 - 标签带寄存器间接寻址
                // 注意：必须在直接寻址之前处理，因为 label[reg] 格式不是纯标签
                if (!isMemoryOp0 && operands[0].includes('[')) {
                    const bracketMatch = operands[0].match(/^(.+?)\[(.+?)\]$/);
                    if (bracketMatch) {
                        const labelPart = bracketMatch[1]; // arr 或 num
                        const regPart = bracketMatch[2];  // si

                        // 检查labelPart是否是已知的标签
                        // 使用 labelPart（从小写版本中提取）来查找标签
                        const labelLower = labelPart.toLowerCase();
                        if (this.symbols.hasOwnProperty(labelLower)) {
                            const labelOffset = this.symbols[labelLower];
                            const regLower = regPart.toLowerCase().trim();
                            const regMap = {
                                'bx': 7,
                                'si': 4,
                                'di': 5,
                                'bp': 6
                            };

                            if (regMap.hasOwnProperty(regLower)) {
                                const rm = regMap[regLower];

                                // 判断位移量是8位还是16位
                                const disp8 = labelOffset >= -128 && labelOffset <= 127;

                                if (is8BitImm) {
                                    if (disp8) {
                                        // MOV [reg+disp8], imm8 - C6 modrm disp8 imm8
                                        const modRM = (1 << 6) | (0 << 3) | rm; // mod=01 (8位位移), reg=000, rm=寄存器
                                        return {
                                            address,
                                            opcode: 'MOV',
                                            operands: [originalOperands[0], operands[1]],
                                            machineCode: [0xc6, modRM, labelOffset & 0xff, imm16 & 0xff],
                                            length,
                                            originalLine: originalLine.trim()
                                        };
                                    } else {
                                        // MOV [reg+disp16], imm8 - C6 modrm disp16 imm8
                                        const modRM = (2 << 6) | (0 << 3) | rm; // mod=10 (16位位移), reg=000, rm=寄存器
                                        return {
                                            address,
                                            opcode: 'MOV',
                                            operands: [originalOperands[0], operands[1]],
                                            machineCode: [0xc6, modRM, labelOffset & 0xff, (labelOffset >> 8) & 0xff, imm16 & 0xff],
                                            length,
                                            originalLine: originalLine.trim()
                                        };
                                    }
                                } else {
                                    if (disp8) {
                                        // MOV [reg+disp8], imm16 - C7 modrm disp8 imm16
                                        const modRM = (1 << 6) | (0 << 3) | rm; // mod=01 (8位位移), reg=000, rm=寄存器
                                        return {
                                            address,
                                            opcode: 'MOV',
                                            operands: [originalOperands[0], operands[1]],
                                            machineCode: [0xc7, modRM, labelOffset & 0xff, imm16 & 0xff, (imm16 >> 8) & 0xff],
                                            length,
                                            originalLine: originalLine.trim()
                                        };
                                    } else {
                                        // MOV [reg+disp16], imm16 - C7 modrm disp16 imm16
                                        const modRM = (2 << 6) | (0 << 3) | rm; // mod=10 (16位位移), reg=000, rm=寄存器
                                        return {
                                            address,
                                            opcode: 'MOV',
                                            operands: [originalOperands[0], operands[1]],
                                            machineCode: [0xc7, modRM, labelOffset & 0xff, (labelOffset >> 8) & 0xff, imm16 & 0xff, (imm16 >> 8) & 0xff],
                                            length,
                                            originalLine: originalLine.trim()
                                        };
                                    }
                                }
                            }
                        }
                    }
                }

                // 处理直接内存寻址：mov num, 5678h 或 mov num[si], 5678h
                if (isLabelOp0) {
                    // 判断是否是8位立即数
                    let is8BitImmDirect = imm16 >= 0 && imm16 <= 255;
                    // 如果指定了 word ptr，强制使用 16 位操作
                    if (hasWordPtr) {
                        is8BitImmDirect = false;
                    } else if (hasBytePtr) {
                        is8BitImmDirect = true;
                    }

                    // 提取标签名（处理 label[reg] 格式）
                    let labelName = originalOperands[0];
                    const bracketMatchLabel = originalOperands[0].match(/^(.+?)\[(.+?)\]$/);
                    if (bracketMatchLabel) {
                        labelName = bracketMatchLabel[1];
                    }

                    // MOV label, imm16
                    const offset = this.symbols[labelName];
                    if (is8BitImmDirect) {
                        // MOV [disp16], imm8 - C6 06 disp16 imm8
                        return {
                            address,
                            opcode: 'MOV',
                            operands: [originalOperands[0], operands[1]],
                            machineCode: [0xc6, 0x06, offset & 0xff, (offset >> 8) & 0xff, imm16 & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    } else {
                        // MOV [disp16], imm16 - C7 06 disp16 imm16
                        return {
                            address,
                            opcode: 'MOV',
                            operands: [originalOperands[0], operands[1]],
                            machineCode: [0xc7, 0x06, offset & 0xff, (offset >> 8) & 0xff, imm16 & 0xff, (imm16 >> 8) & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }

                // 处理寄存器间接寻址：[si], [bx], [di] 等
                if (isMemoryOp0) {
                    const memReg = operands[0].substring(1, operands[0].length - 1).toLowerCase().trim();
                    const regMap = {
                        'bx': 7,
                        'si': 4,
                        'di': 5,
                        'bp': 6
                    };

                    if (regMap.hasOwnProperty(memReg)) {
                        const rm = regMap[memReg];
                        // 判断是否是8位立即数
                        let is8BitImmReg = imm16 >= 0 && imm16 <= 255;
                        // 如果指定了 word ptr，强制使用 16 位操作
                        if (hasWordPtr) {
                            is8BitImmReg = false;
                        } else if (hasBytePtr) {
                            is8BitImmReg = true;
                        }

                        if (is8BitImmReg) {
                            // MOV [reg], imm8 - C6 modrm imm8
                            const modRM = (0 << 6) | (0 << 3) | rm; // mod=00, reg=000, rm=寄存器
                            return {
                                address,
                                opcode: 'MOV',
                                operands: [operands[0].toUpperCase(), operands[1]],
                                machineCode: [0xc6, modRM, imm16 & 0xff],
                                length,
                                originalLine: originalLine.trim()
                            };
                        } else {
                            // MOV [reg], imm16 - C7 modrm imm16
                            const modRM = (0 << 6) | (0 << 3) | rm; // mod=00, reg=000, rm=寄存器
                            return {
                                address,
                                opcode: 'MOV',
                                operands: [operands[0].toUpperCase(), operands[1]],
                                machineCode: [0xc7, modRM, imm16 & 0xff, (imm16 >> 8) & 0xff],
                                length,
                                originalLine: originalLine.trim()
                            };
                        }
                    }
                }
            }
            break;
        case 'ret':
            if (operands.length === 0) {
                // RET (近返回) - 1字节
                return {
                    address,
                    opcode: 'RET',
                    operands: [],
                    machineCode: [0xc3],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands.length === 1 && this.isImmediate(operands[0])) {
                // RET imm16 (带弹出值) - 3字节
                const imm16 = this.parseImmediate(operands[0]);
                return {
                    address,
                    opcode: 'RET',
                    operands: [operands[0]],
                    machineCode: [0xc2, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'shl':
            if (operands[1] === '1') {
                // 处理 SHL r/m, 1 指令
                const regMap = {
                    'al': { opcode: 0xd0, modrm: 0xe0 },
                    'ax': { opcode: 0xd1, modrm: 0xe0 },
                    'bl': { opcode: 0xd0, modrm: 0xe3 },
                    'bx': { opcode: 0xd1, modrm: 0xe3 },
                    'cl': { opcode: 0xd0, modrm: 0xe1 },
                    'cx': { opcode: 0xd1, modrm: 0xe1 },
                    'dl': { opcode: 0xd0, modrm: 0xe2 },
                    'dx': { opcode: 0xd1, modrm: 0xe2 },
                    'si': { opcode: 0xd1, modrm: 0xe6 },
                    'di': { opcode: 0xd1, modrm: 0xe7 }
                };

                if (regMap.hasOwnProperty(operands[0])) {
                    const info = regMap[operands[0]];
                    return {
                        address,
                        opcode: 'SHL',
                        operands: [operands[0].toUpperCase(), '1'],
                        machineCode: [info.opcode, info.modrm],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'shr':
            // 处理 SHR r/m, 1 指令
            if (operands[1] === '1') {
                const regMap = {
                    'al': { opcode: 0xd0, modrm: 0xe0 },
                    'ax': { opcode: 0xd1, modrm: 0xe0 },
                    'bl': { opcode: 0xd0, modrm: 0xe3 },
                    'bx': { opcode: 0xd1, modrm: 0xe3 },
                    'cl': { opcode: 0xd0, modrm: 0xe1 },
                    'cx': { opcode: 0xd1, modrm: 0xe1 },
                    'dl': { opcode: 0xd0, modrm: 0xe2 },
                    'dx': { opcode: 0xd1, modrm: 0xe2 },
                    'si': { opcode: 0xd1, modrm: 0xe6 },
                    'di': { opcode: 0xd1, modrm: 0xe7 }
                };

                if (regMap.hasOwnProperty(operands[0])) {
                    const info = regMap[operands[0]];
                    return {
                        address,
                        opcode: 'SHR',
                        operands: [operands[0].toUpperCase(), '1'],
                        machineCode: [info.opcode, info.modrm],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            // 处理 SHR r/m, CL 指令
            if (operands[1] === 'cl') {
                const reg8Map = {
                    'al': 0, 'cl': 1, 'dl': 2, 'bl': 3,
                    'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7
                };
                const reg16Map = {
                    'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                    'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                };

                if (reg8Map.hasOwnProperty(operands[0])) {
                    // SHR r/m8, CL - 操作码 D2, mod=11, reg=5 (SHR), rm=寄存器编码
                    const rm = reg8Map[operands[0]];
                    const modRM = (3 << 6) | (5 << 3) | rm;
                    return {
                        address,
                        opcode: 'SHR',
                        operands: [operands[0].toUpperCase(), 'CL'],
                        machineCode: [0xd2, modRM],
                        length,
                        originalLine: originalLine.trim()
                    };
                } else if (reg16Map.hasOwnProperty(operands[0])) {
                    // SHR r/m16, CL - 操作码 D3, mod=11, reg=5 (SHR), rm=寄存器编码
                    const rm = reg16Map[operands[0]];
                    const modRM = (3 << 6) | (5 << 3) | rm;
                    return {
                        address,
                        opcode: 'SHR',
                        operands: [operands[0].toUpperCase(), 'CL'],
                        machineCode: [0xd3, modRM],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'push':
            if (operands[0] === 'ax') {
                return {
                    address,
                    opcode: 'PUSH',
                    operands: ['AX'],
                    machineCode: [0x50],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'PUSH',
                    operands: ['BX'],
                    machineCode: [0x53],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'PUSH',
                    operands: ['CX'],
                    machineCode: [0x51],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'PUSH',
                    operands: ['DX'],
                    machineCode: [0x52],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'si') {
                return {
                    address,
                    opcode: 'PUSH',
                    operands: ['SI'],
                    machineCode: [0x56],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'di') {
                return {
                    address,
                    opcode: 'PUSH',
                    operands: ['DI'],
                    machineCode: [0x57],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'pop':
            if (operands[0] === 'ax') {
                return {
                    address,
                    opcode: 'POP',
                    operands: ['AX'],
                    machineCode: [0x58],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'POP',
                    operands: ['BX'],
                    machineCode: [0x5b],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'POP',
                    operands: ['CX'],
                    machineCode: [0x59],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'POP',
                    operands: ['DX'],
                    machineCode: [0x5a],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'si') {
                return {
                    address,
                    opcode: 'POP',
                    operands: ['SI'],
                    machineCode: [0x5e],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands[0] === 'di') {
                return {
                    address,
                    opcode: 'POP',
                    operands: ['DI'],
                    machineCode: [0x5f],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'cmp':
            // 处理 CMP r8, imm8 指令
            const cmpReg8Map = {
                'al': 0, 'cl': 1, 'dl': 2, 'bl': 3,
                'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7
            };
            if (cmpReg8Map.hasOwnProperty(operands[0]) && this.isImmediate(operands[1])) {
                const imm8 = this.parseImmediate(operands[1]);
                if (operands[0] === 'al') {
                    // CMP AL, imm8 - 操作码3c
                    return {
                        address,
                        opcode: 'CMP',
                        operands: ['AL', operands[1]],
                        machineCode: [0x3c, imm8],
                        length,
                        originalLine: originalLine.trim()
                    };
                } else {
                    // CMP r/m8, imm8 - 操作码80, mod=11, reg=7(CMP), rm=寄存器编码
                    const rm = cmpReg8Map[operands[0]];
                    const modRM = (3 << 6) | (7 << 3) | rm;
                    return {
                        address,
                        opcode: 'CMP',
                        operands: [operands[0].toUpperCase(), operands[1]],
                        machineCode: [0x80, modRM, imm8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            // 处理 CMP r16, imm16 指令
            if (operands[0] === 'ax' && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'CMP',
                    operands: ['AX', operands[1]],
                    machineCode: [0x3d, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持更多16位寄存器的立即数CMP指令
            const cmpRegMap = {
                'ax': 0xf8, 'cx': 0xf9, 'dx': 0xfa, 'bx': 0xfb,
                'sp': 0xfc, 'bp': 0xfd, 'si': 0xfe, 'di': 0xff
            };
            if (cmpRegMap.hasOwnProperty(operands[0]) && this.isImmediate(operands[1])) {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'CMP',
                    operands: [operands[0].toUpperCase(), operands[1]],
                    machineCode: [0x81, cmpRegMap[operands[0]], imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'bx') {
                // CMP AX, BX - mod=11, reg=000(AX), rm=011(BX), opcode=39
                return {
                    address,
                    opcode: 'CMP',
                    operands: ['AX', 'BX'],
                    machineCode: [0x39, 0xc3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 通用寄存器-寄存器 CMP (16位) - 使用 0x39 指令
            const reg16MapCmp = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
            if (reg16MapCmp.hasOwnProperty(operands[0]) && reg16MapCmp.hasOwnProperty(operands[1])) {
                const reg1 = reg16MapCmp[operands[0]];
                const reg2 = reg16MapCmp[operands[1]];
                // 0x39: CMP r/m16, r16
                // ModR/M: mod=11(寄存器), reg=reg1, rm=reg2
                const modRM = (3 << 6) | (reg1 << 3) | reg2;
                return {
                    address,
                    opcode: 'CMP',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x39, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 通用寄存器-寄存器 CMP (8位) - 使用 0x3a 指令
            const reg8MapCmp = { 'al': 0, 'cl': 1, 'dl': 2, 'bl': 3, 'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7 };
            if (reg8MapCmp.hasOwnProperty(operands[0]) && reg8MapCmp.hasOwnProperty(operands[1])) {
                const reg1 = reg8MapCmp[operands[0]];
                const reg2 = reg8MapCmp[operands[1]];
                // 0x3a: CMP r8, r/m8
                // ModR/M: mod=11(寄存器), reg=reg1, rm=reg2
                const modRM = (3 << 6) | (reg1 << 3) | reg2;
                return {
                    address,
                    opcode: 'CMP',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x3a, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'call':
            if (operands.length === 1) {
                // CALL NEAR 或 默认 - 3字节
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 3);
                const offset16 = offset & 0xffff;
                return {
                    address,
                    opcode: 'CALL',
                    operands: [operands[0]],
                    machineCode: [0xe8, offset16 & 0xff, (offset16 >> 8) & 0xff],
                    length,
                    originalLine: 'CALL'
                };
            }
            // 处理 CALL FAR label 格式
            if (operands.length === 2 && operands[0] === 'far') {
                const targetAddress = this.parseImmediate(operands[1]);
                // CALL far (9A) - 段地址:偏移地址
                return {
                    address,
                    opcode: 'CALL',
                    operands: ['FAR', operands[1]],
                    machineCode: [0x9a, targetAddress & 0xff, (targetAddress >> 8) & 0xff, 0x00, 0x00], // 简化处理，段地址设为0
                    length,
                    originalLine: 'CALL FAR'
                };
            }
            break;
        case 'jmp':
            if (operands.length === 1) {
                // JMP NEAR 或 默认 - 3字节
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 3);
                const offset16 = offset & 0xffff;
                return {
                    address,
                    opcode: 'JMP',
                    operands: [operands[0]],
                    machineCode: [0xe9, offset16 & 0xff, (offset16 >> 8) & 0xff],
                    length,
                    originalLine: 'JMP'
                };
            }
            // 处理 JMP SHORT label 格式
            if (operands.length === 2 && operands[0] === 'short') {
                const targetAddress = this.parseImmediate(operands[1]);
                const offset = targetAddress - (address + 2);
                // JMP short (EB)
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'JMP',
                    operands: ['SHORT', operands[1]],
                    machineCode: [0xeb, offset8],
                    length,
                    originalLine: 'JMP SHORT'
                };
            }
            // 处理 JMP FAR label 格式
            if (operands.length === 2 && operands[0] === 'far') {
                const targetAddress = this.parseImmediate(operands[1]);
                // JMP far (EA) - 段地址:偏移地址
                return {
                    address,
                    opcode: 'JMP',
                    operands: ['FAR', operands[1]],
                    machineCode: [0xea, targetAddress & 0xff, (targetAddress >> 8) & 0xff, 0x00, 0x00], // 简化处理，段地址设为0
                    length,
                    originalLine: 'JMP FAR'
                };
            }
            break;
        case 'jz':
        case 'je':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                // JZ/JE short 的偏移量 = 目标地址 - (当前地址 + 指令长度)
                const offset = targetAddress - (address + 2);
                // 将偏移量转换为有符号的8位整数
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jz' ? 'JZ' : 'JE',
                    operands: [operands[0]],
                    machineCode: [0x74, offset8],
                    length,
                    originalLine: opcode === 'jz' ? 'JZ' : 'JE'
                };
            }
            break;
        case 'jnz':
        case 'jne':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                // JNZ/JNE short 的偏移量 = 目标地址 - (当前地址 + 指令长度)
                const offset = targetAddress - (address + 2);
                // 将偏移量转换为有符号的8位整数
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jnz' ? 'JNZ' : 'JNE',
                    operands: [operands[0]],
                    machineCode: [0x75, offset8],
                    length,
                    originalLine: opcode === 'jnz' ? 'JNZ' : 'JNE'
                };
            }
            break;
        case 'sbb':
            // 支持更多寄存器到寄存器的SBB指令
            const sbbRegMap = {
                'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                'sp': 4, 'bp': 5, 'si': 6, 'di': 7
            };
            if (sbbRegMap.hasOwnProperty(operands[0]) && sbbRegMap.hasOwnProperty(operands[1])) {
                const dstReg = sbbRegMap[operands[0]];
                const srcReg = sbbRegMap[operands[1]];
                // SBB r/m16, r16 - 操作码19, mod=11, reg=源寄存器, rm=目标寄存器
                const modRM = (3 << 6) | (srcReg << 3) | dstReg;
                return {
                    address,
                    opcode: 'SBB',
                    operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                    machineCode: [0x19, modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'al') {
                const imm8 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'SBB',
                    operands: ['AL', operands[1]],
                    machineCode: [0x1c, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'SBB',
                    operands: ['AX', operands[1]],
                    machineCode: [0x1d, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'neg':
            if (operands[0] === 'al') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['AL'],
                    machineCode: [0xf6, 0xd8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['AX'],
                    machineCode: [0xf7, 0xd8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['BL'],
                    machineCode: [0xf6, 0xdb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['BX'],
                    machineCode: [0xf7, 0xdb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['CL'],
                    machineCode: [0xf6, 0xd9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['CX'],
                    machineCode: [0xf7, 0xd9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['DL'],
                    machineCode: [0xf6, 0xda],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'NEG',
                    operands: ['DX'],
                    machineCode: [0xf7, 0xda],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'not':
            if (operands[0] === 'al') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['AL'],
                    machineCode: [0xf6, 0xd0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['AX'],
                    machineCode: [0xf7, 0xd0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['BL'],
                    machineCode: [0xf6, 0xd3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['BX'],
                    machineCode: [0xf7, 0xd3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['CL'],
                    machineCode: [0xf6, 0xd1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['CX'],
                    machineCode: [0xf7, 0xd1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['DL'],
                    machineCode: [0xf6, 0xd2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'NOT',
                    operands: ['DX'],
                    machineCode: [0xf7, 0xd2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'inc':
            if (operands[0] === 'al') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['AL'],
                    machineCode: [0xfe, 0xc0],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['AX'],
                    machineCode: [0x40],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['BL'],
                    machineCode: [0xfe, 0xc3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['BX'],
                    machineCode: [0x43],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['CL'],
                    machineCode: [0xfe, 0xc1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['CX'],
                    machineCode: [0x41],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['DL'],
                    machineCode: [0xfe, 0xc2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['DX'],
                    machineCode: [0x42],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持 SI, DI, BP, SP 等寄存器的 INC 指令
            if (operands[0] === 'si') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['SI'],
                    machineCode: [0x46],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'di') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['DI'],
                    machineCode: [0x47],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bp') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['BP'],
                    machineCode: [0x45],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'sp') {
                return {
                    address,
                    opcode: 'INC',
                    operands: ['SP'],
                    machineCode: [0x44],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'dec':
            if (operands[0] === 'al') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['AL'],
                    machineCode: [0xfe, 0xc8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['AX'],
                    machineCode: [0x48],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['BL'],
                    machineCode: [0xfe, 0xcb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['BX'],
                    machineCode: [0x4b],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['CL'],
                    machineCode: [0xfe, 0xc9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['CX'],
                    machineCode: [0x49],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['DL'],
                    machineCode: [0xfe, 0xca],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['DX'],
                    machineCode: [0x4a],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            // 支持 SI, DI, BP, SP 等寄存器的 DEC 指令
            if (operands[0] === 'si') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['SI'],
                    machineCode: [0x4e],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'di') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['DI'],
                    machineCode: [0x4f],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bp') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['BP'],
                    machineCode: [0x4d],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'sp') {
                return {
                    address,
                    opcode: 'DEC',
                    operands: ['SP'],
                    machineCode: [0x4c],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'test':
            if (operands[0] === 'al') {
                const imm8 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'TEST',
                    operands: ['AL', operands[1]],
                    machineCode: [0xa8, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax') {
                const imm16 = this.parseImmediate(operands[1]);
                return {
                    address,
                    opcode: 'TEST',
                    operands: ['AX', operands[1]],
                    machineCode: [0xa9, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'mul':
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['BL'],
                    machineCode: [0xf6, 0xe3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['BX'],
                    machineCode: [0xf7, 0xe3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['CL'],
                    machineCode: [0xf6, 0xe1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['CX'],
                    machineCode: [0xf7, 0xe1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['DL'],
                    machineCode: [0xf6, 0xe2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['DX'],
                    machineCode: [0xf7, 0xe2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ah') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['AH'],
                    machineCode: [0xf6, 0xe4],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ch') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['CH'],
                    machineCode: [0xf6, 0xe5],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dh') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['DH'],
                    machineCode: [0xf6, 0xe6],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bh') {
                return {
                    address,
                    opcode: 'MUL',
                    operands: ['BH'],
                    machineCode: [0xf6, 0xe7],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'imul':
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'IMUL',
                    operands: ['BL'],
                    machineCode: [0xf6, 0xeb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'IMUL',
                    operands: ['BX'],
                    machineCode: [0xf7, 0xeb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'IMUL',
                    operands: ['CL'],
                    machineCode: [0xf6, 0xe9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'IMUL',
                    operands: ['CX'],
                    machineCode: [0xf7, 0xe9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'IMUL',
                    operands: ['DL'],
                    machineCode: [0xf6, 0xea],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'IMUL',
                    operands: ['DX'],
                    machineCode: [0xf7, 0xea],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'div':
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'DIV',
                    operands: ['BL'],
                    machineCode: [0xf6, 0xf3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'DIV',
                    operands: ['BX'],
                    machineCode: [0xf7, 0xf3],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'DIV',
                    operands: ['CL'],
                    machineCode: [0xf6, 0xf1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'DIV',
                    operands: ['CX'],
                    machineCode: [0xf7, 0xf1],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'DIV',
                    operands: ['DL'],
                    machineCode: [0xf6, 0xf2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'DIV',
                    operands: ['DX'],
                    machineCode: [0xf7, 0xf2],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'idiv':
            if (operands[0] === 'bl') {
                return {
                    address,
                    opcode: 'IDIV',
                    operands: ['BL'],
                    machineCode: [0xf6, 0xfb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx') {
                return {
                    address,
                    opcode: 'IDIV',
                    operands: ['BX'],
                    machineCode: [0xf7, 0xfb],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cl') {
                return {
                    address,
                    opcode: 'IDIV',
                    operands: ['CL'],
                    machineCode: [0xf6, 0xf9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx') {
                return {
                    address,
                    opcode: 'IDIV',
                    operands: ['CX'],
                    machineCode: [0xf7, 0xf9],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dl') {
                return {
                    address,
                    opcode: 'IDIV',
                    operands: ['DL'],
                    machineCode: [0xf6, 0xfa],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx') {
                return {
                    address,
                    opcode: 'IDIV',
                    operands: ['DX'],
                    machineCode: [0xf7, 0xfa],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'aaa':
            return {
                address,
                opcode: 'AAA',
                operands: [],
                machineCode: [0x37],
                length,
                originalLine: originalLine.trim()
            };
        case 'aas':
            return {
                address,
                opcode: 'AAS',
                operands: [],
                machineCode: [0x3f],
                length,
                originalLine: originalLine.trim()
            };
        case 'daa':
            return {
                address,
                opcode: 'DAA',
                operands: [],
                machineCode: [0x27],
                length,
                originalLine: originalLine.trim()
            };
        case 'das':
            return {
                address,
                opcode: 'DAS',
                operands: [],
                machineCode: [0x2f],
                length,
                originalLine: originalLine.trim()
            };
        case 'aam':
            return {
                address,
                opcode: 'AAM',
                operands: [],
                machineCode: [0xd4, 0x0a],
                length,
                originalLine: originalLine.trim()
            };
        case 'aad':
            return {
                address,
                opcode: 'AAD',
                operands: [],
                machineCode: [0xd5, 0x0a],
                length,
                originalLine: originalLine.trim()
            };
        case 'rol':
            if (operands[1] === '1') {
                if (operands[0] === 'al') {
                    return {
                        address,
                        opcode: 'ROL',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xc0],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'ROL',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xc0],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl') {
                    return {
                        address,
                        opcode: 'ROL',
                        operands: ['BL', '1'],
                        machineCode: [0xd0, 0xc3],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'ROL',
                        operands: ['BX', '1'],
                        machineCode: [0xd1, 0xc3],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'ror':
            if (operands[1] === '1') {
                if (operands[0] === 'al') {
                    return {
                        address,
                        opcode: 'ROR',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xc8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'ROR',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xc8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl') {
                    return {
                        address,
                        opcode: 'ROR',
                        operands: ['BL', '1'],
                        machineCode: [0xd0, 0xcb],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'ROR',
                        operands: ['BX', '1'],
                        machineCode: [0xd1, 0xcb],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'rcl':
            if (operands[1] === '1') {
                if (operands[0] === 'al') {
                    return {
                        address,
                        opcode: 'RCL',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xd0],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'RCL',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xd0],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'rcr':
            if (operands[1] === '1') {
                if (operands[0] === 'al') {
                    return {
                        address,
                        opcode: 'RCR',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xd8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'RCR',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xd8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'sar':
            if (operands[1] === '1') {
                if (operands[0] === 'al') {
                    return {
                        address,
                        opcode: 'SAR',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xf8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'SAR',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xf8],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'SAR',
                        operands: ['BX', '1'],
                        machineCode: [0xd1, 0xfb],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'xchg':
            if (operands[0] === 'ax' && operands[1] === 'bx') {
                return {
                    address,
                    opcode: 'XCHG',
                    operands: ['AX', 'BX'],
                    machineCode: [0x93],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'bx' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'XCHG',
                    operands: ['BX', 'AX'],
                    machineCode: [0x93],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'cx') {
                return {
                    address,
                    opcode: 'XCHG',
                    operands: ['AX', 'CX'],
                    machineCode: [0x91],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'cx' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'XCHG',
                    operands: ['CX', 'AX'],
                    machineCode: [0x91],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'ax' && operands[1] === 'dx') {
                return {
                    address,
                    opcode: 'XCHG',
                    operands: ['AX', 'DX'],
                    machineCode: [0x92],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            if (operands[0] === 'dx' && operands[1] === 'ax') {
                return {
                    address,
                    opcode: 'XCHG',
                    operands: ['DX', 'AX'],
                    machineCode: [0x92],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            {
                const reg16MapXchg = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
                const reg8MapXchg = { 'al': 0, 'cl': 1, 'dl': 2, 'bl': 3, 'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7 };
                
                const memOp0 = this.parseMemoryOperand(operands[0]);
                const memOp1 = this.parseMemoryOperand(operands[1]);
                
                if (reg16MapXchg.hasOwnProperty(operands[0]) && memOp1 && !memOp1.isDirect) {
                    const reg = reg16MapXchg[operands[0]];
                    const modRM = (memOp1.mod << 6) | (reg << 3) | memOp1.rm;
                    const machineCode = [0x87, modRM];
                    if (memOp1.dispSize === 1) {
                        machineCode.push(memOp1.disp & 0xFF);
                    }
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: machineCode.length,
                        originalLine: originalLine.trim()
                    };
                }
                
                if (memOp0 && !memOp0.isDirect && reg16MapXchg.hasOwnProperty(operands[1])) {
                    const reg = reg16MapXchg[operands[1]];
                    const modRM = (memOp0.mod << 6) | (reg << 3) | memOp0.rm;
                    const machineCode = [0x87, modRM];
                    if (memOp0.dispSize === 1) {
                        machineCode.push(memOp0.disp & 0xFF);
                    }
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: machineCode.length,
                        originalLine: originalLine.trim()
                    };
                }
                
                if (reg16MapXchg.hasOwnProperty(operands[0]) && memOp1 && memOp1.isDirect) {
                    const reg = reg16MapXchg[operands[0]];
                    const modRM = (0 << 6) | (reg << 3) | 6;
                    const machineCode = [0x87, modRM];
                    if (memOp1.hasLabel) {
                        const labelAddr = this.labels[memOp1.labelName] !== undefined ? this.labels[memOp1.labelName] : 0;
                        machineCode.push((labelAddr + memOp1.disp) & 0xFF);
                        machineCode.push(((labelAddr + memOp1.disp) >> 8) & 0xFF);
                    } else {
                        machineCode.push(memOp1.disp & 0xFF);
                        machineCode.push((memOp1.disp >> 8) & 0xFF);
                    }
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: 4,
                        originalLine: originalLine.trim()
                    };
                }
                
                if (memOp0 && memOp0.isDirect && reg16MapXchg.hasOwnProperty(operands[1])) {
                    const reg = reg16MapXchg[operands[1]];
                    const modRM = (0 << 6) | (reg << 3) | 6;
                    const machineCode = [0x87, modRM];
                    if (memOp0.hasLabel) {
                        const labelAddr = this.labels[memOp0.labelName] !== undefined ? this.labels[memOp0.labelName] : 0;
                        machineCode.push((labelAddr + memOp0.disp) & 0xFF);
                        machineCode.push(((labelAddr + memOp0.disp) >> 8) & 0xFF);
                    } else {
                        machineCode.push(memOp0.disp & 0xFF);
                        machineCode.push((memOp0.disp >> 8) & 0xFF);
                    }
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode,
                        length: 4,
                        originalLine: originalLine.trim()
                    };
                }
                
                if (reg16MapXchg.hasOwnProperty(operands[0]) && reg16MapXchg.hasOwnProperty(operands[1])) {
                    const reg1 = reg16MapXchg[operands[0]];
                    const reg2 = reg16MapXchg[operands[1]];
                    const modRM = (3 << 6) | (reg1 << 3) | reg2;
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode: [0x87, modRM],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                
                if (reg8MapXchg.hasOwnProperty(operands[0]) && reg8MapXchg.hasOwnProperty(operands[1])) {
                    const reg1 = reg8MapXchg[operands[0]];
                    const reg2 = reg8MapXchg[operands[1]];
                    const modRM = (3 << 6) | (reg1 << 3) | reg2;
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode: [0x86, modRM],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'stc':
            return {
                address,
                opcode: 'STC',
                operands: [],
                machineCode: [0xf9],
                length,
                originalLine: originalLine.trim()
            };
        case 'clc':
            return {
                address,
                opcode: 'CLC',
                operands: [],
                machineCode: [0xf8],
                length,
                originalLine: originalLine.trim()
            };
        case 'cmc':
            return {
                address,
                opcode: 'CMC',
                operands: [],
                machineCode: [0xf5],
                length,
                originalLine: originalLine.trim()
            };
        case 'std':
            return {
                address,
                opcode: 'STD',
                operands: [],
                machineCode: [0xfd],
                length,
                originalLine: originalLine.trim()
            };
        case 'cld':
            return {
                address,
                opcode: 'CLD',
                operands: [],
                machineCode: [0xfc],
                length,
                originalLine: originalLine.trim()
            };
        case 'sti':
            return {
                address,
                opcode: 'STI',
                operands: [],
                machineCode: [0xfb],
                length,
                originalLine: originalLine.trim()
            };
        case 'cli':
            return {
                address,
                opcode: 'CLI',
                operands: [],
                machineCode: [0xfa],
                length,
                originalLine: originalLine.trim()
            };
        case 'hlt':
            return {
                address,
                opcode: 'HLT',
                operands: [],
                machineCode: [0xf4],
                length,
                originalLine: originalLine.trim()
            };
        case 'nop':
            return {
                address,
                opcode: 'NOP',
                operands: [],
                machineCode: [0x90],
                length,
                originalLine: originalLine.trim()
            };
        case 'jnc':
        case 'jnb':
        case 'jae':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jnc' ? 'JNC' : (opcode === 'jnb' ? 'JNB' : 'JAE'),
                    operands: [operands[0]],
                    machineCode: [0x73, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'js':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'JS',
                    operands: [operands[0]],
                    machineCode: [0x78, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jns':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'JNS',
                    operands: [operands[0]],
                    machineCode: [0x79, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jo':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'JO',
                    operands: [operands[0]],
                    machineCode: [0x70, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jno':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'JNO',
                    operands: [operands[0]],
                    machineCode: [0x71, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jp':
        case 'jpe':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jp' ? 'JP' : 'JPE',
                    operands: [operands[0]],
                    machineCode: [0x7a, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jnp':
        case 'jpo':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jnp' ? 'JNP' : 'JPO',
                    operands: [operands[0]],
                    machineCode: [0x7b, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jl':
        case 'jnge':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jl' ? 'JL' : 'JNGE',
                    operands: [operands[0]],
                    machineCode: [0x7c, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jnl':
        case 'jge':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jnl' ? 'JNL' : 'JGE',
                    operands: [operands[0]],
                    machineCode: [0x7d, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'ja':
        case 'jnbe':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'ja' ? 'JA' : 'JNBE',
                    operands: [operands[0]],
                    machineCode: [0x77, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jna':
        case 'jbe':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jna' ? 'JNA' : 'JBE',
                    operands: [operands[0]],
                    machineCode: [0x76, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'loop':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'LOOP',
                    operands: [operands[0]],
                    machineCode: [0xe2, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'loopz':
        case 'loope':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'loopz' ? 'LOOPZ' : 'LOOPE',
                    operands: [operands[0]],
                    machineCode: [0xe1, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'loopnz':
        case 'loopne':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'loopnz' ? 'LOOPNZ' : 'LOOPNE',
                    operands: [operands[0]],
                    machineCode: [0xe0, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jcxz':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: 'JCXZ',
                    operands: [operands[0]],
                    machineCode: [0xe3, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'into':
            return {
                address,
                opcode: 'INTO',
                operands: [],
                machineCode: [0xce],
                length,
                originalLine: originalLine.trim()
            };
        case 'iret':
            return {
                address,
                opcode: 'IRET',
                operands: [],
                machineCode: [0xcf],
                length,
                originalLine: originalLine.trim()
            };
        case 'retf':
            if (operands.length === 0) {
                // RETF (远返回) - 1字节
                return {
                    address,
                    opcode: 'RETF',
                    operands: [],
                    machineCode: [0xcb],
                    length,
                    originalLine: originalLine.trim()
                };
            } else if (operands.length === 1 && this.isImmediate(operands[0])) {
                // RETF imm16 (带弹出值) - 3字节
                const imm16 = this.parseImmediate(operands[0]);
                return {
                    address,
                    opcode: 'RETF',
                    operands: [operands[0]],
                    machineCode: [0xca, imm16 & 0xff, (imm16 >> 8) & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'pushf':
            return {
                address,
                opcode: 'PUSHF',
                operands: [],
                machineCode: [0x9c],
                length,
                originalLine: originalLine.trim()
            };
        case 'popf':
            return {
                address,
                opcode: 'POPF',
                operands: [],
                machineCode: [0x9d],
                length,
                originalLine: originalLine.trim()
            };
        case 'lds':
            if (operands.length === 2) {
                const destReg = operands[0].toLowerCase();
                const regMap = {
                    'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                    'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                };
                if (regMap.hasOwnProperty(destReg)) {
                    const modRM = (regMap[destReg] << 3) | 0x06; // 直接寻址
                    // 对于标签，需要获取其地址
                    let offset = 0;
                    if (this.symbols.hasOwnProperty(operands[1])) {
                        offset = this.symbols[operands[1]];
                    }
                    return {
                        address,
                        opcode: 'LDS',
                        operands: [destReg.toUpperCase(), operands[1]],
                        machineCode: [0xc5, modRM, offset & 0xff, (offset >> 8) & 0xff],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'les':
            if (operands.length === 2) {
                const destReg = operands[0].toLowerCase();
                const regMap = {
                    'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                    'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                };
                if (regMap.hasOwnProperty(destReg)) {
                    const modRM = (regMap[destReg] << 3) | 0x06; // 直接寻址
                    let offset = 0;
                    if (this.symbols.hasOwnProperty(operands[1])) {
                        offset = this.symbols[operands[1]];
                    }
                    return {
                        address,
                        opcode: 'LES',
                        operands: [destReg.toUpperCase(), operands[1]],
                        machineCode: [0xc4, modRM, offset & 0xff, (offset >> 8) & 0xff],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'in':
            if (operands.length === 2) {
                const dest = operands[0].toLowerCase();
                const port = operands[1].toLowerCase();
                if (dest === 'al' && this.isImmediate(port)) {
                    const portNum = this.parseImmediate(port);
                    if (portNum <= 255) {
                        return {
                            address,
                            opcode: 'IN',
                            operands: ['AL', port],
                            machineCode: [0xe4, portNum & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                if (dest === 'ax' && this.isImmediate(port)) {
                    const portNum = this.parseImmediate(port);
                    if (portNum <= 255) {
                        return {
                            address,
                            opcode: 'IN',
                            operands: ['AX', port],
                            machineCode: [0xe5, portNum & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                if (dest === 'al' && port === 'dx') {
                    return {
                        address,
                        opcode: 'IN',
                        operands: ['AL', 'DX'],
                        machineCode: [0xec],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (dest === 'ax' && port === 'dx') {
                    return {
                        address,
                        opcode: 'IN',
                        operands: ['AX', 'DX'],
                        machineCode: [0xed],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'out':
            if (operands.length === 2) {
                const port = operands[0].toLowerCase();
                const src = operands[1].toLowerCase();
                if (this.isImmediate(port) && src === 'al') {
                    const portNum = this.parseImmediate(port);
                    if (portNum <= 255) {
                        return {
                            address,
                            opcode: 'OUT',
                            operands: [port, 'AL'],
                            machineCode: [0xe6, portNum & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                if (this.isImmediate(port) && src === 'ax') {
                    const portNum = this.parseImmediate(port);
                    if (portNum <= 255) {
                        return {
                            address,
                            opcode: 'OUT',
                            operands: [port, 'AX'],
                            machineCode: [0xe7, portNum & 0xff],
                            length,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                if (port === 'dx' && src === 'al') {
                    return {
                        address,
                        opcode: 'OUT',
                        operands: ['DX', 'AL'],
                        machineCode: [0xee],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
                if (port === 'dx' && src === 'ax') {
                    return {
                        address,
                        opcode: 'OUT',
                        operands: ['DX', 'AX'],
                        machineCode: [0xef],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'movsb':
            return {
                address,
                opcode: 'MOVSB',
                operands: [],
                machineCode: [0xa4],
                length,
                originalLine: originalLine.trim()
            };
        case 'movsw':
            return {
                address,
                opcode: 'MOVSW',
                operands: [],
                machineCode: [0xa5],
                length,
                originalLine: originalLine.trim()
            };
        case 'cmpsb':
            return {
                address,
                opcode: 'CMPSB',
                operands: [],
                machineCode: [0xa6],
                length,
                originalLine: originalLine.trim()
            };
        case 'cmpsw':
            return {
                address,
                opcode: 'CMPSW',
                operands: [],
                machineCode: [0xa7],
                length,
                originalLine: originalLine.trim()
            };
        case 'scasb':
            return {
                address,
                opcode: 'SCASB',
                operands: [],
                machineCode: [0xae],
                length,
                originalLine: originalLine.trim()
            };
        case 'scasw':
            return {
                address,
                opcode: 'SCASW',
                operands: [],
                machineCode: [0xaf],
                length,
                originalLine: originalLine.trim()
            };
        case 'lodsb':
            return {
                address,
                opcode: 'LODSB',
                operands: [],
                machineCode: [0xac],
                length,
                originalLine: originalLine.trim()
            };
        case 'lodsw':
            return {
                address,
                opcode: 'LODSW',
                operands: [],
                machineCode: [0xad],
                length,
                originalLine: originalLine.trim()
            };
        case 'stosb':
            return {
                address,
                opcode: 'STOSB',
                operands: [],
                machineCode: [0xaa],
                length,
                originalLine: originalLine.trim()
            };
        case 'stosw':
            return {
                address,
                opcode: 'STOSW',
                operands: [],
                machineCode: [0xab],
                length,
                originalLine: originalLine.trim()
            };
        case 'rep':
            // REP前缀后面跟着串操作指令
            if (operands.length > 0) {
                const stringOp = operands[0];
                let stringOpCode;
                switch (stringOp) {
                    case 'movsb': stringOpCode = 0xa4; break;
                    case 'movsw': stringOpCode = 0xa5; break;
                    case 'stosb': stringOpCode = 0xaa; break;
                    case 'stosw': stringOpCode = 0xab; break;
                    case 'lodsb': stringOpCode = 0xac; break;
                    case 'lodsw': stringOpCode = 0xad; break;
                    default:
                        console.error(`不支持的REP操作: ${stringOp}`);
                        return null;
                }
                return {
                    address,
                    opcode: 'REP',
                    operands: [stringOp.toUpperCase()],
                    machineCode: [0xf3, stringOpCode],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            return {
                address,
                opcode: 'REP',
                operands: [],
                machineCode: [0xf3],
                length,
                originalLine: originalLine.trim()
            };
        case 'repe':
        case 'repz':
            return {
                address,
                opcode: opcode === 'repz' ? 'REPZ' : 'REPE',
                operands: [],
                machineCode: [0xf3],
                length,
                originalLine: originalLine.trim()
            };
        case 'repne':
        case 'repnz':
            return {
                address,
                opcode: opcode === 'repnz' ? 'REPNZ' : 'REPNE',
                operands: [],
                machineCode: [0xf2],
                length,
                originalLine: originalLine.trim()
            };
        case 'jg':
        case 'jnle':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jg' ? 'JG' : 'JNLE',
                    operands: [operands[0]],
                    machineCode: [0x7f, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jng':
        case 'jle':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jng' ? 'JNG' : 'JLE',
                    operands: [operands[0]],
                    machineCode: [0x7e, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jb':
        case 'jnae':
        case 'jc':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jc' ? 'JC' : (opcode === 'jb' ? 'JB' : 'JNAE'),
                    operands: [operands[0]],
                    machineCode: [0x72, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'jnb':
        case 'jae':
        case 'jnc':
            if (operands.length === 1) {
                const targetAddress = this.parseImmediate(operands[0]);
                const offset = targetAddress - (address + 2);
                const offset8 = offset & 0xff;
                return {
                    address,
                    opcode: opcode === 'jnc' ? 'JNC' : (opcode === 'jnb' ? 'JNB' : 'JAE'),
                    operands: [operands[0]],
                    machineCode: [0x73, offset8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'wait':
            return {
                address,
                opcode: 'WAIT',
                operands: [],
                machineCode: [0x9b],
                length,
                originalLine: originalLine.trim()
            };
        case 'esc':
            // ESC指令格式: ESC opcode, source
            // 实际上ESC是处理器指令前缀，用于协处理器
            if (operands.length >= 1) {
                const escapeCode = this.parseImmediate(operands[0]);
                const modRM = (escapeCode & 0x07) << 3;
                return {
                    address,
                    opcode: 'ESC',
                    operands: operands,
                    machineCode: [0xd8 | (escapeCode >> 3), modRM],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'lock':
            return {
                address,
                opcode: 'LOCK',
                operands: [],
                machineCode: [0xf0],
                length,
                originalLine: originalLine.trim()
            };
        case 'xlat':
            return {
                address,
                opcode: 'XLAT',
                operands: [],
                machineCode: [0xd7],
                length,
                originalLine: originalLine.trim()
            };
        case 'enter':
            if (operands.length >= 1) {
                const imm16 = this.parseImmediate(operands[0]);
                const nesting = operands.length > 1 ? this.parseImmediate(operands[1]) : 0;
                return {
                    address,
                    opcode: 'ENTER',
                    operands: [imm16, nesting],
                    machineCode: [0xc8, imm16 & 0xff, (imm16 >> 8) & 0xff, nesting & 0xff],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
        case 'leave':
            return {
                address,
                opcode: 'LEAVE',
                operands: [],
                machineCode: [0xc9],
                length,
                originalLine: originalLine.trim()
            };
        case 'lea':
            if (operands.length === 2) {
                const destReg = operands[0].toLowerCase();
                const srcOperand = operands[1];

                const regMap = {
                    'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                    'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                };

                if (regMap.hasOwnProperty(destReg)) {
                    const modRM = (regMap[destReg] << 3) | 0x06;
                    let offset = 0;

                    // 处理带偏移的表达式，如 "LABEL+3" 或 "LABEL-5"
                    const plusIndex = srcOperand.indexOf('+');
                    const minusIndex = srcOperand.indexOf('-');

                    if (plusIndex !== -1) {
                        // 格式: LABEL+offset
                        const label = srcOperand.substring(0, plusIndex);
                        const offsetStr = srcOperand.substring(plusIndex + 1);
                        // 尝试查找标签（不区分大小写）
                        const labelLower = label.toLowerCase();
                        const symbolKey = Object.keys(this.symbols).find(k => k.toLowerCase() === labelLower);
                        if (symbolKey) {
                            offset = this.symbols[symbolKey] + this.parseImmediate(offsetStr);
                        }
                    } else if (minusIndex !== -1 && minusIndex > 0) {
                        // 格式: LABEL-offset (确保不是负数的立即数)
                        const label = srcOperand.substring(0, minusIndex);
                        const offsetStr = srcOperand.substring(minusIndex + 1);
                        // 尝试查找标签（不区分大小写）
                        const labelLower = label.toLowerCase();
                        const symbolKey = Object.keys(this.symbols).find(k => k.toLowerCase() === labelLower);
                        if (symbolKey) {
                            offset = this.symbols[symbolKey] - this.parseImmediate(offsetStr);
                        }
                    } else {
                        // 尝试查找标签（不区分大小写）
                        const srcLower = srcOperand.toLowerCase();
                        const symbolKey = Object.keys(this.symbols).find(k => k.toLowerCase() === srcLower);
                        if (symbolKey) {
                            offset = this.symbols[symbolKey];
                        } else if (this.isImmediate(srcOperand)) {
                            // 立即数
                            offset = this.parseImmediate(srcOperand);
                        }
                    }

                    return {
                        address,
                        opcode: 'LEA',
                        operands: [destReg.toUpperCase(), srcOperand],
                        machineCode: [0x8d, modRM, offset & 0xff, (offset >> 8) & 0xff],
                        length,
                        originalLine: originalLine.trim()
                    };
                }
            }
            break;
        case 'int':
            if (operands.length === 1 && this.isImmediate(operands[0])) {
                const imm8 = this.parseImmediate(operands[0]);
                return {
                    address,
                    opcode: 'INT',
                    operands: [operands[0]],
                    machineCode: [0xcd, imm8],
                    length,
                    originalLine: originalLine.trim()
                };
            }
            break;
    }

    // 未知指令
    console.warn(`未知指令: ${line}`);
    return {
        address,
        opcode: 'UNKNOWN',
        operands: [],
        machineCode: [],
        length,
        originalLine: originalLine.trim()
    };
}
