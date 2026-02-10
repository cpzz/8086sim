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
}

// 查找各段写入的内存地址
function findSegmentWriteAddresses() {
    const memoryOperations = cpu.getMemoryOperations();
    const segmentWrites = { cs: new Set(), ds: new Set(), ss: new Set(), es: new Set() };

    // 获取各段基址
    const csBase = cpu.getSegmentRegister('cs') << 4;
    const dsBase = cpu.getSegmentRegister('ds') << 4;
    const ssBase = cpu.getSegmentRegister('ss') << 4;
    const esBase = cpu.getSegmentRegister('es') << 4;

    // 遍历所有内存操作，找到各段所有写入的地址
    memoryOperations.forEach((operation, address) => {
        if (operation.type === 'write') {
            // 判断地址属于哪个段
            if (address >= csBase && address < csBase + 65536) {
                segmentWrites.cs.add(address);
            }
            if (address >= dsBase && address < dsBase + 65536) {
                segmentWrites.ds.add(address);
            }
            if (address >= ssBase && address < ssBase + 65536) {
                segmentWrites.ss.add(address);
            }
            if (address >= esBase && address < esBase + 65536) {
                segmentWrites.es.add(address);
            }
        }
    });

    return segmentWrites;
}
// 获取当前内存地址
function getCurrentMemoryAddress() {
    return cpu.getCurrentAddress();
}

// 更新内存显示
function updateMemoryDisplay(offsetAddress) {
    const memoryGrid = document.getElementById('memory-grid');
    // 不再需要检查 display 段，因为用户界面现在是独立的tab

    // 限制偏移地址在有效范围内（0 - 0xFFFF）
    // 确保最后一页能显示到0xFFFF，最大起始地址为0xFF00
    const maxOffset = 0xFF00;
    const clampedOffset = Math.max(0, Math.min(offsetAddress, maxOffset));

    // 保存当前偏移地址
    currentMemoryOffset = clampedOffset;

    // 更新翻页按钮状态
    updateMemoryPageButtons();

    // 根据当前选中的段寄存器计算实际内存地址
    const segmentValue = cpu.getSegmentRegister(currentMemorySegment);
    const segmentBase = segmentValue << 4;

    // 堆栈段特殊处理：从高地址向低地址显示
    let startAddress, memoryRows;
    if (currentMemorySegment === 'ss') {
        // 第一次显示堆栈段时，计算并固定显示的起始地址
        if (stackDisplayBase === null) {
            // 显示从 0xFF00 开始，共256字节（从高到低）
            // 这样可以看到栈的使用情况，地址固定不会变化
            stackDisplayBase = segmentBase + 0xFF00;
        }
        startAddress = stackDisplayBase;

        // 获取原始内存数据
        const memoryDump = memory.getMemoryDump(startAddress, 256);

        // 创建倒序的内存行（从高地址到低地址）
        memoryRows = [];
        for (let rowIdx = memoryDump.length - 1; rowIdx >= 0; rowIdx--) {
            memoryRows.push(memoryDump[rowIdx]);
        }
    } else {
        // 其他段：正常从低地址到高地址显示
        startAddress = (segmentBase) + clampedOffset;
        memoryRows = memory.getMemoryDump(startAddress, 256);
        // 重置堆栈显示基址（切换到其他段后再切回来时重新计算）
        stackDisplayBase = null;
    }

    // 创建表头和内存内容的容器结构
    memoryGrid.innerHTML = '';

    // 创建表头容器（固定）
    const headerContainer = document.createElement('div');
    headerContainer.className = 'memory-header-container';
    headerContainer.innerHTML = `
        <div class="memory-address">地址</div>
        <div class="memory-bytes">
            <div class="memory-byte header">0</div>
            <div class="memory-byte header">1</div>
            <div class="memory-byte header">2</div>
            <div class="memory-byte header">3</div>
            <div class="memory-byte header">4</div>
            <div class="memory-byte header">5</div>
            <div class="memory-byte header">6</div>
            <div class="memory-byte header">7</div>
            <div class="memory-byte header">8</div>
            <div class="memory-byte header">9</div>
            <div class="memory-byte header">A</div>
            <div class="memory-byte header">B</div>
            <div class="memory-byte header">C</div>
            <div class="memory-byte header">D</div>
            <div class="memory-byte header">E</div>
            <div class="memory-byte header">F</div>
        </div>
        <div class="memory-ascii">ASCII</div>
    `;
    memoryGrid.appendChild(headerContainer);

    // 创建内存内容容器（可滚动）
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'memory-body-container';

    // 在CS段时，找到当前指令并确定需要高亮的地址范围
    let currentInstructionAddresses = []; // 存储当前指令的所有物理地址
    if (currentMemorySegment === 'cs') {
        const csBase = cpu.getSegmentRegister('cs') << 4;
        const currentIP = cpu.ip;

        // 查找当前IP对应的指令
        const currentInstruction = instructions.find(inst =>
            currentIP >= inst.address && currentIP < inst.address + inst.length
        );

        // 如果找到指令，计算其所有字节的物理地址
        if (currentInstruction) {
            for (let i = 0; i < currentInstruction.length; i++) {
                currentInstructionAddresses.push(csBase + currentInstruction.address + i);
            }
        }
    }

    memoryRows.forEach(row => {
        const rowElement = document.createElement('div');
        rowElement.className = 'memory-row';

        const addressElement = document.createElement('div');
        addressElement.className = 'memory-address';
        // 显示段:偏移格式的地址
        const segmentAddr = segmentValue.toString(16).toUpperCase().padStart(4, '0');
        const offsetAddr = (row.address - (segmentValue << 4)).toString(16).toUpperCase().padStart(4, '0');
        addressElement.textContent = `${currentMemorySegment.toUpperCase()}:${offsetAddr} (${row.address.toString(16).toUpperCase().padStart(5, '0')})`;

        const bytesElement = document.createElement('div');
        bytesElement.className = 'memory-bytes';

        row.bytes.forEach((byte, index) => {
            const currentAddress = row.address + index;
            const byteElement = document.createElement('div');
            byteElement.className = 'memory-byte';

            // CS段：高亮当前指令的所有字节
            if (currentMemorySegment === 'cs' && currentInstructionAddresses.includes(currentAddress)) {
                byteElement.classList.add('current');
            }

            // 根据当前段进行高亮（写入操作）
            const writeAddresses = segmentWriteAddresses[currentMemorySegment];
            if (writeAddresses && writeAddresses.has(currentAddress)) {
                if (currentMemorySegment === 'cs') {
                    // CS段用红色高亮，表示错误的写入
                    byteElement.classList.add('write', 'error');
                } else {
                    // DS、SS、ES段用普通写入高亮
                    byteElement.classList.add('write');
                }
            }

            byteElement.textContent = byte;
            bytesElement.appendChild(byteElement);
        });

        const asciiElement = document.createElement('div');
        asciiElement.className = 'memory-ascii';
        asciiElement.textContent = row.ascii;

        rowElement.appendChild(addressElement);
        rowElement.appendChild(bytesElement);
        rowElement.appendChild(asciiElement);

        bodyContainer.appendChild(rowElement);
    });

    memoryGrid.appendChild(bodyContainer);
}

// 更新内存翻页按钮状态
function updateMemoryPageButtons() {
    const prevBtn = document.getElementById('memory-prev-btn');
    const nextBtn = document.getElementById('memory-next-btn');

    if (prevBtn) {
        // 当偏移地址为0时，禁用"上页"按钮
        prevBtn.disabled = (currentMemoryOffset === 0);
    }

    if (nextBtn) {
        // 当最后一行显示0xFFFF时（偏移 >= 0xFF00），禁用"下页"按钮
        // 每页显示16行(256字节)，最后一页起始地址为0xFF00
        // 0xFF00 + 0xFF = 0xFFFF，确保0xFFFF在最后一行显示
        nextBtn.disabled = (currentMemoryOffset >= 0xFF00);
    }
}

// 解析地址（始终按16进制处理，空白返回0）
function parseAddress(addressStr) {
    // 去除空白字符
    const trimmed = addressStr.trim();
    // 空白返回0
    if (!trimmed) {
        return 0;
    }
    // 始终按16进制解析（不管有没有0x前缀）
    return parseInt(trimmed, 16);
}
