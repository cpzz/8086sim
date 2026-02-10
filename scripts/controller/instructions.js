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

        // 检查是否是伪指令
        const isDirective = 
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
            lowerLine.startsWith('org ') ||
            lowerLine.includes(' proc') ||
            lowerLine.includes(' endp');

        if (isDirective) {
            // 显示伪指令
            const rowElement = document.createElement('div');
            rowElement.className = 'instructions-table-row directive-row';

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

                // 创建地址列
                const addressCell = document.createElement('div');
                addressCell.className = 'instructions-table-cell address label-address';
                const labelAddrStr = 'CS:' + labelAddress.toString(16).toUpperCase().padStart(5, '0');
                addressCell.textContent = labelAddrStr;
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
                rowElement.className = 'instructions-table-row label-row';

                // 创建地址列
                const addressCell = document.createElement('div');
                addressCell.className = 'instructions-table-cell address label-address';
                const labelAddrStr = 'CS:' + labelAddress.toString(16).toUpperCase().padStart(5, '0');
                addressCell.textContent = labelAddrStr;
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

        // 如果不是伪指令、数据段定义或标签，则是指令
        // 查找对应的指令
        let foundInstruction = null;
        for (const instruction of instructions) {
            if (instruction.originalLine && instruction.originalLine.trim() === trimmedLine) {
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

            // 构建汇编代码显示（包括操作码和操作数）
            let assemblyCode = foundInstruction.opcode || '';
            if (foundInstruction.operands && foundInstruction.operands.length > 0) {
                // 尝试使用原始大小写的标签名
                const processedOperands = foundInstruction.operands.map(op => {
                    // 检查操作数是否是标签（字母组成，可能是过程名）
                    if (typeof op === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(op)) {
                        // 检查assembler是否有原始大小写的标签名
                        if (assembler.symbolOriginalCase && assembler.symbolOriginalCase[op.toLowerCase()]) {
                            return assembler.symbolOriginalCase[op.toLowerCase()];
                        }
                    }
                    return op; // 如果不是标签或找不到原始大小写，则返回原值
                });
                assemblyCode += ' ' + processedOperands.join(', ');
            }

            // 从原始行提取注释
            const originalLine = foundInstruction.originalLine || '';
            const commentIndex = originalLine.indexOf(';');
            let comment = '';
            if (commentIndex !== -1) {
                comment = originalLine.substring(commentIndex + 1).trim();
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
