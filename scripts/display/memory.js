// 清空所有段内存
function clearAllMemory() {
    // 清空代码段
    const csBase = cpu.getSegmentRegister('cs') << 4;
    for (let i = 0; i < 65536; i++) {
        memory.write8(csBase + i, 0);
    }

    // 清空数据段
    const dsBase = cpu.getSegmentRegister('ds') << 4;
    for (let i = 0; i < 65536; i++) {
        memory.write8(dsBase + i, 0);
    }

    // 清空堆栈段
    const ssBase = cpu.getSegmentRegister('ss') << 4;
    for (let i = 0; i < 65536; i++) {
        memory.write8(ssBase + i, 0);
    }

    // 清空附加段
    const esBase = cpu.getSegmentRegister('es') << 4;
    for (let i = 0; i < 65536; i++) {
        memory.write8(esBase + i, 0);
    }
}

// 初始化不同段的内存值
function initializeSegmentMemory() {
    // 使用新添加的方法写入数据段和代码段
    assembler.writeDataSegmentToMemory(cpu);
    assembler.writeCodeSegmentToMemory(cpu);

    // 堆栈段 (SS) 初始化 - 将栈顶的 FFFF 和 FFFE 设置为 0
    const ssBase = cpu.getSegmentRegister('ss') << 4;
    memory.write8(ssBase + 0xFFFE, 0);
    memory.write8(ssBase + 0xFFFF, 0);
    // 附加段 (ES) 初始化 - 保持随机数据

    // 初始化后，将各段跟踪地址设为段起始位置
    for (const seg of ['cs', 'ds', 'ss', 'es']) {
        const base = cpu.getSegmentRegister(seg) << 4;
        cpu.lastSegmentAccessAddress[seg] = base;
    }
}

// 查找各段读写的内存地址（累积到已有集合中）
function findSegmentOperationAddresses() {
    const memoryOperations = cpu.getMemoryOperations();

    // 步骤计数器递增
    executionStepCounter++;

    // 重置当前步骤的操作地址
    currentStepOperationAddresses = {
        cs: { reads: new Set(), writes: new Set() },
        ds: { reads: new Set(), writes: new Set() },
        ss: { reads: new Set(), writes: new Set() },
        es: { reads: new Set(), writes: new Set() }
    };

    // 获取各段基址
    const csBase = cpu.getSegmentRegister('cs') << 4;
    const dsBase = cpu.getSegmentRegister('ds') << 4;
    const ssBase = cpu.getSegmentRegister('ss') << 4;
    const esBase = cpu.getSegmentRegister('es') << 4;

    const bases = { cs: csBase, ds: dsBase, ss: ssBase, es: esBase };

    // 遍历所有内存操作，累积到全局（记录步骤号）+ 记录当前步骤
    memoryOperations.forEach((operation, address) => {
        for (const seg of ['cs', 'ds', 'ss', 'es']) {
            if (address >= bases[seg] && address < bases[seg] + 65536) {
                if (operation.type === 'write') {
                    segmentOperationAddresses[seg].writes.set(address, executionStepCounter);
                    currentStepOperationAddresses[seg].writes.add(address);
                } else {
                    segmentOperationAddresses[seg].reads.set(address, executionStepCounter);
                    currentStepOperationAddresses[seg].reads.add(address);
                }
            }
        }
    });
}
// 获取当前内存地址
function getCurrentMemoryAddress() {
    return cpu.getCurrentAddress();
}

// 当前渲染上下文（供滚动事件handler引用，避免闭包捕获旧值）
let _memoryRenderCtx = null;

// 更新内存显示 - 虚拟滚动
function updateMemoryDisplay(offsetAddress) {
    const memoryGrid = document.getElementById('memory-grid');

    // 总行数 = 64K / 16 = 4096
    const TOTAL_ROWS = 4096;
    const ROW_HEIGHT = 28; // 每行像素高度

    // 根据当前选中的段寄存器计算实际内存地址
    const segmentValue = cpu.getSegmentRegister(currentMemorySegment);
    const segmentBase = segmentValue << 4;

    // 限制偏移地址在有效范围内
    const clampedOffset = Math.max(0, Math.min(offsetAddress, 0xFFFF)) & 0xFFF0; // 对齐到16字节
    currentMemoryOffset = clampedOffset;

    // 堆栈段特殊处理
    const isStack = (currentMemorySegment === 'ss');

    // 在CS段时，找到当前指令并确定需要高亮的地址范围
    let currentInstructionAddresses = [];
    if (currentMemorySegment === 'cs') {
        const csBase = cpu.getSegmentRegister('cs') << 4;
        const currentIP = cpu.ip;
        const currentInstruction = instructions.find(inst =>
            currentIP >= inst.address && currentIP < inst.address + inst.length
        );
        if (currentInstruction) {
            for (let i = 0; i < currentInstruction.length; i++) {
                currentInstructionAddresses.push(csBase + currentInstruction.address + i);
            }
        }
    }

    // 计算可见行数（根据容器实际高度）
    function getVisibleRows(container) {
        const h = container.clientHeight;
        return Math.max(16, Math.ceil(h / ROW_HEIGHT) + 1); // 至少16行，多渲染1行保证无空白
    }

    // 渲染指定行范围的内容
    function renderRows(startRow, visibleRows, container) {
        container.innerHTML = '';
        const rowCount = Math.min(visibleRows, TOTAL_ROWS - startRow);
        for (let r = 0; r < rowCount; r++) {
            let rowIndex = startRow + r;
            // 堆栈段倒序显示
            if (isStack) {
                rowIndex = TOTAL_ROWS - 1 - (startRow + r);
            }
            const rowOffset = rowIndex * 16;
            const physAddr = segmentBase + rowOffset;
            const rowData = memory.getMemoryDump(physAddr, 16)[0];

            const rowEl = document.createElement('div');
            rowEl.className = 'memory-row';

            const addrEl = document.createElement('div');
            addrEl.className = 'memory-address';
            const segHex = segmentValue.toString(16).toUpperCase().padStart(4, '0');
            addrEl.textContent = `${segHex}:${rowOffset.toString(16).toUpperCase().padStart(4, '0')}`;

            const bytesEl = document.createElement('div');
            bytesEl.className = 'memory-bytes';
            rowData.bytes.forEach((byte, index) => {
                const currentAddress = physAddr + index;
                const byteEl = document.createElement('div');
                byteEl.className = 'memory-byte';

                if (currentMemorySegment === 'cs' && currentInstructionAddresses.includes(currentAddress)) {
                    byteEl.classList.add('current');
                }
                const segOps = segmentOperationAddresses[currentMemorySegment];
                const stepOps = currentStepOperationAddresses[currentMemorySegment];
                if (segOps) {
                    if (segOps.writes.has(currentAddress)) {
                        if (currentMemorySegment === 'cs') {
                            byteEl.classList.add('write', 'error');
                        } else {
                            byteEl.classList.add('write');
                        }
                        if (stepOps && stepOps.writes.has(currentAddress)) {
                            byteEl.classList.add('last');
                        } else {
                            const age = executionStepCounter - segOps.writes.get(currentAddress);
                            const level = Math.min(5, age);
                            byteEl.classList.add('fade-' + level);
                        }
                    } else if (segOps.reads.has(currentAddress)) {
                        byteEl.classList.add('read');
                        if (stepOps && stepOps.reads.has(currentAddress)) {
                            byteEl.classList.add('last');
                        } else {
                            const age = executionStepCounter - segOps.reads.get(currentAddress);
                            const level = Math.min(5, age);
                            byteEl.classList.add('fade-' + level);
                        }
                    }
                }
                byteEl.textContent = byte;
                bytesEl.appendChild(byteEl);
            });

            const asciiEl = document.createElement('div');
            asciiEl.className = 'memory-ascii';
            asciiEl.textContent = rowData.ascii;

            rowEl.appendChild(addrEl);
            rowEl.appendChild(bytesEl);
            rowEl.appendChild(asciiEl);
            container.appendChild(rowEl);
        }
    }

    // 更新渲染上下文（滚动handler通过此引用获取最新的渲染函数和状态）
    _memoryRenderCtx = { renderRows, isStack, getVisibleRows, TOTAL_ROWS, ROW_HEIGHT };

    // 检查是否已有DOM结构
    let headerContainer = memoryGrid.querySelector('.memory-header-container');
    let bodyContainer = memoryGrid.querySelector('.memory-body-container');
    let scrollContent = memoryGrid.querySelector('.memory-scroll-content');
    let spacer = memoryGrid.querySelector('.memory-spacer');
    let rowsContainer = memoryGrid.querySelector('.memory-rows-container');

    if (!headerContainer) {
        // 首次构建DOM结构
        memoryGrid.innerHTML = '';

        headerContainer = document.createElement('div');
        headerContainer.className = 'memory-header-container';
        headerContainer.innerHTML = `
            <div class="memory-address">地址</div>
            <div class="memory-bytes">
                ${['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'].map(h => `<div class="memory-byte header">${h}</div>`).join('')}
            </div>
            <div class="memory-ascii">ASCII</div>
        `;
        memoryGrid.appendChild(headerContainer);

        bodyContainer = document.createElement('div');
        bodyContainer.className = 'memory-body-container';

        scrollContent = document.createElement('div');
        scrollContent.className = 'memory-scroll-content';

        spacer = document.createElement('div');
        spacer.className = 'memory-spacer';
        spacer.style.height = `${TOTAL_ROWS * ROW_HEIGHT}px`;

        rowsContainer = document.createElement('div');
        rowsContainer.className = 'memory-rows-container';

        scrollContent.appendChild(spacer);
        scrollContent.appendChild(rowsContainer);
        bodyContainer.appendChild(scrollContent);
        memoryGrid.appendChild(bodyContainer);

        // 滚动事件驱动虚拟渲染 - 通过 _memoryRenderCtx 引用最新的渲染函数
        bodyContainer.addEventListener('scroll', () => {
            if (!_memoryRenderCtx) return;
            const ctx = _memoryRenderCtx;
            const scrollTop = bodyContainer.scrollTop;
            const visibleRows = ctx.getVisibleRows(bodyContainer);
            const startRow = Math.floor(scrollTop / ctx.ROW_HEIGHT);
            const clampedRow = Math.min(startRow, Math.max(0, ctx.TOTAL_ROWS - visibleRows));
            rowsContainer.style.top = `${clampedRow * ctx.ROW_HEIGHT}px`;
            ctx.renderRows(clampedRow, visibleRows, rowsContainer);
            // 更新偏移地址记录
            if (ctx.isStack) {
                currentMemoryOffset = (ctx.TOTAL_ROWS - 1 - clampedRow) * 16;
            } else {
                currentMemoryOffset = clampedRow * 16;
            }
        });
    }

    // 更新spacer高度（段切换时可能需要）
    spacer.style.height = `${TOTAL_ROWS * ROW_HEIGHT}px`;

    // 计算目标行
    let targetRow;
    if (isStack) {
        stackDisplayBase = segmentBase + 0xFF00;
        targetRow = Math.max(0, TOTAL_ROWS - 1 - Math.floor(clampedOffset / 16));
    } else {
        targetRow = Math.floor(clampedOffset / 16);
        stackDisplayBase = null;
    }

    // 判断目标行是否已在可见范围内，不在时才自动滚动
    const visibleRows = getVisibleRows(bodyContainer);
    const currentScrollTop = bodyContainer.scrollTop;
    const currentStartRow = Math.floor(currentScrollTop / ROW_HEIGHT);
    const currentEndRow = currentStartRow + visibleRows - 1;

    if (targetRow < currentStartRow || targetRow > currentEndRow) {
        // 目标行不可见，自动滚动使其居中显示
        const centerRow = Math.max(0, targetRow - Math.floor(visibleRows / 2));
        bodyContainer.scrollTop = centerRow * ROW_HEIGHT;
    }

    // 渲染当前可见行
    const actualScrollTop = bodyContainer.scrollTop;
    const startRow = Math.floor(actualScrollTop / ROW_HEIGHT);
    const clampedRow = Math.min(startRow, Math.max(0, TOTAL_ROWS - visibleRows));
    rowsContainer.style.top = `${clampedRow * ROW_HEIGHT}px`;
    renderRows(clampedRow, visibleRows, rowsContainer);
}

// 解析地址（始终按16进制处理，空白返回0）
function parseAddress(addressStr) {
    const trimmed = addressStr.trim();
    if (!trimmed) {
        return 0;
    }
    return parseInt(trimmed, 16);
}
