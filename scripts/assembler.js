class Assembler {
    constructor(memory) {
        this.memory = memory;
        this.symbols = {}; // 符号表，用于存储标签和地址
        this.instructions = []; // 解析后的指令列表
        this.dataSegments = []; // 数据段信息
        this.currentSegment = 'code'; // 当前所在的段（data/code）
        this.model = 'small'; // 默认内存模型
        this.stackSize = 256; // 默认堆栈大小（100H）
        this.entryPoint = null; // 程序入口点
    }

    // 检查是否是伪指令，如果是段切换伪指令则返回段类型
    getDirectiveType(line) {
        const lowerLine = line.trim().toLowerCase();

        // 检查是否是以`.`开头的伪指令
        if (lowerLine.startsWith('.data')) {
            return 'data';
        } else if (lowerLine.startsWith('.code')) {
            return 'code';
        } else if (lowerLine.startsWith('.model') ||
                   lowerLine.startsWith('.stack') ||
                   lowerLine.startsWith('.startup') ||
                   lowerLine.startsWith('.exit')) {
            return 'other';
        } else if (lowerLine.startsWith('.end') || lowerLine.startsWith('end ')) {
            // end 伪指令（用于指定入口点）
            return 'other';
        }
        
        // 检查是否是传统的8086汇编伪指令
        if (lowerLine.startsWith('assume ')) {
            return 'other';
        } else if (lowerLine.endsWith(' segment')) {
            return 'other';
        } else if (lowerLine.endsWith(' ends')) {
            return 'other';
        }
        
        // proc 和 endp 不在这里处理，在第一遍扫描的标签识别逻辑中处理
        return null;
    }

    // 解析伪指令
    parseDirective(line) {
        const lowerLine = line.trim().toLowerCase();

        if (lowerLine.startsWith('.model')) {
            // 解析 .MODEL 伪指令
            const parts = lowerLine.split(/\s+/).filter(Boolean);
            if (parts.length > 1) {
                this.model = parts[1];
            }
        } else if (lowerLine.startsWith('.stack')) {
            // 解析 .STACK 伪指令
            const parts = lowerLine.split(/\s+/).filter(Boolean);
            if (parts.length > 1) {
                this.stackSize = this.parseImmediate(parts[1]);
            }
        } else if (lowerLine.startsWith('.end') || lowerLine.startsWith('end ')) {
            // 解析 .END 伪指令
            const parts = lowerLine.split(/\s+/).filter(Boolean);
            if (parts.length > 1) {
                this.entryPoint = parts[1];
            }
        } else if (lowerLine.includes(' proc ')) {
            // 解析 PROC 伪指令
            const parts = lowerLine.split(/\s+/).filter(Boolean);
            // 提取过程名
            if (parts.length > 0) {
                // 过程名是第一个部分
                const procName = parts[0];
                // 可以在这里存储过程信息
            }
        } else if (lowerLine.includes(' endp ')) {
            // 解析 ENDP 伪指令
            // 这里可以处理过程结束的逻辑
        }
    }

    // 检查是否是伪指令
    isDirective(line) {
        return this.getDirectiveType(line) !== null;
    }

    // 解析汇编代码
    parse(code) {
        // 清空之前的解析结果
        this.symbols = {};
        this.instructions = [];
        this.dataSegments = [];
        this.currentSegment = 'code'; // 默认在代码段
        
        // 按行分割代码
        const lines = code.split('\n');
        let address = 0;
        
        // 第一遍：收集标签
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.startsWith(';')) {
                continue; // 跳过空行和注释
            }

            // 检查是否是段切换伪指令
            const directiveType = this.getDirectiveType(line);
            if (directiveType) {
                if (directiveType === 'data') {
                    this.currentSegment = 'data';
                    // 数据段从偏移 0 开始
                    address = 0;
                } else if (directiveType === 'code') {
                    this.currentSegment = 'code';
                    // 代码段从偏移 0 开始
                    address = 0;
                } else if (directiveType === 'other') {
                    // 解析其他伪指令
                    this.parseDirective(line);
                }
                continue;
            }

            // 检查是否是冒号标签（如 "label:"）
            if (line.endsWith(':')) {
                const label = line.slice(0, -1).trim();
                this.symbols[label] = address;
                continue;
            }

            // 检查是否是 DB 数据定义
            const dbIndex = line.toLowerCase().indexOf(' db ');
            if (dbIndex !== -1 && dbIndex > 0) {
                // 格式：label DB expr1, expr2, ...
                const potentialLabel = line.substring(0, dbIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                }

                const dataPart = line.substring(dbIndex + 4).trim();
                const data = this.parseDB(dataPart);

                address += data.length;
                continue;
            }

            // 检查是否是 DW 数据定义
            const dwIndex = line.toLowerCase().indexOf(' dw ');
            if (dwIndex !== -1 && dwIndex > 0) {
                // 格式：label DW expr1, expr2, ...
                const potentialLabel = line.substring(0, dwIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                }

                const dataPart = line.substring(dwIndex + 4).trim();
                const data = this.parseDW(dataPart);

                address += data.length;
                continue;
            }

            // 检查是否是 DD 数据定义
            const ddIndex = line.toLowerCase().indexOf(' dd ');
            if (ddIndex !== -1 && ddIndex > 0) {
                // 格式：label DD expr1, expr2, ...
                const potentialLabel = line.substring(0, ddIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                }

                const dataPart = line.substring(ddIndex + 4).trim();
                const data = this.parseDD(dataPart);

                address += data.length;
                continue;
            }

            // 检查是否是 EQU 常量定义
            const equIndex = line.toLowerCase().indexOf(' equ ');
            if (equIndex !== -1 && equIndex > 0) {
                // 格式：label EQU value
                const potentialLabel = line.substring(0, equIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    const valuePart = line.substring(equIndex + 5).trim();
                    const value = this.parseImmediate(valuePart);
                    this.symbols[potentialLabel] = value; // EQU定义的是常量值，不是地址
                }
                // EQU不占用空间
                continue;
            }

            // 检查是否是 PROC 伪指令
            // 支持多种格式：proc_name PROC, proc_name proc, proc_name PROC NEAR, proc_name PROC FAR
            const procMatch = line.toLowerCase().match(/\bproc\b/i);
            if (procMatch && procMatch.index > 0) {
                const procIndex = procMatch.index;
                // 提取标签名称
                const potentialLabel = line.substring(0, procIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                }
                // proc伪指令本身不占用空间
                continue;
            }

            // 检查是否是 ENDP 伪指令
            // 支持多种格式：proc_name ENDP, proc_name endp
            const endpMatch = line.toLowerCase().match(/\bendp\b/i);
            if (endpMatch) {
                continue;
            }

            // 估算指令长度（简单实现，实际需要更复杂的计算）
            address += this.estimateInstructionLength(line);
        }

        // 第二遍：解析指令并生成机器码
        address = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.startsWith(';')) {
                continue; // 跳过空行和注释
            }

            // 检查是否是段切换伪指令
            const directiveType = this.getDirectiveType(line);
            if (directiveType) {
                if (directiveType === 'data') {
                    this.currentSegment = 'data';
                    address = 0;
                } else if (directiveType === 'code') {
                    this.currentSegment = 'code';
                    address = 0;
                } else if (directiveType === 'other') {
                    // 解析其他伪指令
                    this.parseDirective(line);
                }
                continue;
            }

            if (line.endsWith(':')) {
                // 跳过标签行
                continue;
            }

            // 跳过 PROC 和 ENDP 伪指令
            // 只匹配独立的 proc/endp 指令（不在字符串、注释或其他指令中）
            const parts = line.split(/\s+/).filter(Boolean);
            const firstWord = parts.length > 0 ? parts[0].toLowerCase() : '';
            const secondWord = parts.length > 1 ? parts[1].toLowerCase() : '';
            const isProcLine = firstWord === 'proc' || secondWord === 'proc';
            const isEndpLine = firstWord === 'endp' || secondWord === 'endp';

            if (isProcLine || isEndpLine) {
                continue;
            }

            // 检查是否是 DB 数据定义
            const dbIndex = line.toLowerCase().indexOf(' db ');
            if (dbIndex !== -1) {
                // 处理 DB 数据定义
                const dataPart = line.substring(dbIndex + 4).trim();
                const data = this.parseDB(dataPart);

                // 提取标签名称
                let label = '';
                if (dbIndex > 0) {
                    const potentialLabel = line.substring(0, dbIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        label = potentialLabel;
                    }
                }

                this.dataSegments.push({
                    offset: address,
                    data: data,
                    label: label
                });

                address += data.length;
                continue;
            }

            // 检查是否是 DW 数据定义
            const dwIndex = line.toLowerCase().indexOf(' dw ');
            if (dwIndex !== -1) {
                // 处理 DW 数据定义
                const dataPart = line.substring(dwIndex + 4).trim();
                const data = this.parseDW(dataPart);

                // 提取标签名称
                let label = '';
                if (dwIndex > 0) {
                    const potentialLabel = line.substring(0, dwIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        label = potentialLabel;
                    }
                }

                this.dataSegments.push({
                    offset: address,
                    data: data,
                    label: label
                });

                address += data.length;
                continue;
            }

            // 检查是否是 DD 数据定义
            const ddIndex = line.toLowerCase().indexOf(' dd ');
            if (ddIndex !== -1) {
                // 处理 DD 数据定义
                const dataPart = line.substring(ddIndex + 4).trim();
                const data = this.parseDD(dataPart);

                // 提取标签名称
                let label = '';
                if (ddIndex > 0) {
                    const potentialLabel = line.substring(0, ddIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        label = potentialLabel;
                    }
                }

                this.dataSegments.push({
                    offset: address,
                    data: data,
                    label: label
                });

                address += data.length;
                continue;
            }

            // 检查是否是 EQU 常量定义（第二遍跳过，已在第一遍处理）
            const equIndex = line.toLowerCase().indexOf(' equ ');
            if (equIndex !== -1 && equIndex > 0) {
                continue; // EQU已在第一遍处理，不占用空间
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
            case 'rep':
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
            case 'adc':
            case 'sbb':
                if (operands[0] === 'al') return 2;
                if (operands[0] === 'ax') return 3;
                if ((operands[0] === 'bx' || operands[0] === 'cx' || operands[0] === 'dx') && this.isImmediate(operands[1])) return 4;
                return 2;
            case 'mov':
                // MOV 内存[寄存器], 立即数 (如 arr[si], 1)
                if (operands[0].includes('[') && operands[0].endsWith(']') && this.isImmediate(operands[1])) {
                    const immValue = this.parseImmediate(operands[1]);
                    // 如果是label[reg]格式，指令长度更长（需要包含位移量）
                    if (!operands[0].startsWith('[')) {
                        // 提取标签名，检查位移量大小
                        const bracketMatch = operands[0].match(/^(.+?)\[(.+?)\]$/);
                        if (bracketMatch) {
                            const labelPart = bracketMatch[1];
                            // 检查标签是否在symbols中
                            if (this.symbols.hasOwnProperty(labelPart)) {
                                const labelOffset = this.symbols[labelPart];
                                // 判断位移量是8位还是16位
                                const disp8 = labelOffset >= -128 && labelOffset <= 127;
                                if (immValue >= 0 && immValue <= 255) {
                                    // 8位立即数 + 8位位移 = 4字节, 或 8位立即数 + 16位位移 = 5字节
                                    return disp8 ? 4 : 5;
                                } else {
                                    // 16位立即数 + 8位位移 = 5字节, 或 16位立即数 + 16位位移 = 6字节
                                    return disp8 ? 5 : 6;
                                }
                            }
                        }
                        return (immValue >= 0 && immValue <= 255) ? 4 : 5; // 默认值
                    }
                    return (immValue >= 0 && immValue <= 255) ? 3 : 4;
                }
                // MOV 内存[寄存器], 立即数 (如 [si], 1)
                if (operands[0].startsWith('[') && operands[0].endsWith(']') && this.isImmediate(operands[1])) {
                    const immValue = this.parseImmediate(operands[1]);
                    return (immValue >= 0 && immValue <= 255) ? 3 : 4;
                }
                // MOV 标签, 立即数 (检查是否不是寄存器且第二个操作数是立即数)
                if (!['ax', 'bx', 'cx', 'dx', 'si', 'di', 'al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(operands[0]) && this.isImmediate(operands[1])) {
                    const immValue = this.parseImmediate(operands[1]);
                    return (immValue >= 0 && immValue <= 255) ? 5 : 6;
                }
                // 16位寄存器立即数（包括标签）
                if ((operands[0] === 'ax' || operands[0] === 'bx' || operands[0] === 'cx' || operands[0] === 'dx' || operands[0] === 'si' || operands[0] === 'di') && this.isImmediate(operands[1])) return 3;
                // 8位寄存器立即数
                if (['al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(operands[0]) && this.isImmediate(operands[1])) return 2;
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
                if (operands[0] === 'al') return 2;
                if (operands[0] === 'ax') return 3;
                // 对于si, di, sp, bp寄存器的立即数比较，返回4字节长度
                const specialRegisters = ['si', 'di', 'sp', 'bp'];
                if (specialRegisters.includes(operands[0].toLowerCase()) && this.isImmediate(operands[1])) return 4;
                // 对于bx, cx, dx寄存器的立即数比较，返回4字节长度
                if (['bx', 'cx', 'dx'].includes(operands[0].toLowerCase()) && this.isImmediate(operands[1])) return 4;
                return 2;
            case 'jmp':
                return 2; // 默认返回 short 的长度，实际会根据偏移量选择
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
                return 3;
            case 'int':
                return 2;
            case 'inc':
            case 'dec':
            case 'neg':
            case 'not':
                return 1;
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
                return 2;
            default:
                return 2;
        }
    }

    // 解析 DB 数据定义
    parseDB(dataPart) {
        const result = [];
        // 移除注释
        const dataWithoutComment = dataPart.split(';')[0].trim();

        // 正确分割多个值（用逗号分隔，但忽略字符串中的逗号）
        const values = [];
        let currentValue = '';
        let inString = false;
        let stringDelimiter = '';
        
        for (let i = 0; i < dataWithoutComment.length; i++) {
            const char = dataWithoutComment[i];
            
            if ((char === "'" || char === '"') && !inString) {
                // 开始一个字符串
                inString = true;
                stringDelimiter = char;
                currentValue += char;
            } else if (char === stringDelimiter && inString) {
                // 结束一个字符串
                inString = false;
                currentValue += char;
            } else if (char === ',' && !inString) {
                // 分隔符，添加当前值并重置
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                // 普通字符，添加到当前值
                currentValue += char;
            }
        }
        
        // 添加最后一个值
        if (currentValue.trim() !== '') {
            values.push(currentValue.trim());
        }

        for (const value of values) {
            if (value.includes('DUP(') || value.includes('dup(')) {
                // 处理DUP操作，如 10 DUP(1)
                const dupIndex = value.toLowerCase().indexOf('dup(');
                if (dupIndex > 0) {
                    // 解析重复次数
                    const countStr = value.substring(0, dupIndex).trim();
                    const count = parseInt(countStr);
                    
                    // 解析重复的值
                    const valueStart = value.indexOf('(') + 1;
                    const valueEnd = value.lastIndexOf(')');
                    const dupValue = value.substring(valueStart, valueEnd).trim();
                    
                    // 解析重复值
                    let parsedDupValue;
                    if (dupValue.startsWith("'") && dupValue.endsWith("'")) {
                        // 字符串
                        parsedDupValue = dupValue.charCodeAt(1);
                    } else if (dupValue.startsWith('"') && dupValue.endsWith('"')) {
                        // 字符串（双引号）
                        parsedDupValue = dupValue.charCodeAt(1);
                    } else {
                        // 立即数
                        parsedDupValue = this.parseImmediate(dupValue);
                    }
                    
                    // 添加重复的值
                    for (let i = 0; i < count; i++) {
                        result.push(isNaN(parsedDupValue) ? 0 : (parsedDupValue & 0xff));
                    }
                }
            } else if (value.startsWith("'") && value.endsWith("'")) {
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
            } else if (value === '$') {
                // 单独的$符号，作为字符处理
                result.push('$'.charCodeAt(0));
            } else {
                // 立即数
                const parsedValue = this.parseImmediate(value);
                result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
            }
        }
        return result;
    }
    
    // 解析 DW 数据定义
    parseDW(dataPart) {
        const result = [];
        // 移除注释
        const dataWithoutComment = dataPart.split(';')[0].trim();
        
        // 正确分割多个值（用逗号分隔）
        const values = [];
        let currentValue = '';
        
        for (let i = 0; i < dataWithoutComment.length; i++) {
            const char = dataWithoutComment[i];
            
            if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
                // 分隔符，添加当前值并重置
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                // 普通字符，添加到当前值
                currentValue += char;
            }
        }
        
        // 添加最后一个值
        if (currentValue.trim() !== '') {
            values.push(currentValue.trim());
        }

        for (const value of values) {
            // 立即数（16位）
            const parsedValue = this.parseImmediate(value);
            // 小端序，低字节在前，高字节在后
            result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
            result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 8) & 0xff));
        }
        return result;
    }

    // 解析 DD 数据定义（双字，4字节）
    parseDD(dataPart) {
        const result = [];
        // 移除注释
        const dataWithoutComment = dataPart.split(';')[0].trim();

        // 正确分割多个值（用逗号分隔）
        const values = [];
        let currentValue = '';

        for (let i = 0; i < dataWithoutComment.length; i++) {
            const char = dataWithoutComment[i];

            if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
                // 分隔符，添加当前值并重置
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                // 普通字符，添加到当前值
                currentValue += char;
            }
        }

        // 添加最后一个值
        if (currentValue.trim() !== '') {
            values.push(currentValue.trim());
        }

        for (const value of values) {
            // 立即数（32位）
            const parsedValue = this.parseImmediate(value);
            // 小端序，低字节在前
            result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
            result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 8) & 0xff));
            result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 16) & 0xff));
            result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 24) & 0xff));
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
                        length: 2,
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
                if (operands[0] === 'bx' && operands[1] === 'cx') {
                    // SUB BX, CX - mod=11, reg=001(CX), rm=011(BX), opcode=29
                    return {
                        address,
                        opcode: 'SUB',
                        operands: ['BX', 'CX'],
                        machineCode: [0x29, 0xcb],
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                if (operands[0] === 'ax' && operands[1] === 'cx') {
                    // MOV AX, CX - mod=11, reg=000(AX), rm=001(CX)
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', 'CX'],
                        machineCode: [0x8b, 0xc1],
                        length: 2,
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
                            length: 4,
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
                            length: 4,
                            originalLine: originalLine.trim()
                        };
                    }
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
                if (operands[0] === 'es' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['ES', 'AX'],
                        machineCode: [0x8e, 0xc0],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ss' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['SS', 'AX'],
                        machineCode: [0x8e, 0xd0],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cs' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['CS', 'AX'],
                        machineCode: [0x8e, 0xc8],
                        length: 2,
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
                                length: 4,
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
                                length: 4,
                                originalLine: originalLine.trim()
                            };
                        }
                    }
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
                    const imm16 = this.parseImmediate(operands[1]);
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
                                                length: 4,
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
                                                length: 5,
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
                                                length: 5,
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
                                                length: 6,
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
                                length: 5,
                                originalLine: originalLine.trim()
                            };
                        } else {
                            // MOV [disp16], imm16 - C7 06 disp16 imm16
                            return {
                                address,
                                opcode: 'MOV',
                                operands: [originalOperands[0], operands[1]],
                                machineCode: [0xc7, 0x06, offset & 0xff, (offset >> 8) & 0xff, imm16 & 0xff, (imm16 >> 8) & 0xff],
                                length: 6,
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
                                    length: 3,
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
                                    length: 4,
                                    originalLine: originalLine.trim()
                                };
                            }
                        }
                    }
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
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
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
                if (operands[0] === 'cx') {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'CMP',
                        operands: ['CX', operands[1]],
                        machineCode: [0x81, 0xf9, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 4,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'CMP',
                        operands: ['BX', operands[1]],
                        machineCode: [0x81, 0xfb, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 4,
                        originalLine: originalLine.trim()
                    };
                }
                // 支持更多寄存器的立即数比较指令
                const cmpRegMap = {
                    'ax': 0xf8, 'cx': 0xf9, 'dx': 0xfa, 'bx': 0xfb,
                    'sp': 0xfc, 'bp': 0xfd, 'si': 0xfe, 'di': 0xff
                };
                if (cmpRegMap.hasOwnProperty(operands[0])) {
                    const imm16 = this.parseImmediate(operands[1]);
                    return {
                        address,
                        opcode: 'CMP',
                        operands: [operands[0].toUpperCase(), operands[1]],
                        machineCode: [0x81, cmpRegMap[operands[0]], imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 4,
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
                        length: 2,
                        originalLine: 'JMP SHORT'
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 3,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['AX'],
                        machineCode: [0xf7, 0xd8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['BL'],
                        machineCode: [0xf6, 0xdb],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['BX'],
                        machineCode: [0xf7, 0xdb],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['CL'],
                        machineCode: [0xf6, 0xd9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['CX'],
                        machineCode: [0xf7, 0xd9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['DL'],
                        machineCode: [0xf6, 0xda],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'NEG',
                        operands: ['DX'],
                        machineCode: [0xf7, 0xda],
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['AX'],
                        machineCode: [0xf7, 0xd0],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['BL'],
                        machineCode: [0xf6, 0xd3],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['BX'],
                        machineCode: [0xf7, 0xd3],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['CL'],
                        machineCode: [0xf6, 0xd1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['CX'],
                        machineCode: [0xf7, 0xd1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['DL'],
                        machineCode: [0xf6, 0xd2],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'NOT',
                        operands: ['DX'],
                        machineCode: [0xf7, 0xd2],
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['AX'],
                        machineCode: [0x40],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['BL'],
                        machineCode: [0xfe, 0xc3],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['BX'],
                        machineCode: [0x43],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['CL'],
                        machineCode: [0xfe, 0xc1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['CX'],
                        machineCode: [0x41],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['DL'],
                        machineCode: [0xfe, 0xc2],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['DX'],
                        machineCode: [0x42],
                        length: 1,
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
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'di') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['DI'],
                        machineCode: [0x47],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bp') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['BP'],
                        machineCode: [0x45],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'sp') {
                    return {
                        address,
                        opcode: 'INC',
                        operands: ['SP'],
                        machineCode: [0x44],
                        length: 1,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['AX'],
                        machineCode: [0x48],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bl') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['BL'],
                        machineCode: [0xfe, 0xcb],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['BX'],
                        machineCode: [0x4b],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['CL'],
                        machineCode: [0xfe, 0xc9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['CX'],
                        machineCode: [0x49],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['DL'],
                        machineCode: [0xfe, 0xca],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['DX'],
                        machineCode: [0x4a],
                        length: 1,
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
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'di') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['DI'],
                        machineCode: [0x4f],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bp') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['BP'],
                        machineCode: [0x4d],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'sp') {
                    return {
                        address,
                        opcode: 'DEC',
                        operands: ['SP'],
                        machineCode: [0x4c],
                        length: 1,
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
                        length: 2,
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
                        length: 3,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['BX'],
                        machineCode: [0xf7, 0xe3],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['CL'],
                        machineCode: [0xf6, 0xe1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['CX'],
                        machineCode: [0xf7, 0xe1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['DL'],
                        machineCode: [0xf6, 0xe2],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['DX'],
                        machineCode: [0xf7, 0xe2],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ah') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['AH'],
                        machineCode: [0xf6, 0xe4],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ch') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['CH'],
                        machineCode: [0xf6, 0xe5],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dh') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['DH'],
                        machineCode: [0xf6, 0xe6],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bh') {
                    return {
                        address,
                        opcode: 'MUL',
                        operands: ['BH'],
                        machineCode: [0xf6, 0xe7],
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'IMUL',
                        operands: ['BX'],
                        machineCode: [0xf7, 0xeb],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'IMUL',
                        operands: ['CL'],
                        machineCode: [0xf6, 0xe9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'IMUL',
                        operands: ['CX'],
                        machineCode: [0xf7, 0xe9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'IMUL',
                        operands: ['DL'],
                        machineCode: [0xf6, 0xea],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'IMUL',
                        operands: ['DX'],
                        machineCode: [0xf7, 0xea],
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'DIV',
                        operands: ['BX'],
                        machineCode: [0xf7, 0xf3],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'DIV',
                        operands: ['CL'],
                        machineCode: [0xf6, 0xf1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'DIV',
                        operands: ['CX'],
                        machineCode: [0xf7, 0xf1],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'DIV',
                        operands: ['DL'],
                        machineCode: [0xf6, 0xf2],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'DIV',
                        operands: ['DX'],
                        machineCode: [0xf7, 0xf2],
                        length: 2,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx') {
                    return {
                        address,
                        opcode: 'IDIV',
                        operands: ['BX'],
                        machineCode: [0xf7, 0xfb],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cl') {
                    return {
                        address,
                        opcode: 'IDIV',
                        operands: ['CL'],
                        machineCode: [0xf6, 0xf9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx') {
                    return {
                        address,
                        opcode: 'IDIV',
                        operands: ['CX'],
                        machineCode: [0xf7, 0xf9],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dl') {
                    return {
                        address,
                        opcode: 'IDIV',
                        operands: ['DL'],
                        machineCode: [0xf6, 0xfa],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx') {
                    return {
                        address,
                        opcode: 'IDIV',
                        operands: ['DX'],
                        machineCode: [0xf7, 0xfa],
                        length: 2,
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
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'aas':
                return {
                    address,
                    opcode: 'AAS',
                    operands: [],
                    machineCode: [0x3f],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'daa':
                return {
                    address,
                    opcode: 'DAA',
                    operands: [],
                    machineCode: [0x27],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'das':
                return {
                    address,
                    opcode: 'DAS',
                    operands: [],
                    machineCode: [0x2f],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'aam':
                return {
                    address,
                    opcode: 'AAM',
                    operands: [],
                    machineCode: [0xd4, 0x0a],
                    length: 2,
                    originalLine: originalLine.trim()
                };
            case 'aad':
                return {
                    address,
                    opcode: 'AAD',
                    operands: [],
                    machineCode: [0xd5, 0x0a],
                    length: 2,
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
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'ax') {
                        return {
                            address,
                            opcode: 'ROL',
                            operands: ['AX', '1'],
                            machineCode: [0xd1, 0xc0],
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'bl') {
                        return {
                            address,
                            opcode: 'ROL',
                            operands: ['BL', '1'],
                            machineCode: [0xd0, 0xc3],
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'bx') {
                        return {
                            address,
                            opcode: 'ROL',
                            operands: ['BX', '1'],
                            machineCode: [0xd1, 0xc3],
                            length: 2,
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
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'ax') {
                        return {
                            address,
                            opcode: 'ROR',
                            operands: ['AX', '1'],
                            machineCode: [0xd1, 0xc8],
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'bl') {
                        return {
                            address,
                            opcode: 'ROR',
                            operands: ['BL', '1'],
                            machineCode: [0xd0, 0xcb],
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'bx') {
                        return {
                            address,
                            opcode: 'ROR',
                            operands: ['BX', '1'],
                            machineCode: [0xd1, 0xcb],
                            length: 2,
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
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'ax') {
                        return {
                            address,
                            opcode: 'RCL',
                            operands: ['AX', '1'],
                            machineCode: [0xd1, 0xd0],
                            length: 2,
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
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'ax') {
                        return {
                            address,
                            opcode: 'RCR',
                            operands: ['AX', '1'],
                            machineCode: [0xd1, 0xd8],
                            length: 2,
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
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'ax') {
                        return {
                            address,
                            opcode: 'SAR',
                            operands: ['AX', '1'],
                            machineCode: [0xd1, 0xf8],
                            length: 2,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (operands[0] === 'bx') {
                        return {
                            address,
                            opcode: 'SAR',
                            operands: ['BX', '1'],
                            machineCode: [0xd1, 0xfb],
                            length: 2,
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
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'bx' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: ['BX', 'AX'],
                        machineCode: [0x93],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === 'cx') {
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: ['AX', 'CX'],
                        machineCode: [0x91],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'cx' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: ['CX', 'AX'],
                        machineCode: [0x91],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'ax' && operands[1] === 'dx') {
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: ['AX', 'DX'],
                        machineCode: [0x92],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                if (operands[0] === 'dx' && operands[1] === 'ax') {
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: ['DX', 'AX'],
                        machineCode: [0x92],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                }
                break;
            case 'stc':
                return {
                    address,
                    opcode: 'STC',
                    operands: [],
                    machineCode: [0xf9],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'clc':
                return {
                    address,
                    opcode: 'CLC',
                    operands: [],
                    machineCode: [0xf8],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'cmc':
                return {
                    address,
                    opcode: 'CMC',
                    operands: [],
                    machineCode: [0xf5],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'std':
                return {
                    address,
                    opcode: 'STD',
                    operands: [],
                    machineCode: [0xfd],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'cld':
                return {
                    address,
                    opcode: 'CLD',
                    operands: [],
                    machineCode: [0xfc],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'sti':
                return {
                    address,
                    opcode: 'STI',
                    operands: [],
                    machineCode: [0xfb],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'cli':
                return {
                    address,
                    opcode: 'CLI',
                    operands: [],
                    machineCode: [0xfa],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'hlt':
                return {
                    address,
                    opcode: 'HLT',
                    operands: [],
                    machineCode: [0xf4],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'nop':
                return {
                    address,
                    opcode: 'NOP',
                    operands: [],
                    machineCode: [0x90],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'jc':
            case 'jb':
            case 'jnae':
                if (operands.length === 1) {
                    const targetAddress = this.parseImmediate(operands[0]);
                    const offset = targetAddress - (address + 2);
                    const offset8 = offset & 0xff;
                    return {
                        address,
                        opcode: opcode === 'jc' ? 'JC' : (opcode === 'jb' ? 'JB' : 'JNAE'),
                        operands: [operands[0]],
                        machineCode: [0x72, offset8],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                break;
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'iret':
                return {
                    address,
                    opcode: 'IRET',
                    operands: [],
                    machineCode: [0xcf],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'retf':
                return {
                    address,
                    opcode: 'RETF',
                    operands: [],
                    machineCode: [0xcb],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'pushf':
                return {
                    address,
                    opcode: 'PUSHF',
                    operands: [],
                    machineCode: [0x9c],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'popf':
                return {
                    address,
                    opcode: 'POPF',
                    operands: [],
                    machineCode: [0x9d],
                    length: 1,
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
                            length: 4,
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
                            length: 4,
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
                                length: 2,
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
                                length: 2,
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
                            length: 1,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (dest === 'ax' && port === 'dx') {
                        return {
                            address,
                            opcode: 'IN',
                            operands: ['AX', 'DX'],
                            machineCode: [0xed],
                            length: 1,
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
                                length: 2,
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
                                length: 2,
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
                            length: 1,
                            originalLine: originalLine.trim()
                        };
                    }
                    if (port === 'dx' && src === 'ax') {
                        return {
                            address,
                            opcode: 'OUT',
                            operands: ['DX', 'AX'],
                            machineCode: [0xef],
                            length: 1,
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
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'movsw':
                return {
                    address,
                    opcode: 'MOVSW',
                    operands: [],
                    machineCode: [0xa5],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'cmpsb':
                return {
                    address,
                    opcode: 'CMPSB',
                    operands: [],
                    machineCode: [0xa6],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'cmpsw':
                return {
                    address,
                    opcode: 'CMPSW',
                    operands: [],
                    machineCode: [0xa7],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'scasb':
                return {
                    address,
                    opcode: 'SCASB',
                    operands: [],
                    machineCode: [0xae],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'scasw':
                return {
                    address,
                    opcode: 'SCASW',
                    operands: [],
                    machineCode: [0xaf],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'lodsb':
                return {
                    address,
                    opcode: 'LODSB',
                    operands: [],
                    machineCode: [0xac],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'lodsw':
                return {
                    address,
                    opcode: 'LODSW',
                    operands: [],
                    machineCode: [0xad],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'stosb':
                return {
                    address,
                    opcode: 'STOSB',
                    operands: [],
                    machineCode: [0xaa],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'stosw':
                return {
                    address,
                    opcode: 'STOSW',
                    operands: [],
                    machineCode: [0xab],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'rep':
                return {
                    address,
                    opcode: 'REP',
                    operands: [],
                    machineCode: [0xf3],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'repe':
            case 'repz':
                return {
                    address,
                    opcode: opcode === 'repz' ? 'REPZ' : 'REPE',
                    operands: [],
                    machineCode: [0xf3],
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'repne':
            case 'repnz':
                return {
                    address,
                    opcode: opcode === 'repnz' ? 'REPNZ' : 'REPNE',
                    operands: [],
                    machineCode: [0xf2],
                    length: 1,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                    length: 1,
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
                        length: 2,
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
                    length: 1,
                    originalLine: originalLine.trim()
                };
            case 'xlat':
                return {
                    address,
                    opcode: 'XLAT',
                    operands: [],
                    machineCode: [0xd7],
                    length: 1,
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
                        length: 4,
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
                    length: 1,
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
        // 检查是否是标签（大小写不敏感）
        const valueLower = value.toLowerCase();
        for (const key in this.symbols) {
            if (key.toLowerCase() === valueLower) {
                return this.symbols[key];
            }
        }

        // 处理@data符号
        if (valueLower === '@data') {
            // 在8086汇编中，@data代表数据段的段地址
            // 返回DS段寄存器的默认值（2000h）
            return 0x2000;
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
    
    // 将指令写入临时内存区域（用于标签地址计算）
    writeInstructionToMemory(instruction) {
        // 只写入临时区域（从 0 开始），不写入实际段地址
        // 实际段地址将在初始化阶段使用当前 CPU 段寄存器值设置
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

    // 将数据段内容写入DS段
    writeDataSegmentToMemory(cpu) {
        // 获取DS段寄存器值
        const ds = cpu.getSegmentRegister('ds');
        // 计算数据段的实际地址
        const dataSegmentBase = (ds << 4);

        // 写入数据段内容
        for (const data of this.dataSegments) {
            const dataAddress = dataSegmentBase + data.offset;
            for (let i = 0; i < data.data.length; i++) {
                this.memory.write8(dataAddress + i, data.data[i]);
            }
        }
    }

    // 将代码段内容写入CS段
    writeCodeSegmentToMemory(cpu) {
        // 获取CS段寄存器值
        const cs = cpu.getSegmentRegister('cs');
        // 计算代码段的实际地址
        const codeSegmentBase = (cs << 4);

        // 写入代码段内容
        for (const instruction of this.instructions) {
            const codeAddress = codeSegmentBase + instruction.address;
            for (let i = 0; i < instruction.machineCode.length; i++) {
                this.memory.write8(codeAddress + i, instruction.machineCode[i]);
            }
        }
    }
}
