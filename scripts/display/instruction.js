// 更新指令列表显示
function updateInstructionsDisplay() {
    // 检查CPU是否正在运行，如果是，就不更新指令列表的显示
    if (cpu.running) {
        return;
    }

    const instructionsList = document.getElementById('instructions-list');
    instructionsList.innerHTML = '';

    // 获取当前指令地址（IP的值，因为指令的地址是相对于CS的偏移）
    const currentIP = cpu.ip;

    // 创建地址到指令的映射
    const addressToInstruction = new Map();
    instructions.forEach(instruction => {
        addressToInstruction.set(instruction.address, instruction);
    });

    // 创建地址到数据段的映射
    const addressToDataSegment = new Map();
    if (assembler.dataSegments) {
        assembler.dataSegments.forEach(dataSeg => {
            addressToDataSegment.set(dataSeg.offset, dataSeg);
        });
    }

    // 创建地址到代码段数据的映射
    const addressToCodeDataSegment = new Map();
    if (assembler.codeDataSegments) {
        assembler.codeDataSegments.forEach(codeDataSeg => {
            addressToCodeDataSegment.set(codeDataSeg.offset, codeDataSeg);
        });
    }

    // 创建标签地址到标签名的映射
    const addressToLabel = new Map();
    for (const label in assembler.symbols) {
        const symbolAddr = assembler.symbols[label];
        if (typeof symbolAddr === 'number' && !isNaN(symbolAddr)) {
            addressToLabel.set(symbolAddr, label);
        }
    }

    // 按照源文件顺序显示所有内容
    const originalLines = assembler.originalLines || [];
    let currentLineIndex = 0;
    
    while (currentLineIndex < originalLines.length) {
        const line = originalLines[currentLineIndex];
        const trimmedLine = line.trim();
        
        // 跳过空行和注释
        if (trimmedLine === '' || trimmedLine.startsWith(';')) {
            currentLineIndex++;
            continue;
        }

        const lowerLine = trimmedLine.toLowerCase();

        // 检查是否是 PROC/ENDP 伪指令
        const isProcDirective = lowerLine.includes(' proc') || lowerLine.includes(' endp');

        // 检查是否是其他伪指令
        const isDirective = isProcDirective ||
            lowerLine.startsWith('.model') ||
            lowerLine.startsWith('.stack') ||
            lowerLine.startsWith('.data') ||
            lowerLine.startsWith('.code') ||
            lowerLine.startsWith('.end') ||
            lowerLine.startsWith('assume ') ||
            lowerLine.endsWith(' segment') ||
            lowerLine.endsWith(' ends') ||
            lowerLine.includes(' equ ') ||
            lowerLine === 'even' ||
            lowerLine.startsWith('org ');

        if (isDirective) {
            // 显示伪指令
            const rowElement = document.createElement('div');
            rowElement.className = 'instructions-table-row directive-row' + (isProcDirective ? ' proc-row' : '');

            // 解析原始行，分离汇编代码和注释
            const commentIndex = trimmedLine.indexOf(';');
            let assemblyCode = trimmedLine;
            let comment = '';
            if (commentIndex !== -1) {
                assemblyCode = trimmedLine.substring(0, commentIndex).trim();
                comment = trimmedLine.substring(commentIndex + 1).trim();
            }

            // 创建地址列（伪指令不分配内存，显示为空）
            const addressCell = document.createElement('div');
            addressCell.className = 'instructions-table-cell address';
            addressCell.textContent = '';
            rowElement.appendChild(addressCell);

            // 创建机器代码列（伪指令没有机器码）
            const machineCodeCell = document.createElement('div');
            machineCodeCell.className = 'instructions-table-cell machine-code';
            machineCodeCell.textContent = '';
            rowElement.appendChild(machineCodeCell);

            // 创建汇编代码列（PROC/ENDP 只有标签名绿色粗斜体）
            const assemblyCell = document.createElement('div');
            assemblyCell.className = 'instructions-table-cell assembly';
            if (isProcDirective) {
                const procMatch = assemblyCode.match(/^(\S+)(\s+(?:proc|endp).*)$/i);
                if (procMatch) {
                    assemblyCell.innerHTML = '<span class="label-ref">' + procMatch[1] + '</span>' + procMatch[2];
                } else {
                    assemblyCell.textContent = assemblyCode;
                }
            } else {
                assemblyCell.textContent = assemblyCode;
            }
            rowElement.appendChild(assemblyCell);

            // 创建注释列
            const commentCell = document.createElement('div');
            commentCell.className = 'instructions-table-cell comment';
            commentCell.textContent = comment;
            rowElement.appendChild(commentCell);

            instructionsList.appendChild(rowElement);
            currentLineIndex++;
            continue;
        }

        // 检查是否是数据段定义（DB, DW, DD）
        const isDataDefinition = 
            lowerLine.startsWith('db ') ||
            lowerLine.startsWith('dw ') ||
            lowerLine.startsWith('dd ') ||
            lowerLine.includes(' db ') ||
            lowerLine.includes(' dw ') ||
            lowerLine.includes(' dd ');

        if (isDataDefinition) {
            // 查找对应的数据段
            let dataSegment = null;
            let dataSegmentAddress = null;
            
            // 检查是否在数据段中
            if (assembler.dataSegments) {
                for (const dataSeg of assembler.dataSegments) {
                    if (dataSeg.originalLine && dataSeg.originalLine.trim() === trimmedLine) {
                        dataSegment = dataSeg;
                        dataSegmentAddress = dataSeg.offset;
                        break;
                    }
                }
            }
            
            // 检查是否在代码段数据中
            if (!dataSegment && assembler.codeDataSegments) {
                for (const codeDataSeg of assembler.codeDataSegments) {
                    if (codeDataSeg.originalLine && codeDataSeg.originalLine.trim() === trimmedLine) {
                        dataSegment = codeDataSeg;
                        dataSegmentAddress = codeDataSeg.offset;
                        break;
                    }
                }
            }

            if (dataSegment) {
                // 显示数据段定义
                const rowElement = document.createElement('div');
                rowElement.className = 'instructions-table-row data-segment';

                // 解析原始行，分离汇编代码和注释
                const commentIndex = trimmedLine.indexOf(';');
                let assemblyCode = trimmedLine;
                let comment = '';
                if (commentIndex !== -1) {
                    assemblyCode = trimmedLine.substring(0, commentIndex).trim();
                    comment = trimmedLine.substring(commentIndex + 1).trim();
                }

                // 构建地址列显示
                const addressStr = (dataSegment.isCodeData ? 'CS:' : 'DS:') + dataSegmentAddress.toString(16).toUpperCase().padStart(5, '0');

                // 创建地址列
                const addressCell = document.createElement('div');
                addressCell.className = 'instructions-table-cell address';
                addressCell.textContent = addressStr;
                rowElement.appendChild(addressCell);

                // 创建机器代码列（数据段显示为空）
                const machineCodeCell = document.createElement('div');
                machineCodeCell.className = 'instructions-table-cell machine-code';
                machineCodeCell.textContent = '';
                rowElement.appendChild(machineCodeCell);

                // 创建汇编代码列
                const assemblyCell = document.createElement('div');
                assemblyCell.className = 'instructions-table-cell assembly';
                assemblyCell.textContent = assemblyCode;
                rowElement.appendChild(assemblyCell);

                // 创建注释列
                const commentCell = document.createElement('div');
                commentCell.className = 'instructions-table-cell comment';
                commentCell.textContent = comment;
                rowElement.appendChild(commentCell);

                instructionsList.appendChild(rowElement);
                currentLineIndex++;
                continue;
            }
        }

        // 检查是否是标签
        const isLabel = trimmedLine.endsWith(':') && !trimmedLine.includes(' ');
        if (isLabel) {
            const labelName = trimmedLine.slice(0, -1).trim();
            const labelAddress = assembler.symbols[labelName];
            
            if (typeof labelAddress === 'number') {
                // 显示标签
                const rowElement = document.createElement('div');
                rowElement.className = 'instructions-table-row label-row';

                // 创建地址列（纯标签不显示偏移地址）
                const addressCell = document.createElement('div');
                addressCell.className = 'instructions-table-cell address';
                addressCell.textContent = '';
                rowElement.appendChild(addressCell);

                // 创建机器代码列（标签行为空）
                const machineCodeCell = document.createElement('div');
                machineCodeCell.className = 'instructions-table-cell machine-code';
                machineCodeCell.textContent = '';
                rowElement.appendChild(machineCodeCell);

                // 创建汇编代码列（标签行显示标签名称）
                const assemblyCell = document.createElement('div');
                assemblyCell.className = 'instructions-table-cell assembly label-assembly';
                assemblyCell.textContent = labelName + ':';
                assemblyCell.style.fontWeight = 'bold';
                assemblyCell.style.color = '#0066cc';
                rowElement.appendChild(assemblyCell);

                // 创建注释列（标签行为空）
                const commentCell = document.createElement('div');
                commentCell.className = 'instructions-table-cell comment';
                commentCell.textContent = '';
                rowElement.appendChild(commentCell);

                instructionsList.appendChild(rowElement);
                currentLineIndex++;
                continue;
            }
        }

        // 检查是否是PROC/ENDP标签
        const isProcLabel = 
            (lowerLine.includes(' proc') || lowerLine.includes(' endp')) &&
            trimmedLine.split(/\s+/)[0].endsWith(':');
        
        if (isProcLabel) {
            const parts = trimmedLine.split(/\s+/);
            const labelName = parts[0].slice(0, -1).trim();
            const labelAddress = assembler.symbols[labelName];
            
            if (typeof labelAddress === 'number') {
                // 显示PROC/ENDP标签
                const rowElement = document.createElement('div');
                rowElement.className = 'instructions-table-row proc-row';

                // 创建地址列（不显示偏移地址）
                const addressCell = document.createElement('div');
                addressCell.className = 'instructions-table-cell address';
                addressCell.textContent = '';
                rowElement.appendChild(addressCell);

                // 创建机器代码列（标签行为空）
                const machineCodeCell = document.createElement('div');
                machineCodeCell.className = 'instructions-table-cell machine-code';
                machineCodeCell.textContent = '';
                rowElement.appendChild(machineCodeCell);

                // 创建汇编代码列（只有标签名绿色粗斜体）
                const assemblyCell = document.createElement('div');
                assemblyCell.className = 'instructions-table-cell assembly';
                const procLabelMatch = trimmedLine.match(/^(\S+?:?)(\s+(?:proc|endp).*)$/i);
                if (procLabelMatch) {
                    assemblyCell.innerHTML = '<span class="label-ref">' + procLabelMatch[1] + '</span>' + procLabelMatch[2];
                } else {
                    assemblyCell.textContent = trimmedLine;
                }
                rowElement.appendChild(assemblyCell);

                // 创建注释列（标签行为空）
                const commentCell = document.createElement('div');
                commentCell.className = 'instructions-table-cell comment';
                commentCell.textContent = '';
                rowElement.appendChild(commentCell);

                instructionsList.appendChild(rowElement);
                currentLineIndex++;
                continue;
            }
        }

        // 如果不是伪指令、数据段定义或标签，则是指令
        // 查找对应的指令（使用lineIndex匹配，而不是originalLine）
        let foundInstruction = null;
        for (const instruction of instructions) {
            if (instruction.lineIndex === currentLineIndex) {
                foundInstruction = instruction;
                break;
            }
        }

        if (foundInstruction) {
            // 显示指令
            const rowElement = document.createElement('div');
            rowElement.className = 'instructions-table-row';

            // 检查是否是当前指令
            if (foundInstruction.address === currentIP) {
                rowElement.classList.add('current');
            }

            // 检查是否是断点
            if (breakpoints.has(foundInstruction.address)) {
                rowElement.classList.add('breakpoint');
            }

            // 构建地址列显示 "CS:XXXXX"
            const addressStr = 'CS:' + foundInstruction.address.toString(16).toUpperCase().padStart(5, '0');
            const machineCodeStr = foundInstruction.machineCode.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

            // 从原始行提取汇编代码和注释
            const originalLine = foundInstruction.originalLine || '';
            const commentIndex = originalLine.indexOf(';');
            let assemblyCode = originalLine.trim();
            let comment = '';
            if (commentIndex !== -1) {
                assemblyCode = originalLine.substring(0, commentIndex).trim();
                comment = originalLine.substring(commentIndex + 1).trim();
            }
            // 去掉行首的标签（如 "label: mov ax, bx" -> "mov ax, bx"）
            const labelMatch = assemblyCode.match(/^[a-zA-Z_][a-zA-Z0-9_]*:\s*/);
            if (labelMatch) {
                assemblyCode = assemblyCode.substring(labelMatch[0].length);
            }

            // 创建地址列
            const addressCell = document.createElement('div');
            addressCell.className = 'instructions-table-cell address';
            addressCell.textContent = addressStr;
            rowElement.appendChild(addressCell);

            // 创建机器代码列
            const machineCodeCell = document.createElement('div');
            machineCodeCell.className = 'instructions-table-cell machine-code';
            machineCodeCell.textContent = machineCodeStr;
            rowElement.appendChild(machineCodeCell);

            // 创建汇编代码列（标签名用绿色粗斜体显示）
            const assemblyCell = document.createElement('div');
            assemblyCell.className = 'instructions-table-cell assembly';
            // 检查是否含有标签引用（CALL/JMP/Jxx/LOOP 等指令的操作数）
            const asmLower = assemblyCode.toLowerCase().trimStart();
            const branchOpcodes = ['call', 'jmp', 'jz', 'je', 'jnz', 'jne', 'jl', 'jnge', 'jnl', 'jge',
                'jg', 'jnle', 'jng', 'jle', 'ja', 'jnbe', 'jna', 'jbe', 'jb', 'jnae', 'jc', 'jnc', 'jnb', 'jae',
                'js', 'jns', 'jo', 'jno', 'jp', 'jpe', 'jnp', 'jpo', 'jcxz', 'loop', 'loope', 'loopz', 'loopne', 'loopnz'];
            let labelHighlighted = false;
            for (const bop of branchOpcodes) {
                if (asmLower.startsWith(bop + ' ') || asmLower.startsWith(bop + '\t')) {
                    const opcodeLen = bop.length;
                    const leading = assemblyCode.match(/^\s*/)[0];
                    const opcodePart = assemblyCode.substring(leading.length, leading.length + opcodeLen);
                    const rest = assemblyCode.substring(leading.length + opcodeLen);
                    const restMatch = rest.match(/^(\s+)(\S+)(.*)$/);
                    if (restMatch) {
                        const space = restMatch[1];
                        const labelName = restMatch[2];
                        const trailing = restMatch[3];
                        assemblyCell.innerHTML = leading + opcodePart + space + '<span class="label-ref">' + labelName + '</span>' + trailing;
                    } else {
                        assemblyCell.textContent = assemblyCode;
                    }
                    labelHighlighted = true;
                    break;
                }
            }
            if (!labelHighlighted) {
                assemblyCell.textContent = assemblyCode;
            }
            rowElement.appendChild(assemblyCell);

            // 创建注释列
            const commentCell = document.createElement('div');
            commentCell.className = 'instructions-table-cell comment';
            commentCell.textContent = comment;
            rowElement.appendChild(commentCell);

            // 添加双击事件，设置断点
            rowElement.addEventListener('dblclick', () => {
                if (breakpoints.has(foundInstruction.address)) {
                    breakpoints.delete(foundInstruction.address);
                    cpu.removeBreakpoint(foundInstruction.address);
                } else {
                    breakpoints.add(foundInstruction.address);
                    cpu.addBreakpoint(foundInstruction.address);
                }
                updateInstructionsDisplay();
            });

            instructionsList.appendChild(rowElement);
            currentLineIndex++;
            continue;
        }

        // 如果没有找到匹配的内容，跳过这一行
        currentLineIndex++;
    }

    // 只有在执行后才自动滚动到当前指令行
    if (shouldScrollToCurrent) {
        const currentInstructionRow = instructionsList.querySelector('.instructions-table-row.current');
        if (currentInstructionRow) {
            // 获取所有指令行元素
            const allInstructionRows = instructionsList.querySelectorAll('.instructions-table-row');
            
            // 获取当前行在所有行中的索引
            const currentIndex = Array.from(allInstructionRows).indexOf(currentInstructionRow);
            
            // 计算可见行数（基于容器高度和行高）
            const rowHeight = currentInstructionRow.offsetHeight;
            const containerHeight = instructionsList.clientHeight;
            const visibleLines = Math.max(1, Math.floor(containerHeight / rowHeight));
            const middleLineIndex = Math.floor(visibleLines / 2);
            
            // 计算滚动到使当前行在中间的位置
            const scrollTo = Math.max(0, (currentIndex - middleLineIndex) * rowHeight);
            instructionsList.scrollTop = scrollTo;
        }
        // 重置标志
        shouldScrollToCurrent = false;
    }
}
