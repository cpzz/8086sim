// Assembler 类定义
class Assembler {
    constructor(memory) {
        this.memory = memory;
        this.symbols = {};
        this.symbolOriginalCase = {};
        this.instructions = [];
        this.dataSegments = [];
        this.codePaddings = [];
        this.codeDataSegments = [];
        this.equDefinitions = [];
        this.dataVariables = [];
        this.currentSegment = 'code';
        this.model = 'small';
        this.stackSize = 256;
        this.entryPoint = null;
        this.originalLines = [];
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
        this.originalLines = code.split('\n'); // 存储原始代码行

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
                    // 如果在数据段，记录变量名
                    if (this.currentSegment === 'data') {
                        this.dataVariables.push(potentialLabel);
                    }
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
                    // 如果在数据段，记录变量名
                    if (this.currentSegment === 'data') {
                        this.dataVariables.push(potentialLabel);
                    }
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
                    // 如果在数据段，记录变量名
                    if (this.currentSegment === 'data') {
                        this.dataVariables.push(potentialLabel);
                    }
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
            // PROC 语义上等同于纯标签，应该指向下一条指令的地址
            const procMatch = line.toLowerCase().match(/\bproc\b/i);
            if (procMatch && procMatch.index > 0) {
                const procIndex = procMatch.index;
                // 提取标签名称
                const potentialLabel = line.substring(0, procIndex).trim();
                if (potentialLabel && !potentialLabel.startsWith(';')) {
                    // PROC标签和纯标签一样，记录为 forward，等待后续地址修正
                    this.symbols[potentialLabel] = { type: 'forward', lineIndex: i, initialAddr: address };
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

            // 检查是否是纯标签行（冒号结尾，且后面没有指令）
            if (line.endsWith(':')) {
                const colonIndex = line.indexOf(':');
                const instructionPart = line.substring(colonIndex + 1).trim();
                if (instructionPart === '') {
                    // 纯标签行：记录当前地址，不增加地址
                    lineAddresses[i] = address;
                    continue;
                }
            }

            // 处理 EVEN 伪指令 - 需要根据当前地址对齐
            const lowerLineForEven = line.split(';')[0].trim().toLowerCase();
            if (lowerLineForEven === 'even') {
                if (address % 2 !== 0) {
                    address++; // 对齐到偶地址
                }
                continue;
            }

            // 处理 ORG 伪指令 - 设置新地址
            if (lowerLineForEven.startsWith('org ')) {
                const orgValue = line.substring(4).trim();
                const newAddress = this.parseImmediate(orgValue);
                if (!isNaN(newAddress)) {
                    address = newAddress;
                }
                continue;
            }

            // 所有其他指令（包括伪指令）都统一处理：
            // 记录地址，然后根据 getInstructionLength() 增加地址
            lineAddresses[i] = address;
            const instrLen = this.getInstructionLength(line);
            address += instrLen;
        }

        // 更新纯标签行的地址为下一条指令的地址
        for (const label in this.symbols) {
            if (typeof this.symbols[label] === 'object' && this.symbols[label].type === 'forward') {
                const lineIndex = this.symbols[label].lineIndex;
                // 查找下一条指令的地址（跳过标签行本身和伪指令行）
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
                    // 跳过伪指令行（PROC、ENDP、EQU、LABEL、等号赋值）
                    const lowerNextLine = nextLine.toLowerCase();
                    if (/\bproc\b/i.test(nextLine) || /\bendp\b/i.test(nextLine)) {
                        continue;
                    }
                    if (/^\w+\s+label\s+(byte|word|dword|qword|tbyte|near|far)/i.test(nextLine)) {
                        continue;
                    }
                    if (lowerNextLine.includes(' equ ')) {
                        continue;
                    }
                    if (/^\w+\s*=\s*.+$/.test(nextLine)) {
                        continue;
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
                } else {
                    console.warn(`[地址修正警告] ${label} 未找到下一条指令地址`);
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
                // 跳过标签行（不生成机器码）
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
                continue;
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

            // 解析指令（包括 PROC、ENDP、EQU、LABEL 等伪指令）
            // parseInstruction 会返回 null 对于不生成机器码的伪指令
            const instruction = this.parseInstruction(line, address);
            if (instruction) {
                instruction.lineIndex = i;
                this.instructions.push(instruction);
                // 写入内存
                this.writeInstructionToMemory(instruction);
                address += instruction.length;
            } else {
                // 对于不生成机器码的伪指令
                const len = this.getInstructionLength(line);

                // PROC 伪指令：更新 symbols 表中的地址
                const procMatch = line.toLowerCase().match(/\bproc\b/i);
                if (procMatch && procMatch.index > 0) {
                    const procIndex = procMatch.index;
                    const potentialLabel = line.substring(0, procIndex).trim();
                    if (potentialLabel && !potentialLabel.startsWith(';')) {
                        // 更新 symbols 表，PROC 的地址是下一条指令的地址（当前 address）
                        this.symbols[potentialLabel] = address;
                    }
                }

                // 纯标签行：更新 symbols 表中的地址
                if (line.endsWith(':')) {
                    const colonIndex = line.indexOf(':');
                    const potentialLabel = line.substring(0, colonIndex).trim();
                    if (potentialLabel) {
                        this.symbols[potentialLabel] = address;
                    }
                }

                address += len;
            }
        }

        // 第三遍：修正跳转指令的偏移量（使用 symbols 表）
        this.fixJumpOffsets();

        return this.instructions;
    }

    writeInstructionToMemory(instruction) {
        for (let i = 0; i < instruction.machineCode.length; i++) {
            this.memory.write8(instruction.address + i, instruction.machineCode[i]);
        }
    }

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

    getInstructions() {
        return this.instructions;
    }

    getSymbols() {
        return this.symbols;
    }

    writeDataSegmentToMemory(cpu) {
        const ds = cpu.getSegmentRegister('ds');
        const dataSegmentBase = (ds << 4);
        
        for (const data of this.dataSegments) {
            const dataAddress = dataSegmentBase + data.offset;
            for (let i = 0; i < data.data.length; i++) {
                this.memory.write8(dataAddress + i, data.data[i]);
            }
        }
    }

    writeCodeSegmentToMemory(cpu) {
        const cs = cpu.getSegmentRegister('cs');
        const codeSegmentBase = (cs << 4);

        for (const instruction of this.instructions) {
            const instructionAddress = codeSegmentBase + instruction.address;
            for (let i = 0; i < instruction.machineCode.length; i++) {
                this.memory.write8(instructionAddress + i, instruction.machineCode[i]);
            }
        }

        for (const data of this.codeDataSegments) {
            const dataAddress = codeSegmentBase + data.offset;
            for (let i = 0; i < data.data.length; i++) {
                this.memory.write8(dataAddress + i, data.data[i]);
            }
        }
    }

    fixJumpOffsets() {
        for (let i = 0; i < this.instructions.length; i++) {
            const instr = this.instructions[i];
            
            // 处理所有带有标签引用的指令（如 INC counter, MOV AX, [label] 等）
            if (instr.hasLabel && instr.labelName) {
                const labelNameLower = instr.labelName.toLowerCase();
                const originalLabel = this.symbolOriginalCase[labelNameLower];
                if (originalLabel && this.symbols[originalLabel] !== undefined) {
                    const labelAddr = this.symbols[originalLabel];
                    // 找到机器码中的位移字段并更新
                    // 对于直接寻址（mod=0, rm=6），位移在 ModR/M 字节之后
                    if (instr.machineCode.length >= 4) {
                        // 16位位移（2字节）
                        instr.machineCode[2] = labelAddr & 0xff;
                        instr.machineCode[3] = (labelAddr >> 8) & 0xff;
                    }
                }
            }

            if (instr.opcode === 'CALL' && instr.length === 3 && instr.operands && instr.operands.length > 0) {
                const targetLabel = instr.operands[0];
                if (typeof targetLabel === 'string') {
                    const targetLabelLower = targetLabel.toLowerCase();
                    const originalLabel = this.symbolOriginalCase[targetLabelLower];
                    if (originalLabel && this.symbols[originalLabel] !== undefined) {
                        const targetAddr = this.symbols[originalLabel];
                        const newOffset = targetAddr - (instr.address + 3);
                        instr.machineCode[1] = newOffset & 0xff;
                        instr.machineCode[2] = (newOffset >> 8) & 0xff;
                    }
                }
            }
            else if (instr.opcode &&
                ['JMP', 'JZ', 'JE', 'JNZ', 'JNE', 'JB', 'JC', 'JNAE', 'JNB', 'JAE', 'JNC',
                    'JS', 'JNS', 'JO', 'JNO', 'JP', 'JPE', 'JNP', 'JPO', 'JL', 'JNGE', 'JNL',
                    'JGE', 'JA', 'JNBE', 'JNA', 'JBE', 'JG', 'JNLE', 'JNG', 'JLE', 'LOOP',
                    'LOOPE', 'LOOPZ', 'LOOPNE', 'LOOPNZ', 'JCXZ'].includes(instr.opcode)) {

                if (instr.operands && instr.operands.length > 0) {
                    const targetLabel = instr.operands[0];
                    if (typeof targetLabel === 'string') {
                        const targetLabelLower = targetLabel.toLowerCase();
                        const originalLabel = this.symbolOriginalCase[targetLabelLower];
                        if (originalLabel && this.symbols[originalLabel] !== undefined) {
                            const targetAddr = this.symbols[originalLabel];
                            let newOffset;

                            if (instr.opcode === 'JMP' && instr.length === 2) {
                                newOffset = targetAddr - (instr.address + 2);
                                instr.machineCode[1] = newOffset & 0xff;
                            } else if (instr.opcode === 'JMP' && instr.length === 3) {
                                newOffset = targetAddr - (instr.address + 3);
                                instr.machineCode[1] = newOffset & 0xff;
                                instr.machineCode[2] = (newOffset >> 8) & 0xff;
                            } else if (instr.length === 2 && instr.machineCode[0] >= 0x70 && instr.machineCode[0] <= 0x7F) {
                                // 短跳转指令 (Jcc)
                                newOffset = targetAddr - (instr.address + 2);
                                instr.machineCode[1] = newOffset & 0xff;
                            } else if (instr.length === 2 && (instr.machineCode[0] === 0xE0 || instr.machineCode[0] === 0xE1 || 
                                       instr.machineCode[0] === 0xE2 || instr.machineCode[0] === 0xE3)) {
                                // LOOP/LOOPZ/LOOPNZ/JCXZ 指令
                                newOffset = targetAddr - (instr.address + 2);
                                instr.machineCode[1] = newOffset & 0xff;
                            }
                        }
                    }
                }
            }
        }
    }
}
