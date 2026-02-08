class Assembler {
    constructor(memory) {
        this.memory = memory;
        this.symbols = {}; // 符号表，用于存储标签和地址
        this.symbolOriginalCase = {}; // 符号表，用于存储标签的原始大小写形式
        this.instructions = []; // 解析后的指令列表
        this.dataSegments = []; // 数据段信息
        this.codePaddings = []; // 存放代码段的对齐填充（如 EVEN 插入的 NOP）
        this.codeDataSegments = []; // 存放代码段中的数据定义（如 ALL_CHARS_MSG DB ...）
        this.equDefinitions = []; // EQU常量定义
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
            // 检查段名是否是 data 或 code
            const parts = lowerLine.split(/\s+/).filter(Boolean);
            const segmentName = parts[0].toLowerCase();
            if (segmentName === 'data') {
                return 'data';
            } else if (segmentName === 'code') {
                return 'code';
            }
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
        } else if (lowerLine.endsWith(' segment')) {
            // 解析传统段定义伪指令，已在 getDirectiveType 中处理段类型切换
            // 这里可以处理段属性（如 PARA, WORD, BYTE 等）
            const parts = lowerLine.split(/\s+/).filter(Boolean);
            const segmentName = parts[0].toLowerCase();
            // 段已通过 getDirectiveType 返回类型并在 parse 中处理
        } else if (lowerLine.endsWith(' ends')) {
            // 解析段结束伪指令
            // 可以在这里处理段结束的逻辑
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
        this.codeDataSegments = []; // 代码段中的数据定义
        this.equDefinitions = [];
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

                // 检查标签后面是否有实际指令（"label: instruction" 格式）
                let hasInstruction = false;
                const colonIndex = line.indexOf(':');
                if (colonIndex < line.length - 1) {
                    const instructionPart = line.substring(colonIndex + 1).trim();
                    if (instructionPart !== '') {
                        hasInstruction = true;
                    }
                }

                if (!hasInstruction) {
                    // 纯标签行：暂时记录为"待确定"，使用特殊标记
                    this.symbols[label] = { type: 'forward', lineIndex: i, initialAddr: address };
                    this.symbolOriginalCase[label.toLowerCase()] = label; // 保存原始大小写
                } else {
                    // "label: instruction" 格式，标签指向当前指令
                    this.symbols[label] = address;
                    this.symbolOriginalCase[label.toLowerCase()] = label; // 保存原始大小写
                }
                continue;
            }

            // 去掉行内注释再小写比较，保证像 "EVEN ; 注释" 也能识别
            const lowerLine = line.split(';')[0].trim().toLowerCase();

            // 检查是否是 EVEN 伪指令（偶地址对齐）- 优先处理
            if (lowerLine === 'even') {
                if (address % 2 !== 0) {
                    // 当前地址是奇数，需要+1对齐到偶地址
                    if (this.currentSegment === 'data') {
                        // 在数据段，添加填充字节
                        this.dataSegments.push({
                            offset: address,
                            data: [0],  // 填充字节
                            label: '',
                            originalLine: '; EVEN alignment padding'
                        });
                    } else if (this.currentSegment === 'code') {
                        // 在代码段，为了保证执行流正确，插入一个 NOP 填充
                        this.codePaddings.push({
                            offset: address,
                            data: [0x90], // NOP
                            originalLine: '; EVEN alignment NOP padding'
                        });
                    }
                    // 无论是数据段还是代码段，地址都+1
                    address++;
                }
                continue;
            }

            // 检查是否是 DB 数据定义
            let dbIndex = lowerLine.indexOf(' db ');
            // 处理行首没有标签的情况，如 "DB 'string'"
            if (dbIndex === -1 && lowerLine.startsWith('db ')) {
                dbIndex = 0;
            }
            if (dbIndex !== -1) {
                // 格式：[label] DB expr1, expr2, ...
                const potentialLabel = line.substring(0, dbIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
                }

                const dataPart = line.substring(dbIndex + 4).trim();
                const data = this.parseDB(dataPart);

                // 如果在代码段，存储到 codeDataSegments
                if (this.currentSegment === 'code') {
                    this.codeDataSegments.push({
                        offset: address,
                        data: data,
                        label: potentialLabel,
                        originalLine: line.trim()
                    });
                }

                address += data.length;
                continue;
            }

            // 检查是否是 DW 数据定义
            let dwIndex = lowerLine.indexOf(' dw ');
            // 处理行首没有标签的情况，如 "DW 1234h"
            if (dwIndex === -1 && lowerLine.startsWith('dw ')) {
                dwIndex = 0;
            }
            if (dwIndex !== -1) {
                // 格式：[label] DW expr1, expr2, ...
                const potentialLabel = line.substring(0, dwIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
                }

                const dataPart = line.substring(dwIndex + 4).trim();
                const data = this.parseDW(dataPart);

                // 如果在代码段，存储到 codeDataSegments
                if (this.currentSegment === 'code') {
                    this.codeDataSegments.push({
                        offset: address,
                        data: data,
                        label: potentialLabel,
                        originalLine: line.trim()
                    });
                }

                address += data.length;
                continue;
            }

            // 检查是否是 DD 数据定义
            let ddIndex = lowerLine.indexOf(' dd ');
            // 处理行首没有标签的情况，如 "DD 12345678h"
            if (ddIndex === -1 && lowerLine.startsWith('dd ')) {
                ddIndex = 0;
            }
            if (ddIndex !== -1) {
                // 格式：[label] DD expr1, expr2, ...
                const potentialLabel = line.substring(0, ddIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
                }

                const dataPart = line.substring(ddIndex + 4).trim();
                const data = this.parseDD(dataPart);

                // 如果在代码段，存储到 codeDataSegments
                if (this.currentSegment === 'code') {
                    this.codeDataSegments.push({
                        offset: address,
                        data: data,
                        label: potentialLabel,
                        originalLine: line.trim()
                    });
                }

                address += data.length;
                continue;
            }

            // 检查是否是 DQ 数据定义（四字，8字节）
            let dqIndex = lowerLine.indexOf(' dq ');
            if (dqIndex === -1 && lowerLine.startsWith('dq ')) {
                dqIndex = 0;
            }
            if (dqIndex !== -1) {
                const potentialLabel = line.substring(0, dqIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
                }

                const dataPart = line.substring(dqIndex + 4).trim();
                const data = this.parseDQ(dataPart);

                // 如果在代码段，存储到 codeDataSegments
                if (this.currentSegment === 'code') {
                    this.codeDataSegments.push({
                        offset: address,
                        data: data,
                        label: potentialLabel,
                        originalLine: line.trim()
                    });
                }

                address += data.length;
                continue;
            }

            // 检查是否是 DT 数据定义（十字节，10字节）
            let dtIndex = lowerLine.indexOf(' dt ');
            if (dtIndex === -1 && lowerLine.startsWith('dt ')) {
                dtIndex = 0;
            }
            if (dtIndex !== -1) {
                const potentialLabel = line.substring(0, dtIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    this.symbols[potentialLabel] = address;
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
                }

                const dataPart = line.substring(dtIndex + 4).trim();
                const data = this.parseDT(dataPart);

                // 如果在代码段，存储到 codeDataSegments
                if (this.currentSegment === 'code') {
                    this.codeDataSegments.push({
                        offset: address,
                        data: data,
                        label: potentialLabel,
                        originalLine: line.trim()
                    });
                }

                address += data.length;
                continue;
            }

            // 检查是否是 ORG 伪指令（设置位置计数器）
            if (lowerLine.startsWith('org ')) {
                const orgValue = line.substring(4).trim();
                const newAddress = this.parseImmediate(orgValue);
                if (!isNaN(newAddress)) {
                    address = newAddress;
                }
                continue;
            }

            // 检查是否是 LABEL 伪指令
            // 格式：名称 LABEL 类型
            const labelMatch = line.match(/^(\w+)\s+label\s+(byte|word|dword|qword|tbyte|near|far)/i);
            if (labelMatch) {
                const labelName = labelMatch[1];
                this.symbols[labelName] = address;
                this.symbolOriginalCase[labelName.toLowerCase()] = labelName; // 保存原始大小写
                continue;
            }

            // 检查是否是 = (等号赋值) 伪指令
            // 格式：符号 = 表达式
            const equalMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
            if (equalMatch && !line.toLowerCase().includes(' equ ')) {
                const label = equalMatch[1].trim();
                const valuePart = equalMatch[2].trim();
                const value = this.parseImmediate(valuePart);
                this.symbols[label] = value;
                this.symbolOriginalCase[label.toLowerCase()] = label; // 保存原始大小写
                // = 可以重新定义，所以不需要检查是否已存在
                this.equDefinitions.push({
                    label: label,
                    value: value,
                    originalLine: line.trim()
                });
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
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
                    // 保存EQU定义信息
                    this.equDefinitions.push({
                        label: potentialLabel,
                        value: value,
                        originalLine: line.trim()
                    });
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
                    this.symbolOriginalCase[potentialLabel.toLowerCase()] = potentialLabel; // 保存原始大小写
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

            address += this.getInstructionLength(line);
        }

        // 第一遍结束后，重新计算纯标签行的地址
        // 收集所有指令的地址映射
        const lineAddresses = {};
        address = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '' || line.startsWith(';')) {
                continue;
            }

            const directiveType = this.getDirectiveType(line);
            if (directiveType) {
                if (directiveType === 'data' || directiveType === 'code') {
                    address = 0;
                }
                continue;
            }

            if (line.endsWith(':')) {
                // 检查是否是纯标签行
                let hasInstruction = false;
                const colonIndex = line.indexOf(':');
                if (colonIndex < line.length - 1) {
                    const instructionPart = line.substring(colonIndex + 1).trim();
                    if (instructionPart !== '') {
                        hasInstruction = true;
                    }
                }

                if (!hasInstruction) {
                    // 纯标签行：记录下一条指令的地址（当前address就是下一条指令的地址）
                    lineAddresses[i] = address;
                }
                continue;
            }

            // 跳过 PROC 和 ENDP 伪指令
            const parts = line.split(/\s+/).filter(Boolean);
            const firstWord = parts.length > 0 ? parts[0].toLowerCase() : '';
            const secondWord = parts.length > 1 ? parts[1].toLowerCase() : '';
            if (firstWord === 'proc' || secondWord === 'proc' ||
                firstWord === 'endp' || secondWord === 'endp') {
                continue;
            }

            // 跳过 EQU 常量定义
            if (line.toLowerCase().includes(' equ ')) {
                continue;
            }

            // 跳过等号赋值
            const equalMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
            if (equalMatch && !line.toLowerCase().includes(' equ ')) {
                continue;
            }

            // 记录这条指令的地址
            lineAddresses[i] = address;

            address += this.getInstructionLength(line);
        }

        // 更新纯标签行的地址为下一条指令的地址
        for (const label in this.symbols) {
            if (typeof this.symbols[label] === 'object' && this.symbols[label].type === 'forward') {
                const lineIndex = this.symbols[label].lineIndex;
                // 查找下一条指令的地址（跳过标签行本身）
                let foundAddr = undefined;
                for (let i = lineIndex + 1; i < lines.length; i++) {
                    const nextLine = lines[i].trim();
                    // 跳过空行和注释
                    if (nextLine === '' || nextLine.startsWith(';')) {
                        continue;
                    }
                    // 跳过纯标签行
                    if (nextLine.endsWith(':')) {
                        const colonIndex = nextLine.indexOf(':');
                        const instructionPart = nextLine.substring(colonIndex + 1).trim();
                        if (instructionPart === '') {
                            continue; // 纯标签行，继续查找
                        }
                    }
                    // 找到真正的指令行
                    if (lineAddresses[i] !== undefined) {
                        foundAddr = lineAddresses[i];
                        break;
                    }
                }
                if (foundAddr !== undefined) {
                    this.symbols[label] = foundAddr;
                    // 保留原始大小写信息，如果不存在的话
                    if (!this.symbolOriginalCase[label.toLowerCase()]) {
                        this.symbolOriginalCase[label.toLowerCase()] = label; // 保存原始大小写
                    }
                }
            }
        }

        // 第二遍：解析指令并生成机器码
        address = 0;
        // 清除之前的代码填充（将由第一遍重新填充）
        this.codePaddings = this.codePaddings || [];
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

            // 检查是否是 DB 数据定义（只在数据段处理）
            // 去掉行内注释再小写比较，保证像 "EVEN ; 注释" 也能识别
            const lowerLine2 = line.split(';')[0].trim().toLowerCase();
            let dbIndex = lowerLine2.indexOf(' db ');
            // 处理行首没有标签的情况，如 "DB 'string'"
            if (dbIndex === -1 && lowerLine2.startsWith('db ')) {
                dbIndex = 0;
            }
            if (dbIndex !== -1 && this.currentSegment === 'data') {
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
                    label: label,
                    originalLine: line.trim()
                });

                address += data.length;
                continue;
            }

            // 检查是否是 DW 数据定义（只在数据段处理）
            let dwIndex = lowerLine2.indexOf(' dw ');
            // 处理行首没有标签的情况，如 "DW 1234h"
            if (dwIndex === -1 && lowerLine2.startsWith('dw ')) {
                dwIndex = 0;
            }
            if (dwIndex !== -1 && this.currentSegment === 'data') {
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
                    label: label,
                    originalLine: line.trim()
                });

                address += data.length;
                continue;
            }

            // 检查是否是 DD 数据定义（只在数据段处理）
            let ddIndex = lowerLine2.indexOf(' dd ');
            // 处理行首没有标签的情况，如 "DD 12345678h"
            if (ddIndex === -1 && lowerLine2.startsWith('dd ')) {
                ddIndex = 0;
            }
            if (ddIndex !== -1 && this.currentSegment === 'data') {
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
                    label: label,
                    originalLine: line.trim()
                });

                address += data.length;
                continue;
            }

            // 检查是否是 DQ 数据定义（只在数据段处理）
            let dqIndex = lowerLine2.indexOf(' dq ');
            if (dqIndex === -1 && lowerLine2.startsWith('dq ')) {
                dqIndex = 0;
            }
            if (dqIndex !== -1 && this.currentSegment === 'data') {
                const dataPart = line.substring(dqIndex + 4).trim();
                const data = this.parseDQ(dataPart);

                let label = '';
                if (dqIndex > 0) {
                    const potentialLabel = line.substring(0, dqIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        label = potentialLabel;
                    }
                }

                this.dataSegments.push({
                    offset: address,
                    data: data,
                    label: label,
                    originalLine: line.trim()
                });

                address += data.length;
                continue;
            }

            // 检查是否是 DT 数据定义（只在数据段处理）
            let dtIndex = lowerLine2.indexOf(' dt ');
            if (dtIndex === -1 && lowerLine2.startsWith('dt ')) {
                dtIndex = 0;
            }
            if (dtIndex !== -1 && this.currentSegment === 'data') {
                const dataPart = line.substring(dtIndex + 4).trim();
                const data = this.parseDT(dataPart);

                let label = '';
                if (dtIndex > 0) {
                    const potentialLabel = line.substring(0, dtIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        label = potentialLabel;
                    }
                }

                this.dataSegments.push({
                    offset: address,
                    data: data,
                    label: label,
                    originalLine: line.trim()
                });

                address += data.length;
                continue;
            }

            // 检查是否是 ORG 伪指令
            if (lowerLine2.startsWith('org ')) {
                const orgValue = line.substring(4).trim();
                const newAddress = this.parseImmediate(orgValue);
                if (!isNaN(newAddress)) {
                    address = newAddress;
                }
                continue;
            }

            // 检查是否是 EVEN 伪指令
            if (lowerLine2 === 'even') {
                if (address % 2 !== 0) {
                    // 当前地址是奇数，地址+1对齐到偶地址
                    if (this.currentSegment === 'code') {
                        // 在代码段，插入一个 NOP 指令到指令列表，带注释说明用于 EVEN
                        const nopInstr = {
                            address: address,
                            opcode: 'NOP',
                            operands: [],
                            machineCode: [0x90],
                            length: 1,
                            originalLine: 'NOP ; EVEN alignment padding'
                        };
                        this.instructions.push(nopInstr);
                        // 写入内存（临时区域），使第一遍/第二遍一致
                        this.writeInstructionToMemory(nopInstr);
                    }
                    // 数据段的填充已经在第一遍添加到 dataSegments 中
                    address++;
                }
                continue; // 跳过，不生成其他指令
            }

            // 检查是否是 LABEL 伪指令（第二遍跳过，已在第一遍处理）
            const labelMatch2 = line.match(/^(\w+)\s+label\s+(byte|word|dword|qword|tbyte|near|far)/i);
            if (labelMatch2) {
                continue;
            }

            // 检查是否是 = (等号赋值) 伪指令（第二遍跳过，已在第一遍处理）
            const equalMatch2 = line.match(/^(\w+)\s*=\s*(.+)$/);
            if (equalMatch2 && !line.toLowerCase().includes(' equ ')) {
                continue;
            }

            // 检查是否是 EQU 常量定义（第二遍跳过，已在第一遍处理）
            const equIndex = line.toLowerCase().indexOf(' equ ');
            if (equIndex !== -1 && equIndex > 0) {
                continue; // EQU已在第一遍处理，不占用空间
            }

            // 在代码段中，跳过数据定义（它们已经在第一遍扫描时处理并写入数据段）
            if (this.currentSegment === 'code') {
                const lowerLineForData = lowerLine2;
                // 检查是否是数据定义
                const isDataDef = lowerLineForData.includes(' db ') ||
                                  lowerLineForData.startsWith('db ') ||
                                  lowerLineForData.includes(' dw ') ||
                                  lowerLineForData.startsWith('dw ') ||
                                  lowerLineForData.includes(' dd ') ||
                                  lowerLineForData.startsWith('dd ') ||
                                  lowerLineForData.includes(' dq ') ||
                                  lowerLineForData.startsWith('dq ') ||
                                  lowerLineForData.includes(' dt ') ||
                                  lowerLineForData.startsWith('dt ');
                if (isDataDef) {
                    // 跳过数据定义，但更新地址
                    const dataLen = this.getInstructionLength(line);
                    address += dataLen;
                    continue;
                }
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

        // 在所有指令处理完成后，修正跳转指令的偏移量
        this.fixJumpOffsets();

        return this.instructions;
    }

    // 修正跳转指令的偏移量
    fixJumpOffsets() {
        for (let i = 0; i < this.instructions.length; i++) {
            const instr = this.instructions[i];
            if (instr.opcode &&
                ['JMP', 'JZ', 'JE', 'JNZ', 'JNE', 'JB', 'JC', 'JNAE', 'JNB', 'JAE', 'JNC',
                 'JS', 'JNS', 'JO', 'JNO', 'JP', 'JPE', 'JNP', 'JPO', 'JL', 'JNGE', 'JNL',
                 'JGE', 'JA', 'JNBE', 'JNA', 'JBE', 'JG', 'JNLE', 'JNG', 'JLE', 'LOOP',
                 'LOOPE', 'LOOPZ', 'LOOPNE', 'LOOPNZ', 'JCXZ'].includes(instr.opcode)) {

                // 检查操作数是否是标签
                if (instr.operands && instr.operands.length > 0) {
                    const targetLabel = instr.operands[0]; // 跳转目标
                    // 如果目标是标签而不是立即数，重新计算偏移量
                    if (typeof targetLabel === 'string' && this.symbols[targetLabel.toUpperCase()]) {
                        const targetAddr = this.symbols[targetLabel.toUpperCase()];
                        let newOffset;

                        if (instr.opcode === 'JMP' && instr.length === 2) {
                            // JMP short
                            newOffset = targetAddr - (instr.address + 2);
                            instr.machineCode[1] = newOffset & 0xff;
                        } else if (instr.opcode === 'JMP' && instr.length === 3) {
                            // JMP near
                            newOffset = targetAddr - (instr.address + 3);
                            instr.machineCode[1] = newOffset & 0xff;
                            instr.machineCode[2] = (newOffset >> 8) & 0xff;
                        } else if (instr.length === 2 && instr.machineCode[0] >= 0x70 && instr.machineCode[0] <= 0x7F) {
                            // 条件跳转 short (0x70-0x7F)
                            newOffset = targetAddr - (instr.address + 2);
                            instr.machineCode[1] = newOffset & 0xff;
                        }
                    }
                }
            }
        }
    }

    // 获取指令的真实长度
    getInstructionLength(line) {
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
                    // 立即数操作：一律使用16位立即数长度
                    if (operands[0].includes('[')) {
                        // 内存寻址 + 立即数：最坏情况6字节
                        return 6;
                    } else if (!['ax', 'bx', 'cx', 'dx', 'si', 'di', 'al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'].includes(operands[0])) {
                        // 标签 + 立即数：最坏情况6字节
                        return 6;
                    } else if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp'].includes(operands[0])) {
                        // 16位寄存器 + 立即数：3字节
                        return 3;
                    } else {
                        // 8位寄存器 + 立即数：2字节
                        return 2;
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

    // 解析 DQ 数据定义（四字，8字节）
    parseDQ(dataPart) {
        const result = [];
        const dataWithoutComment = dataPart.split(';')[0].trim();
        const values = [];
        let currentValue = '';

        for (let i = 0; i < dataWithoutComment.length; i++) {
            const char = dataWithoutComment[i];
            if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        if (currentValue.trim() !== '') {
            values.push(currentValue.trim());
        }

        for (const value of values) {
            const trimmedValue = value.trim();

            // 检查是否是64位十六进制值（需要特殊处理，因为JS的number无法精确表示）
            let hexStr = null;
            if (trimmedValue.startsWith('0x') || trimmedValue.startsWith('0X')) {
                hexStr = trimmedValue.substring(2);
            } else if (trimmedValue.endsWith('h') || trimmedValue.endsWith('H')) {
                hexStr = trimmedValue.slice(0, -1);
            }

            if (hexStr && hexStr.length > 8) {
                // 64位十六进制值，手动解析为高32位和低32位
                // 补齐到16个字符
                hexStr = hexStr.padStart(16, '0');
                const lowStr = hexStr.substring(8, 16);   // 低8位字符
                const highStr = hexStr.substring(0, 8);   // 高8位字符

                const low = parseInt(lowStr, 16) || 0;
                const high = parseInt(highStr, 16) || 0;

                // 小端序输出：低字节在前
                // 低32位（4字节）
                result.push((low >> 0) & 0xff);
                result.push((low >> 8) & 0xff);
                result.push((low >> 16) & 0xff);
                result.push((low >> 24) & 0xff);
                // 高32位（4字节）
                result.push((high >> 0) & 0xff);
                result.push((high >> 8) & 0xff);
                result.push((high >> 16) & 0xff);
                result.push((high >> 24) & 0xff);
            } else {
                // 普通值，使用parseImmediate
                const parsedValue = this.parseImmediate(trimmedValue);
                // 小端序，低字节在前
                for (let i = 0; i < 8; i++) {
                    result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> (i * 8)) & 0xff));
                }
            }
        }
        return result;
    }

    // 解析 DT 数据定义（十字节，10字节）
    parseDT(dataPart) {
        const result = [];
        const dataWithoutComment = dataPart.split(';')[0].trim();
        const values = [];
        let currentValue = '';

        for (let i = 0; i < dataWithoutComment.length; i++) {
            const char = dataWithoutComment[i];
            if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        if (currentValue.trim() !== '') {
            values.push(currentValue.trim());
        }

        for (const value of values) {
            const parsedValue = this.parseImmediate(value);
            // 小端序，低字节在前（10字节）
            for (let i = 0; i < 10; i++) {
                result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> (i * 8)) & 0xff));
            }
        }
        return result;
    }

    // 解析单个指令
    parseInstruction(line, address) {
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
                            length: 2,
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
                            length: 3,
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
                        length: 3,
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
                            length: 2,
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
                            length: 3,
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
                        length: 3,
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
                        length: 4,
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
                if (operands[0] === 'ax' && operands[1] === 'ax') {
                    // XOR AX, AX - 清零寄存器，使用2字节编码
                    return {
                        address,
                        opcode: 'XOR',
                        operands: ['AX', 'AX'],
                        machineCode: [0x31, 0xc0],
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
                if (operands[0] === 'cx' && operands[1] === 'cx') {
                    // XOR CX, CX - 清零寄存器
                    return {
                        address,
                        opcode: 'XOR',
                        operands: ['CX', 'CX'],
                        machineCode: [0x31, 0xc9],
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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

                // 内存到16位寄存器: MOV reg16, [mem]
                if (memOp1 && !memOp0) {
                    const reg16Map = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
                    const reg8Map = { 'al': 0, 'cl': 1, 'dl': 2, 'bl': 3, 'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7 };

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
                    const imm16 = this.parseImmediate(originalOperands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['AX', originalOperands[1]],
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
                    const imm16 = this.parseImmediate(originalOperands[1]);
                    return {
                        address,
                        opcode: 'MOV',
                        operands: ['BX', originalOperands[1]],
                        machineCode: [0xbb, imm16 & 0xff, (imm16 >> 8) & 0xff],
                        length: 3,
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
                        length: 3,
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
                        length: 3,
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
                        length: 3,
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
                        length: 3,
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
                        length: 3,
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
                        length: 3,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                        length: 2,
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
                if (operands.length === 0) {
                    // RET (近返回) - 1字节
                    return {
                        address,
                        opcode: 'RET',
                        operands: [],
                        machineCode: [0xc3],
                        length: 1,
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
                        length: 3,
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
                            length: 2,
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
                            length: 2,
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
                            length: 2,
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
                            length: 2,
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
                } else if (operands[0] === 'si') {
                    return {
                        address,
                        opcode: 'PUSH',
                        operands: ['SI'],
                        machineCode: [0x56],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'di') {
                    return {
                        address,
                        opcode: 'PUSH',
                        operands: ['DI'],
                        machineCode: [0x57],
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
                } else if (operands[0] === 'si') {
                    return {
                        address,
                        opcode: 'POP',
                        operands: ['SI'],
                        machineCode: [0x5e],
                        length: 1,
                        originalLine: originalLine.trim()
                    };
                } else if (operands[0] === 'di') {
                    return {
                        address,
                        opcode: 'POP',
                        operands: ['DI'],
                        machineCode: [0x5f],
                        length: 1,
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
                            length: 2,
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
                            length: 3,
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
                        length: 3,
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
                        length: 2,
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
                        length: 2,
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
                        length: 3,
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
                        length: 5,
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
                        length: 3,
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
                        length: 2,
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
                        length: 5,
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
                // 通用寄存器-寄存器 XCHG (16位) - 使用 0x87 指令
                const reg16MapXchg = { 'ax': 0, 'cx': 1, 'dx': 2, 'bx': 3, 'sp': 4, 'bp': 5, 'si': 6, 'di': 7 };
                if (reg16MapXchg.hasOwnProperty(operands[0]) && reg16MapXchg.hasOwnProperty(operands[1])) {
                    const reg1 = reg16MapXchg[operands[0]];
                    const reg2 = reg16MapXchg[operands[1]];
                    // 0x87: XCHG r/m16, r16
                    // ModR/M: mod=11(寄存器), reg=reg1, rm=reg2
                    const modRM = (3 << 6) | (reg1 << 3) | reg2;
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode: [0x87, modRM],
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
                // 通用寄存器-寄存器 XCHG (8位) - 使用 0x86 指令
                const reg8MapXchg = { 'al': 0, 'cl': 1, 'dl': 2, 'bl': 3, 'ah': 4, 'ch': 5, 'dh': 6, 'bh': 7 };
                if (reg8MapXchg.hasOwnProperty(operands[0]) && reg8MapXchg.hasOwnProperty(operands[1])) {
                    const reg1 = reg8MapXchg[operands[0]];
                    const reg2 = reg8MapXchg[operands[1]];
                    // 0x86: XCHG r/m8, r8
                    // ModR/M: mod=11(寄存器), reg=reg1, rm=reg2
                    const modRM = (3 << 6) | (reg1 << 3) | reg2;
                    return {
                        address,
                        opcode: 'XCHG',
                        operands: [operands[0].toUpperCase(), operands[1].toUpperCase()],
                        machineCode: [0x86, modRM],
                        length: 2,
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
                if (operands.length === 0) {
                    // RETF (远返回) - 1字节
                    return {
                        address,
                        opcode: 'RETF',
                        operands: [],
                        machineCode: [0xcb],
                        length: 1,
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
                        length: 3,
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
                        length: 2,
                        originalLine: originalLine.trim()
                    };
                }
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
        // 处理字符字面量 'X' 或 "X"
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
            const char = value.slice(1, -1);
            if (char.length > 0) {
                return char.charCodeAt(0);
            }
        }

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
            const parsed = parseInt(value, 10);
            if (isNaN(parsed)) {
                // 如果不是数字，可能是未定义的标签，返回0作为占位符
                // 在第二遍扫描时会重新解析
                return 0;
            }
            return parsed;
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

    // 解析内存操作数，返回 {mod, rm, disp, hasLabel, labelName}
    // 支持格式: [bx], [bp], [si], [di], [bx+si], [bx+di], [bp+si], [bp+di]
    //          [bx+disp], [bp+disp], [si+disp], [di+disp]
    //          [bx+si+disp], [bx+di+disp], [bp+si+disp], [bp+di+disp]
    parseMemoryOperand(operand) {
        if (!operand.startsWith('[') || !operand.endsWith(']')) {
            return null;
        }

        const content = operand.substring(1, operand.length - 1).toLowerCase().trim();

        // 定义有效的寄存器组合及其编码
        const validCombos = {
            'bx+si': { mod: 0, rm: 0 },
            'bx+di': { mod: 0, rm: 1 },
            'bp+si': { mod: 0, rm: 2 },
            'bp+di': { mod: 0, rm: 3 },
            'si': { mod: 0, rm: 4 },
            'di': { mod: 0, rm: 5 },
            'bp': { mod: 0, rm: 6 },
            'bx': { mod: 0, rm: 7 },
        };

        // 先检查是否是纯寄存器（无偏移量）
        if (validCombos[content]) {
            return {
                mod: validCombos[content].mod,
                rm: validCombos[content].rm,
                disp: 0,
                dispSize: 0,
                hasLabel: false,
                labelName: null
            };
        }

        // 解析带偏移量的格式
        // 尝试匹配: reg+disp, reg-disp, reg+label, reg-label
        const plusMatch = content.match(/^(.+?)\+(.+)$/);
        const minusMatch = content.match(/^(.+?)\-(.+)$/);

        if (plusMatch || minusMatch) {
            const match = plusMatch || minusMatch;
            const regPart = match[1].trim();
            const dispPart = match[2].trim();
            const isNegative = !!minusMatch;

            // 检查是否是有效的寄存器组合
            if (validCombos[regPart]) {
                // 检查偏移量是否是数字
                const dispValue = this.parseImmediate(dispPart);
                if (!isNaN(dispValue)) {
                    // 数字偏移量
                    const absDisp = isNegative ? -dispValue : dispValue;
                    const disp8 = absDisp >= -128 && absDisp <= 127;
                    return {
                        mod: disp8 ? 1 : 2,
                        rm: validCombos[regPart].rm,
                        disp: absDisp & 0xFFFF,
                        dispSize: disp8 ? 1 : 2,
                        hasLabel: false,
                        labelName: null
                    };
                } else {
                    // 可能是标签
                    return {
                        mod: 2, // 16位位移
                        rm: validCombos[regPart].rm,
                        disp: 0,
                        dispSize: 2,
                        hasLabel: true,
                        labelName: dispPart
                    };
                }
            }

            // 检查是否是基址+变址+偏移量格式
            for (const combo in validCombos) {
                if (combo.includes('+') && regPart === combo) {
                    const dispValue = this.parseImmediate(dispPart);
                    if (!isNaN(dispValue)) {
                        const absDisp = isNegative ? -dispValue : dispValue;
                        const disp8 = absDisp >= -128 && absDisp <= 127;
                        return {
                            mod: disp8 ? 1 : 2,
                            rm: validCombos[combo].rm,
                            disp: absDisp & 0xFFFF,
                            dispSize: disp8 ? 1 : 2,
                            hasLabel: false,
                            labelName: null
                        };
                    } else {
                        return {
                            mod: 2,
                            rm: validCombos[combo].rm,
                            disp: 0,
                            dispSize: 2,
                            hasLabel: true,
                            labelName: dispPart
                        };
                    }
                }
            }
        }

        // 检查是否是纯数字（直接内存寻址）
        const directAddr = this.parseImmediate(content);
        if (!isNaN(directAddr)) {
            return {
                mod: 0,
                rm: 6, // 直接寻址使用BP的编码
                disp: directAddr & 0xFFFF,
                dispSize: 2,
                hasLabel: false,
                labelName: null,
                isDirect: true
            };
        }

        // 检查是否是纯标签直接寻址（必须在[label+disp]之前，避免[bx+si]被误判）
        if (content.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
            return {
                mod: 0,
                rm: 6,
                disp: 0,
                dispSize: 2,
                hasLabel: true,
                labelName: content,
                isDirect: true
            };
        }

        // 检查是否是 [label+disp] 或 [label-disp] 格式（直接内存寻址带偏移量）
        // 注意：这里需要确保disp部分是数字，而不是寄存器名
        const labelPlusMatch = content.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([\+\-])\s*(.+)$/);
        if (labelPlusMatch) {
            const labelName = labelPlusMatch[1];
            const operator = labelPlusMatch[2];
            const dispStr = labelPlusMatch[3];

            // 检查labelName不是寄存器名，且dispStr是数字
            const validRegs = ['bx', 'si', 'di', 'bp', 'ax', 'cx', 'dx', 'sp',
                               'al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'];
            if (!validRegs.includes(labelName)) {
                const dispValue = this.parseImmediate(dispStr);

                if (!isNaN(dispValue)) {
                    const finalDisp = operator === '-' ? -dispValue : dispValue;
                    return {
                        mod: 0,
                        rm: 6,
                        disp: finalDisp & 0xFFFF,
                        dispSize: 2,
                        hasLabel: true,
                        labelName: labelName,
                        isDirect: true
                    };
                }
            }
        }

        return null;
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

        // 写入代码段中的数据定义（如 ALL_CHARS_MSG DB ...）
        for (const data of this.codeDataSegments) {
            const dataAddress = codeSegmentBase + data.offset;
            for (let i = 0; i < data.data.length; i++) {
                this.memory.write8(dataAddress + i, data.data[i]);
            }
        }
    }
}
