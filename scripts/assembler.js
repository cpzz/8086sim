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
            } else if (line.toLowerCase().includes('db')) {
                // 检查DB指令前面是否有标签（如 "msg DB 'Hello'"）
                const dbIndex = line.toLowerCase().indexOf('db');
                if (dbIndex > 0) {
                    const potentialLabel = line.substring(0, dbIndex).trim();
                    // 如果不是空字符串且不是注释，则作为标签
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        this.symbols[potentialLabel] = address;
                    }
                }
                // 处理 DB 数据定义
                const dataPart = line.substring(dbIndex + 2).trim();
                const data = this.parseDB(dataPart);
                address += data.length;
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

            if (line.toLowerCase().includes('db')) {
                // 处理 DB 数据定义 - 数据写入数据段（EXE格式标准）
                const dbIndex = line.toLowerCase().indexOf('db');
                const dataPart = line.substring(dbIndex + 2).trim();
                const data = this.parseDB(dataPart);

                // 提取标签名称（如果有）
                let label = '';
                if (dbIndex > 0) {
                    const potentialLabel = line.substring(0, dbIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        label = potentialLabel;
                    }
                }

                // 数据定义应该写入数据段
                // 使用标签地址作为数据段中的偏移地址
                // 计算数据段的物理地址 (DS << 4 + offset)
                // 注意：这里我们假设 DS 段寄存器的值会在执行时由程序设置
                // 但为了简单起见，我们直接写入 DS 段的对应偏移地址
                const dsOffset = address; // 使用相同的偏移地址

                // 保存数据段的写入信息，用于后续处理
                if (!this.dataSegments) {
                    this.dataSegments = [];
                }
                this.dataSegments.push({
                    offset: dsOffset,
                    data: data,
                    label: label
                });

                // 写入数据段（DS = 0x2000）
                const dsSegmentBase = 0x2000 << 4;
                for (let j = 0; j < data.length; j++) {
                    this.memory.write8(dsSegmentBase + dsOffset + j, data[j]);
                }

                // 仍然写入代码段（用于标签地址计算）
                for (let j = 0; j < data.length; j++) {
                    this.memory.write8(address + j, data[j]);
                }
                address += data.length;
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

        // 处理 DB 数据定义
        if (lineWithoutComment.toLowerCase().startsWith('db')) {
            const dataPart = lineWithoutComment.substring(2).trim();
            return this.parseDB(dataPart).length;
        }

        const opcodeEndIndex = lineWithoutComment.indexOf(' ');
        const opcode = opcodeEndIndex === -1 ? lineWithoutComment.toLowerCase() : lineWithoutComment.substring(0, opcodeEndIndex).toLowerCase();
        const operandsPart = opcodeEndIndex === -1 ? '' : lineWithoutComment.substring(opcodeEndIndex).trim();
        const operands = operandsPart.split(/[,\s]+/).filter(Boolean).map(op => op.toLowerCase());

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
                if ((operands[0] === 'bx' || operands[0] === 'cx' || operands[0] === 'dx') && this.isImmediate(operands[1])) return 4;
                return 2;
            case 'mov':
                // 16位寄存器立即数（包括标签）
                if ((operands[0] === 'ax' || operands[0] === 'bx' || operands[0] === 'cx' || operands[0] === 'dx' || operands[0] === 'si' || operands[0] === 'di') && this.isImmediate(operands[1])) return 3;
                // 8位寄存器立即数
                if (['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(operands[0]) && this.isImmediate(operands[1])) return 2;
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
                return 2; // 默认返回 short 的长度，实际会根据偏移量选择
            case 'jz':
            case 'je':
            case 'jnz':
            case 'jne':
                return 2;
            case 'call':
                return 3;
            case 'int':
                return 2;
            case 'inc':
            case 'dec':
                return 1;
            case 'lea':
                // LEA r16, m - 操作码1字节 + ModR/M 1字节 + 位移2字节（如果需要）
                return 4;
            default:
                return 2;
        }
    }

    // 解析 DB 数据定义
    parseDB(dataPart) {
        const result = [];
        // 移除注释
        const dataWithoutComment = dataPart.split(';')[0].trim();
        // 分割多个值（用逗号分隔）
        const values = dataWithoutComment.split(',').map(v => v.trim());

        for (const value of values) {
            if (value.startsWith("'") && value.endsWith("'")) {
                // 字符串
                const str = value.slice(1, -1);
                for (let i = 0; i < str.length; i++) {
                    result.push(str.charCodeAt(i));
                }
            } else if (value.startsWith('"') && value.endsWith('"')) {
                // 字符串（双引号）
                const str = value.slice(1, -1);
                for (let i = 0; i < str.length; i++) {
                    result.push(str.charCodeAt(i));
                }
            } else {
                // 立即数
                result.push(this.parseImmediate(value) & 0xff);
            }
        }
        return result;
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
        const operands = operandsPart.split(/[,\s]+/).filter(Boolean).map(op => op.toLowerCase());

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
                if (operands[0] === 'al' && this.isImmediate(operands[1])) {
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
                if (operands[0] === 'ax' && this.isImmediate(operands[1])) {
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
                if (operands[0] === 'bx' && this.isImmediate(operands[1])) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['BX', operands[1]],
                        machineCode: [0x81, 0xc3, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 4,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx' && this.isImmediate(operands[1])) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['CX', operands[1]],
                        machineCode: [0x81, 0xc1, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 4,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx' && this.isImmediate(operands[1])) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'ADD',
                        operands: ['DX', operands[1]],
                        machineCode: [0x81, 0xc2, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 4,
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
                if (operands[0] === 'dl' && operands[1] === '[si]') {
                    // MOV DL, [SI] - reg=010(DL), r/m=100([SI])
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['DL', '[SI]'],
                        machineCode: [0x8a, 0x14],
                        length: 2,
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
                // 支持MOV立即数寻址（16位寄存器）
                if (operands[0] === 'ax' && this.isImmediate(operands[1])) {
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
                // MOV段寄存器到通用寄存器
                if (operands[0] === 'ax' && operands[1] === 'cs') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', 'CS'],
                        machineCode: [0x8c, 0xc8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === 'ds') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', 'DS'],
                        machineCode: [0x8c, 0xd8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === 'ss') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', 'SS'],
                        machineCode: [0x8c, 0xe0],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === 'es') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', 'ES'],
                        machineCode: [0x8c, 0xe8],
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx' && this.isImmediate(operands[1])) {
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
                if (operands[0] === 'cx' && this.isImmediate(operands[1])) {
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
                if (operands[0] === 'dx' && this.isImmediate(operands[1])) {
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
                if (operands[0] === 'si' && this.isImmediate(operands[1])) {
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
                if (operands[0] === 'di' && this.isImmediate(operands[1])) {
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
                // 支持MOV立即数寻址（8位寄存器）
                if (operands[0] === 'al' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AL', operands[1]],
                        machineCode: [0xb0, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ah' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AH', operands[1]],
                        machineCode: [0xb4, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['BL', operands[1]],
                        machineCode: [0xb3, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bh' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['BH', operands[1]],
                        machineCode: [0xb7, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['CL', operands[1]],
                        machineCode: [0xb1, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ch' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['CH', operands[1]],
                        machineCode: [0xb5, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['DL', operands[1]],
                        machineCode: [0xb2, imm8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dh' && this.isImmediate(operands[1])) {
                    const imm8 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['DH', operands[1]],
                        machineCode: [0xb6, imm8],
                        length: 2,
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
                if (operands[0] === 'ax' && operands[1] === 'bx') {
                    // CMP AX, BX - mod=11, reg=000(AX), rm=011(BX), opcode=39
                    return {
                        address,
                        opcode: 'CMP',
                        operands: ['AX', 'BX'],
                        machineCode: [0x39, 0xc3],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'call':
                if (operands.length === 1) {
                    const targetAddress = this.parseImmediate(operands[0]);
                    // CALL rel16 的偏移量 = 目标地址 - (当前地址 + 指令长度)
                    const offset = targetAddress - (address + 3);
                    // 将偏移量转换为有符号的16位整数
                    const offset16 = offset & 0xffff;
                    return {
                        address,
                        opcode: 'CALL',
                        operands: [operands[0]],
                        machineCode: [0xe8, offset16 & 0xff, (offset16 >> 8) & 0xff],
                        length: 3,
                        originalLine: 'CALL'
                    };
                }
                break;
            case 'jmp':
                if (operands.length === 1) {
                    const targetAddress = this.parseImmediate(operands[0]);
                    const offset = targetAddress - (address + 2);
                    // 判断使用 short 还是 near ptr
                    if (offset >= -128 && offset <= 127) {
                        // JMP short (EB)
                        const offset8 = offset & 0xff;
                        return {
                            address,
                            opcode: 'JMP',
                            operands: [operands[0]],
                            machineCode: [0xeb, offset8],
                            length: 2,
                            originalLine: 'JMP'
                        };
                    } else {
                        // JMP near ptr (E9)
                        const offset16 = offset & 0xffff;
                        return {
                            address,
                            opcode: 'JMP',
                            operands: [operands[0]],
                            machineCode: [0xe9, offset16 & 0xff, (offset16 >> 8) & 0xff],
                            length: 3,
                            originalLine: 'JMP'
                        };
                    }
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
                        length: 2,
                        originalLine: opcode === 'jz' ? 'JZ' : 'JE'
                    };
                }
                break;
            case 'lea':
                if (operands.length === 2) {
                    const destReg = operands[0].toLowerCase();
                    const srcOperand = operands[1];
                    
                    // 检查目标是否是16位寄存器
                    const regMap = {
                        'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                        'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                    };
                    
                    if (regMap.hasOwnProperty(destReg)) {
                        // LEA r16, m
                        // 操作码: 0x8D
                        // ModR/M字节: mod=00, reg=目标寄存器, r/m=110 (直接寻址)
                        const modRM = (regMap[destReg] << 3) | 0x06; // 0b00rrr110
                        
                        // 解析源操作数（应该是标签或地址）
                        let offset = 0;
                        if (this.symbols.hasOwnProperty(srcOperand)) {
                            offset = this.symbols[srcOperand];
                        } else if (this.isImmediate(srcOperand)) {
                            offset = this.parseImmediate(srcOperand);
                        }
                        
                        return {
                            address,
                            opcode: 'LEA',
                            operands: [destReg.toUpperCase(), srcOperand],
                            machineCode: [0x8d, modRM, offset & 0xff, (offset >> 8) & 0xff],
                            length: 4,
                            originalLine: originalLine.trim()
                        };
                    }
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
                        length: 2,
                        originalLine: opcode === 'jnz' ? 'JNZ' : 'JNE'
                    };
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'inc':
                if (operands.length === 1) {
                    const reg = operands[0];
                    const regMap = {
                        'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                        'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                    };
                    if (regMap.hasOwnProperty(reg)) {
                        return {
                            address,
                            opcode: 'INC',
                            operands: [reg.toUpperCase()],
                            machineCode: [0x40 + regMap[reg]],
                            length: 1,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                break;
            case 'dec':
                if (operands.length === 1) {
                    const reg = operands[0];
                    const regMap = {
                        'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                        'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                    };
                    if (regMap.hasOwnProperty(reg)) {
                        return {
                            address,
                            opcode: 'DEC',
                            operands: [reg.toUpperCase()],
                            machineCode: [0x48 + regMap[reg]],
                            length: 1,
                            originalLine: originalLine.trim()
                        };
                    }
                }
                break;
            case 'lea':
                if (operands.length === 2) {
                    const destReg = operands[0].toLowerCase();
                    const srcOperand = operands[1];
                    
                    // 检查目标是否是16位寄存器
                    const regMap = {
                        'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3,
                        'sp': 4, 'bp': 5, 'si': 6, 'di': 7
                    };
                    
                    if (regMap.hasOwnProperty(destReg)) {
                        // LEA r16, m
                        // 操作码: 0x8D
                        // ModR/M字节: mod=00, reg=目标寄存器, r/m=110 (直接寻址)
                        const modRM = (regMap[destReg] << 3) | 0x06; // 0b00rrr110
                        
                        // 解析源操作数（应该是标签或地址）
                        let offset = 0;
                        if (this.symbols.hasOwnProperty(srcOperand)) {
                            offset = this.symbols[srcOperand];
                        } else if (this.isImmediate(srcOperand)) {
                            offset = this.parseImmediate(srcOperand);
                        }
                        
                        return {
                            address,
                            opcode: 'LEA',
                            operands: [destReg.toUpperCase(), srcOperand],
                            machineCode: [0x8d, modRM, offset & 0xff, (offset >> 8) & 0xff],
                            length: 4,
                            originalLine: originalLine.trim()
                        };
                    }
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
                        length: 2,
                        originalLine: opcode === 'jnz' ? 'JNZ' : 'JNE'
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
        // 检查是否是标签
        if (this.symbols.hasOwnProperty(value)) {
            return this.symbols[value];
        }

        if (value.startsWith('0x')) {
            return parseInt(value, 16);
        } else if (value.endsWith('h') || value.endsWith('H')) {
            // 支持十六进制 h 后缀（如 1000h）
            const hexValue = value.slice(0, -1);
            return parseInt(hexValue, 16);
        } else if (value.startsWith('0b')) {
            return parseInt(value, 2);
        } else if (value.startsWith('0') && value !== '0') {
            // 八进制数（排除单个 0）
            return parseInt(value, 8);
        } else {
            return parseInt(value, 10);
        }
    }

    // 检查是否是立即数
    isImmediate(value) {
        // 寄存器列表
        const registers = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'sp', 'bp', 'al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'];
        // 如果是寄存器，返回 false
        if (registers.includes(value.toLowerCase())) {
            return false;
        }
        // 如果是内存引用（如 [bx]），返回 false
        if (value.startsWith('[') && value.endsWith(']')) {
            return false;
        }
        // 否则是立即数
        return true;
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
