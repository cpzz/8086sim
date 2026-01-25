class Assembler {
    constructor(memory) {
        this.memory = memory;
        this.symbols = {}; // 符号表，用于存储标签和地址
        this.instructions = []; // 解析后的指令列表
    }
    
    // 解析汇编代码
    parse(code) {
        // 清空之前的解析结果
        this.symbols = {};
        this.instructions = [];
        
        // 按行分割代码
        const lines = code.split('\n');
        let address = 0;
        
        // 第一遍：收集标签
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.startsWith(';')) {
                continue; // 跳过空行和注释
            }
            
            // 检查是否是标签
            if (line.endsWith(':')) {
                const label = line.slice(0, -1).trim();
                this.symbols[label] = address;
            } else {
                // 估算指令长度（简单实现，实际需要更复杂的计算）
                address += this.estimateInstructionLength(line);
            }
        }
        
        // 第二遍：解析指令并生成机器码
        address = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.startsWith(';')) {
                continue; // 跳过空行和注释
            }
            
            if (line.endsWith(':')) {
                // 跳过标签行
                continue;
            }
            
            // 解析指令
            const instruction = this.parseInstruction(line, address);
            if (instruction) {
                this.instructions.push(instruction);
                // 写入内存
                this.writeInstructionToMemory(instruction);
                address += instruction.length;
            }
        }
        
        return this.instructions;
    }
    
    // 估算指令长度
    estimateInstructionLength(line) {
        // 简单实现，实际需要更复杂的解析
        const lineWithoutComment = line.split(';')[0].trim();
        const opcodeEndIndex = lineWithoutComment.indexOf(' ');
        const opcode = opcodeEndIndex === -1 ? lineWithoutComment.toLowerCase() : lineWithoutComment.substring(0, opcodeEndIndex).toLowerCase();
        const operandsPart = opcodeEndIndex === -1 ? '' : lineWithoutComment.substring(opcodeEndIndex).trim();
        const operands = operandsPart.split(/[,\s]+/).filter(Boolean);
        
        switch (opcode) {
            case 'nop':
            case 'ret':
                return 1;
            case 'add':
            case 'sub':
            case 'and':
            case 'or':
            case 'xor':
            case 'adc':
                if (operands[0] === 'al') return 2;
                if (operands[0] === 'ax') return 3;
                if (operands[0] === 'bx' && operands[1].startsWith('0x')) return 4;
                return 2;
            case 'mov':
                if ((operands[0] === 'ax' || operands[0] === 'bx' || operands[0] === 'cx' || operands[0] === 'dx' || operands[0] === 'si' || operands[0] === 'di') && operands[1].startsWith('0x')) return 3;
                return 2;
            case 'shl':
            case 'shr':
                return 2;
            case 'push':
            case 'pop':
                return 1;
            case 'cmp':
                if (operands[0] === 'al') return 2;
                if (operands[0] === 'ax') return 3;
                return 2;
            case 'jmp':
                return 2;
            case 'jz':
            case 'je':
                return 2;
            default:
                return 2;
        }
    }
    
    // 解析单个指令
    parseInstruction(line, address) {
        const originalLine = line; // 保存原始行
        // 先移除注释，然后分割指令
        const lineWithoutComment = line.split(';')[0].trim();
        // 分割操作码和操作数
        const opcodeEndIndex = lineWithoutComment.indexOf(' ');
        const opcode = opcodeEndIndex === -1 ? lineWithoutComment.toLowerCase() : lineWithoutComment.substring(0, opcodeEndIndex).toLowerCase();
        // 提取操作数，移除逗号并分割
        const operandsPart = opcodeEndIndex === -1 ? '' : lineWithoutComment.substring(opcodeEndIndex).trim();
        const operands = operandsPart.split(/[,\s]+/).filter(Boolean);
        
        switch (opcode) {
            case 'nop':
                return {
                    address,
                    opcode: 'NOP',
                    operands: [],
                    machineCode: [0x90],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'add':
                if (operands[0] === 'al') {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['AL', operands[1]],
                        machineCode: [0x04, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['AX', operands[1]],
                        machineCode: [0x05, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx' && operands[1] === 'cx') {
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['BX', 'CX'],
                        machineCode: [0x01, 0xcb],
                        length: 2,
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
                        length: 2,
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
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'and':
                if (operands[0] === 'al') {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'AND',
                        operands: ['AL', operands[1]],
                        machineCode: [0x24, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'AND',
                        operands: ['AX', operands[1]],
                        machineCode: [0x25, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
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
                        length: 2,
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
                        length: 3,
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
                        length: 4,
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
                        length: 2,
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
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx' && operands[1] === 'dx') {
                    return {
                        address,
                        opcode: 'XOR',
                        operands: ['CX', 'DX'],
                        machineCode: [0x31, 0xd1],
                        length: 2,
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
                        length: 2,
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
                        length: 3,
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
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['CX', 'AX'],
                        machineCode: [0x8b, 0xc8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx' && operands[1] === 'bx') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['DX', 'BX'],
                        machineCode: [0x8b, 0xda],
                        length: 2,
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
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === '[bx]' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['[BX]', 'AX'],
                        machineCode: [0x89, 0x07],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                // 支持MOV立即数寻址
                if (operands[0] === 'ax' && operands[1].startsWith('0x')) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', operands[1]],
                        machineCode: [0xb8, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx' && operands[1].startsWith('0x')) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['BX', operands[1]],
                        machineCode: [0xbb, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx' && operands[1].startsWith('0x')) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['CX', operands[1]],
                        machineCode: [0xb9, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx' && operands[1].startsWith('0x')) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['DX', operands[1]],
                        machineCode: [0xba, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'si' && operands[1].startsWith('0x')) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['SI', operands[1]],
                        machineCode: [0xbe, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'di' && operands[1].startsWith('0x')) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['DI', operands[1]],
                        machineCode: [0xbf, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'ret':
                return {
                    address,
                    opcode: 'RET',
                    operands: [],
                    machineCode: [0xc3],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'shl':
                if (operands[0] === 'al' && operands[1] === '1') {
                    return {
                        address,
                        opcode: 'SHL',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xe0],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === '1') {
                    return {
                        address,
                        opcode: 'SHL',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xe0],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'shr':
                if (operands[0] === 'al' && operands[1] === '1') {
                    return {
                        address,
                        opcode: 'SHR',
                        operands: ['AL', '1'],
                        machineCode: [0xd0, 0xe8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === '1') {
                    return {
                        address,
                        opcode: 'SHR',
                        operands: ['AX', '1'],
                        machineCode: [0xd1, 0xe8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx' && operands[1] === '1') {
                    return {
                        address,
                        opcode: 'SHR',
                        operands: ['BX', '1'],
                        machineCode: [0xd1, 0xeb],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'push':
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'PUSH',
                        operands: ['AX'],
                        machineCode: [0x50],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'PUSH',
                        operands: ['BX'],
                        machineCode: [0x53],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'PUSH',
                        operands: ['CX'],
                        machineCode: [0x51],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'PUSH',
                        operands: ['DX'],
                        machineCode: [0x52],
                        length: 1,
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
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'POP',
                        operands: ['BX'],
                        machineCode: [0x5b],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'POP',
                        operands: ['CX'],
                        machineCode: [0x59],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'POP',
                        operands: ['DX'],
                        machineCode: [0x5a],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'cmp':
                if (operands[0] === 'al') {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'CMP',
                        operands: ['AL', operands[1]],
                        machineCode: [0x3c, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'CMP',
                        operands: ['AX', operands[1]],
                        machineCode: [0x3d, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'jmp':
                if (operands.length === 1) {
                    const offset = this.parseImmediate(operands[0]);
                    return {
                        address,
                        opcode: 'JMP',
                        operands: [operands[0]],
                        machineCode: [0xeb, offset & 0xff],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'jz':
            case 'je':
                if (operands.length === 1) {
                    const offset = this.parseImmediate(operands[0]);
                    return {
                        address,
                        opcode: 'JZ',
                        operands: [operands[0]],
                        machineCode: [0x74, offset & 0xff],
                        length: 2,
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
            length: 1,
            originalLine: originalLine.trim()
        };
    }
    
    // 解析立即数
    parseImmediate(value) {
        if (value.startsWith('0x')) {
            return parseInt(value, 16);
        } else if (value.startsWith('0b')) {
            return parseInt(value, 2);
        } else if (value.startsWith('0')) {
            return parseInt(value, 8);
        } else {
            return parseInt(value, 10);
        }
    }
    
    // 将指令写入内存
    writeInstructionToMemory(instruction) {
        for (let i = 0; i < instruction.machineCode.length; i++) {
            this.memory.write8(instruction.address + i, instruction.machineCode[i]);
        }
    }
    
    // 从文件加载汇编代码
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const code = e.target.result;
                const instructions = this.parse(code);
                resolve(instructions);
            };
            reader.onerror = (e) => {
                reject(new Error('文件读取失败'));
            };
            reader.readAsText(file);
        });
    }
    
    // 获取解析后的指令列表
    getInstructions() {
        return this.instructions;
    }
    
    // 获取符号表
    getSymbols() {
        return this.symbols;
    }
}
