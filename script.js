// 全局变量
let memory;
let cpu;
let assembler;
let instructions = [];
let breakpoints = new Set();
let currentMemorySegment = 'cs'; // 当前选中的内存段
let previousRegisterValues = {}; // 存储上一次的寄存器值
let hasExecuted = false; // 跟踪是否已经执行了指令
let isAtEnd = false; // 跟踪是否执行到了最后一条指令
let currentState = '初始状态'; // 当前状态：初始状态、已加载文件、单步执行、执行中、已暂停、已执行完毕、遇到断点
let segmentWriteAddresses = { cs: new Set(), ds: new Set(), ss: new Set(), es: new Set() }; // 各段写入的地址集合
let stackDisplayBase = null; // 堆栈段显示的起始地址（固定后不再改变）

// 初始化模拟器
function initSimulator() {
    memory = new Memory();
    cpu = new CPU8086(memory);
    assembler = new Assembler(memory);
    
    // 初始化UI
    initUI();
    
    // 更新显示
    updateRegistersDisplay();
    updateMemoryDisplay(0x0000);
    updateInstructionsDisplay();
}

// 更新状态指示器
function updateStatusIndicator(status) {
    const statusIndicator = document.getElementById('status-indicator');
    statusIndicator.textContent = `[${status}]`;
}

// 高亮IP寄存器
function highlightIPRegister() {
    const ipElement = document.getElementById('ip');
    if (ipElement) {
        ipElement.classList.add('register-changed');
    }
}

// 初始化UI
function initUI() {
    // 加载文件按钮
    document.getElementById('load-btn').addEventListener('click', () => {
        // 重置文件输入的value，这样即使用户选择同一个文件，也会触发change事件
        document.getElementById('file-input').value = '';
        document.getElementById('file-input').click();
    });
    
    // 文件输入
    document.getElementById('file-input').addEventListener('change', handleFileLoad);
    
    // 单步执行按钮
    document.getElementById('step-btn').addEventListener('click', stepExecution);
    
    // 运行按钮
    document.getElementById('run-btn').addEventListener('click', () => {
        updateStatusIndicator('执行中');
        runExecution();
        updateButtonStates(true);
    });
    
    // 暂停按钮
    document.getElementById('pause-btn').addEventListener('click', () => {
        pauseExecution();
        updateStatusIndicator('已暂停');
        updateButtonStates(false);
    });
    
    // 重置按钮
    document.getElementById('reset-btn').addEventListener('click', resetSimulator);
    
    // 初始化按钮状态
    updateButtonStates(false);
    // 初始化状态
    currentState = '初始状态';
    // 初始化状态指示器
    updateStatusIndicator('初始状态');
    
    // 内存地址输入
    document.getElementById('memory-go-btn').addEventListener('click', () => {
        const addressInput = document.getElementById('memory-address-input').value;
        const address = parseAddress(addressInput);
        if (address !== null) {
            updateMemoryDisplay(address);
        }
    });
    
    // 内存地址输入回车事件
    document.getElementById('memory-address-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('memory-go-btn').click();
        }
    });
    
    // 内存tab页切换
    const memoryTabs = document.querySelectorAll('.memory-tab');
    memoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有tab的active类
            memoryTabs.forEach(t => t.classList.remove('active'));
            // 添加当前tab的active类
            tab.classList.add('active');
            // 更新当前内存段
            currentMemorySegment = tab.dataset.segment;
            
            // 显示或隐藏内存控制控件
            const memoryControls = document.querySelector('.memory-controls');
            if (currentMemorySegment === 'display') {
                memoryControls.style.display = 'none';
            } else {
                memoryControls.style.display = 'flex';
            }
            
            // 更新内存显示
            updateMemoryDisplay(0x0000);
        });
    });
}

// 处理文件加载
function handleFileLoad(e) {
    const file = e.target.files[0];
    if (file) {
        assembler.loadFromFile(file).then((parsedInstructions) => {
            instructions = parsedInstructions;
            
            // 重置状态变量
            hasExecuted = false;
            isAtEnd = false;
            currentState = '已加载文件';
            stackDisplayBase = null; // 重置堆栈显示基址

            // 清除断点
            breakpoints.clear();
            cpu.breakpoints.clear();

            // 如果有指令，设置CPU的指令指针指向第一条指令的地址
            if (instructions.length > 0) {
                cpu.ip = instructions[0].address;
                updateStatusIndicator('已加载文件');
            }
            
            // 初始化不同段的内存值
            initializeSegmentMemory();
            
            updateInstructionsDisplay();
            updateRegistersDisplay();
            updateMemoryDisplay(0x0000);
            
            // 清除寄存器和内存操作跟踪
            cpu.clearRegisterOperations();
            cpu.clearMemoryOperations();
            
            // 更新按钮状态
            updateButtonStates(false);
        }).catch((error) => {
            alert('文件加载失败: ' + error.message);
        });
    }
}

// 初始化不同段的内存值
function initializeSegmentMemory() {
    // 代码段 (CS) 初始化
    const csBase = cpu.getSegmentRegister('cs') << 4;
    // 计算所有指令占用的总长度
    let totalInstructionLength = 0;
    for (let i = 0; i < instructions.length; i++) {
        totalInstructionLength += instructions[i].length;
    }
    // 将指令从0x00000复制到CS段对应的内存位置
    for (let i = 0; i < totalInstructionLength; i++) {
        const instructionByte = memory.read8(i);
        memory.write8(csBase + i, instructionByte);
    }
    // 指令之外的部分设置为0
    for (let i = totalInstructionLength; i < 65536; i++) {
        memory.write8(csBase + i, 0);
    }

    // 数据段 (DS) 初始化 - 保持随机数据
    // 堆栈段 (SS) 初始化 - 保持随机数据，但将栈顶的 FFFF 和 FFFE 设置为 0
    const ssBase = cpu.getSegmentRegister('ss') << 4;
    memory.write8(ssBase + 0xFFFE, 0);
    memory.write8(ssBase + 0xFFFF, 0);
    // 附加段 (ES) 初始化 - 保持随机数据
}

// 单步执行
function stepExecution() {
    // 清除之前的操作跟踪
    cpu.clearMemoryOperations();
    cpu.clearRegisterOperations();
    // 清除之前的寄存器高亮
    clearRegisterHighlights();
    // 执行步骤
    const success = cpu.step();
    // 设置执行状态
    hasExecuted = true;
    // 检查是否执行到了最后一条指令
    checkIfAtEnd();
    // 查找各段最后一次写入的地址
    segmentWriteAddresses = findSegmentWriteAddresses();
    // 保存寄存器操作跟踪
    const registerOperations = new Map(cpu.getRegisterOperations());
    // 更新显示
    updateRegistersDisplay(registerOperations);
    updateMemoryDisplay(0x0000); // 显示从偏移地址0开始的内存内容
    updateInstructionsDisplay();
    // 高亮寄存器值改变
    highlightRegisterChanges(registerOperations);

    // 高亮IP寄存器
    highlightIPRegister();

    // 更新状态指示器和当前状态
    if (isAtEnd) {
        currentState = '已执行完毕';
        updateStatusIndicator('已执行完毕');
    } else {
        currentState = '单步执行';
        updateStatusIndicator('单步执行');
    }
    // 更新按钮状态
    updateButtonStates(false);
}

// 运行执行
function runExecution() {
    // 先取消代码高亮
    const instructionsList = document.getElementById('instructions-list');
    const currentRows = instructionsList.querySelectorAll('.instructions-table-row.current');
    currentRows.forEach(row => row.classList.remove('current'));

    // 清除之前的操作跟踪
    cpu.clearMemoryOperations();
    cpu.clearRegisterOperations();
    // 清除之前的寄存器高亮
    clearRegisterHighlights();

    // 设置状态为执行中
    currentState = '执行中';
    updateStatusIndicator('执行中');

    // 执行步骤
    cpu.run();
    // 确保cpu.running为false
    cpu.running = false;
    // 设置执行状态
    hasExecuted = true;
    // 查找各段最后一次写入的地址
    segmentWriteAddresses = findSegmentWriteAddresses();
    // 保存寄存器操作跟踪
    const registerOperations = new Map(cpu.getRegisterOperations());
    // 检查是否执行到了最后一条指令
    checkIfAtEnd();

    // 更新状态指示器和当前状态
    if (isAtEnd) {
        currentState = '已执行完毕';
        updateStatusIndicator('已执行完毕');
    } else if (cpu.running === false) {
        // 如果没有执行完毕但cpu.running为false，说明遇到了断点
        currentState = '遇到断点';
        updateStatusIndicator('遇到断点');
        // 高亮IP寄存器
        highlightIPRegister();        
    } else {
        // 正常执行完（没有断点，也没有到达末尾）
        currentState = '单步执行';
        updateStatusIndicator('单步执行');
        // 高亮IP寄存器
        highlightIPRegister();
    }

    // 更新显示
    updateRegistersDisplay(registerOperations);
    updateMemoryDisplay(0x0000); // 显示从偏移地址0开始的内存内容
    updateInstructionsDisplay();
    // 更新按钮状态
    updateButtonStates(false);
    // 高亮寄存器值改变
    highlightRegisterChanges(registerOperations);

    // 高亮IP寄存器
    highlightIPRegister();
}

// 暂停执行
function pauseExecution() {
    cpu.pause();
    currentState = '已暂停';
    // 更新指令列表显示，高亮当前指令
    updateInstructionsDisplay();

    // 高亮IP寄存器
    highlightIPRegister();
}

// 清除寄存器高亮
function clearRegisterHighlights() {
    // 移除所有寄存器值的高亮
    const registerValues = document.querySelectorAll('#ax, #ah, #al, #bx, #bh, #bl, #cx, #ch, #cl, #dx, #dh, #dl, #sp, #bp, #ip, #si, #di, #cs, #ds, #ss, #es');
    registerValues.forEach(value => {
        value.classList.remove('register-changed');
    });
}

// 高亮寄存器值改变
function highlightRegisterChanges(registerOperations) {
    registerOperations.forEach((operation, registerName) => {
        // 只处理写入操作，不检查值是否变化
        if (operation.type === 'write' && operation.oldValue !== undefined) {
            // 获取寄存器值的元素
            const valueElement = document.getElementById(registerName);
            if (valueElement) {
                valueElement.classList.add('register-changed');
            }
        }
    });
}

// 检查是否执行到了最后一条指令
function checkIfAtEnd() {
    if (instructions.length === 0) {
        isAtEnd = false;
        return;
    }

    // 获取最后一条指令的地址
    const lastInstruction = instructions[instructions.length - 1];
    const lastAddress = lastInstruction.address + lastInstruction.length - 1;

    // 检查当前IP是否超过了最后一条指令的地址
    if (cpu.ip > lastAddress) {
        isAtEnd = true;
        // 执行完最后一条指令后，将IP设置为一个非法值，表明无法继续执行
        // 使用0xffff，这是16位的最大值，绝对不会与任何指令地址匹配
        cpu.setRegister('ip', 0xffff);
    } else {
        isAtEnd = false;
    }
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

// 重置模拟器
function resetSimulator() {
    // 不清除内存，保留垃圾数据
    cpu.reset();
    breakpoints.clear();

    // 重置状态变量
    hasExecuted = false;
    isAtEnd = false;
    segmentWriteAddresses = { cs: new Set(), ds: new Set(), ss: new Set(), es: new Set() };

    // 清除上一次的寄存器值，确保重置后不会高亮
    previousRegisterValues = {};

    // 移除所有寄存器的高亮
    const registerItems = document.querySelectorAll('.register-item');
    registerItems.forEach(item => {
        item.classList.remove('changed');
    });

    // 移除表格形式的寄存器高亮
    const registerRows = document.querySelectorAll('.register-table tr');
    registerRows.forEach(row => {
        row.classList.remove('changed');
    });

    // 清除寄存器操作高亮
    clearRegisterHighlights();

    // 如果有指令，设置IP为第一条指令的地址
    if (instructions.length > 0) {
        cpu.ip = instructions[0].address;
        currentState = '已加载文件';
        updateStatusIndicator('已加载文件');
    } else {
        currentState = '初始状态';
        updateStatusIndicator('初始状态');
    }

    updateRegistersDisplay();
    updateMemoryDisplay(0x0000);
    updateInstructionsDisplay();

    // 重置按钮状态
    updateButtonStates(false);

    // 将代码列表滚动到顶部
    const instructionsList = document.getElementById('instructions-list');
    if (instructionsList) {
        instructionsList.scrollTop = 0;
    }
}

// 更新按钮状态
function updateButtonStates(isRunning) {
    // 检查是否加载了文件
    const hasLoadedFile = instructions.length > 0;

    // 根据当前状态设置按钮
    switch (currentState) {
        case '初始状态':
            // 加载文件按钮: 可用
            // 单步执行按钮: 禁用
            // 执行按钮: 禁用
            // 暂停按钮: 禁用
            // 重置按钮: 禁用
            document.getElementById('run-btn').disabled = true;
            document.getElementById('step-btn').disabled = true;
            document.getElementById('pause-btn').disabled = true;
            document.getElementById('load-btn').disabled = false;
            document.getElementById('reset-btn').disabled = true;
            break;

        case '已加载文件':
            // 加载文件按钮: 可用
            // 单步执行按钮: 可用
            // 执行按钮: 可用
            // 暂停按钮: 禁用
            // 重置按钮: 禁用
            document.getElementById('run-btn').disabled = false;
            document.getElementById('step-btn').disabled = false;
            document.getElementById('pause-btn').disabled = true;
            document.getElementById('load-btn').disabled = false;
            document.getElementById('reset-btn').disabled = true;
            break;

        case '单步执行':
            // 加载文件按钮: 可用
            // 单步执行按钮: 可用
            // 执行按钮: 可用
            // 暂停按钮: 禁用
            // 重置按钮: 可用
            document.getElementById('run-btn').disabled = false;
            document.getElementById('step-btn').disabled = false;
            document.getElementById('pause-btn').disabled = true;
            document.getElementById('load-btn').disabled = false;
            document.getElementById('reset-btn').disabled = false;
            break;

        case '执行中':
            // 加载文件按钮: 禁用
            // 单步执行按钮: 禁用
            // 执行按钮: 禁用
            // 暂停按钮: 可用
            // 重置按钮: 禁用
            document.getElementById('run-btn').disabled = true;
            document.getElementById('step-btn').disabled = true;
            document.getElementById('pause-btn').disabled = false;
            document.getElementById('load-btn').disabled = true;
            document.getElementById('reset-btn').disabled = true;
            break;

        case '已暂停':
        case '遇到断点':
            // 加载文件按钮: 可用
            // 单步执行按钮: 可用
            // 执行按钮: 可用
            // 暂停按钮: 禁用
            // 重置按钮: 可用
            document.getElementById('run-btn').disabled = false;
            document.getElementById('step-btn').disabled = false;
            document.getElementById('pause-btn').disabled = true;
            document.getElementById('load-btn').disabled = false;
            document.getElementById('reset-btn').disabled = false;
            break;

        case '已执行完毕':
            // 加载文件按钮: 可用
            // 单步执行按钮: 禁用
            // 执行按钮: 禁用
            // 暂停按钮: 禁用
            // 重置按钮: 可用
            document.getElementById('run-btn').disabled = true;
            document.getElementById('step-btn').disabled = true;
            document.getElementById('pause-btn').disabled = true;
            document.getElementById('load-btn').disabled = false;
            document.getElementById('reset-btn').disabled = false;
            break;
    }
}



// 解析地址
function parseAddress(addressStr) {
    if (addressStr.startsWith('0x')) {
        return parseInt(addressStr, 16);
    } else {
        return parseInt(addressStr, 10);
    }
}

// 获取当前内存地址
function getCurrentMemoryAddress() {
    return cpu.getCurrentAddress();
}

// 更新寄存器显示
function updateRegistersDisplay(registerOperations = new Map()) {
    // 获取当前寄存器值（直接从内部属性获取，避免调用getRegister方法干扰操作跟踪）
    const currentValues = {
        ax: cpu.registers.ax || 0,
        bx: cpu.registers.bx || 0,
        cx: cpu.registers.cx || 0,
        dx: cpu.registers.dx || 0,
        ah: (cpu.registers.ax >> 8) & 0xff,
        al: cpu.registers.ax & 0xff,
        bh: (cpu.registers.bx >> 8) & 0xff,
        bl: cpu.registers.bx & 0xff,
        ch: (cpu.registers.cx >> 8) & 0xff,
        cl: cpu.registers.cx & 0xff,
        dh: (cpu.registers.dx >> 8) & 0xff,
        dl: cpu.registers.dx & 0xff,
        si: cpu.registers.si || 0,
        di: cpu.registers.di || 0,
        sp: cpu.registers.sp || 0,
        bp: cpu.registers.bp || 0,
        cs: cpu.segmentRegisters.cs || 0,
        ds: cpu.segmentRegisters.ds || 0,
        ss: cpu.segmentRegisters.ss || 0,
        es: cpu.segmentRegisters.es || 0,
        ip: cpu.ip
    };
    
    // 更新通用寄存器
    updateRegisterDisplay('ax', currentValues.ax, '', 4, registerOperations);
    updateRegisterDisplay('bx', currentValues.bx, '', 4, registerOperations);
    updateRegisterDisplay('cx', currentValues.cx, '', 4, registerOperations);
    updateRegisterDisplay('dx', currentValues.dx, '', 4, registerOperations);
    
    // 更新8位寄存器
    updateRegisterDisplay('ah', currentValues.ah, '', 2, registerOperations);
    updateRegisterDisplay('al', currentValues.al, '', 2, registerOperations);
    updateRegisterDisplay('bh', currentValues.bh, '', 2, registerOperations);
    updateRegisterDisplay('bl', currentValues.bl, '', 2, registerOperations);
    updateRegisterDisplay('ch', currentValues.ch, '', 2, registerOperations);
    updateRegisterDisplay('cl', currentValues.cl, '', 2, registerOperations);
    updateRegisterDisplay('dh', currentValues.dh, '', 2, registerOperations);
    updateRegisterDisplay('dl', currentValues.dl, '', 2, registerOperations);
    
    // 更新索引和指针寄存器
    updateRegisterDisplay('si', currentValues.si, '', 4, registerOperations);
    updateRegisterDisplay('di', currentValues.di, '', 4, registerOperations);
    updateRegisterDisplay('sp', currentValues.sp, '', 4, registerOperations);
    updateRegisterDisplay('bp', currentValues.bp, '', 4, registerOperations);
    
    // 更新段寄存器
    updateRegisterDisplay('cs', currentValues.cs, '', 4, registerOperations);
    updateRegisterDisplay('ds', currentValues.ds, '', 4, registerOperations);
    updateRegisterDisplay('ss', currentValues.ss, '', 4, registerOperations);
    updateRegisterDisplay('es', currentValues.es, '', 4, registerOperations);
    
    // 更新指令指针
    updateRegisterDisplay('ip', currentValues.ip, '', 4, registerOperations);
    
    // 更新标志位
    document.getElementById('cf').textContent = cpu.getFlag('cf');
    document.getElementById('pf').textContent = cpu.getFlag('pf');
    document.getElementById('af').textContent = cpu.getFlag('af');
    document.getElementById('zf').textContent = cpu.getFlag('zf');
    document.getElementById('sf').textContent = cpu.getFlag('sf');
    document.getElementById('tf').textContent = cpu.getFlag('tf');
    document.getElementById('if').textContent = cpu.getFlag('if');
    document.getElementById('df').textContent = cpu.getFlag('df');
    document.getElementById('of').textContent = cpu.getFlag('of');
    
    // 存储当前值作为下一次的比较基准（只在执行指令后更新）
    if (registerOperations.size > 0) {
        previousRegisterValues = currentValues;
    }
}

// 更新单个寄存器显示
function updateRegisterDisplay(id, value, suffix, padding, registerOperations = new Map()) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with id "${id}" not found`);
        return;
    }

    let registerNameElement = null;

    // 查找前面的寄存器名称元素
    let sibling = element.previousElementSibling;
    while (sibling) {
        if (sibling.classList.contains('register-name')) {
            registerNameElement = sibling;
            break;
        }
        sibling = sibling.previousElementSibling;
    }

    // 检查是否有写入操作（只从registerOperations中检查）
    let hasChanged = false;

    // 只从registerOperations中检查写入操作
    if (registerOperations.has(id)) {
        const operation = registerOperations.get(id);
        hasChanged = operation.type === 'write' && operation.oldValue !== undefined;
    }

    // 更新文本内容（HTML中已硬编码H后缀）
    element.textContent = value.toString(16).toUpperCase().padStart(padding, '0') + suffix;

    // 添加或移除高亮
    if (hasChanged) {
        element.classList.add('register-changed');
    } else {
        element.classList.remove('register-changed');
    }

    // 添加或移除changed类到寄存器名称元素
    if (registerNameElement) {
        if (hasChanged) {
            registerNameElement.classList.add('changed');
        } else {
            registerNameElement.classList.remove('changed');
        }
    }
}

// 更新内存显示
function updateMemoryDisplay(offsetAddress) {
    const memoryGrid = document.getElementById('memory-grid');

    // 检查是否是显示控制tab
    if (currentMemorySegment === 'display') {
        // 显示显示控制界面
        memoryGrid.innerHTML = `
            <div class="display-simulator">
                <div class="display-header">
                    <h3>8086显示指令输出</h3>
                </div>
                <div class="display-content">
                    <div class="display-grid">
                        <!-- 显示内容将在这里显示 -->
                        <div class="display-message">8086显示指令的输出结果将显示在这里</div>
                        <div class="display-example">
                            <p>示例：MOV AH, 02h</p>
                            <p>        MOV DL, 41h</p>
                            <p>        INT 21h</p>
                            <p>; 这将在显示控制中显示字母 'A'</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

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
        startAddress = (segmentBase) + offsetAddress;
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

    instructions.forEach(instruction => {
        const rowElement = document.createElement('div');
        rowElement.className = 'instructions-table-row';

        // 检查是否是当前指令
        if (instruction.address === currentIP) {
            rowElement.classList.add('current');
        }

        // 检查是否是断点
        if (breakpoints.has(instruction.address)) {
            rowElement.classList.add('breakpoint');
        }

        // 解析原始行，分离汇编代码和注释
        const originalLine = instruction.originalLine || '';
        const commentIndex = originalLine.indexOf(';');
        let assemblyCode = originalLine;
        let comment = '';
        if (commentIndex !== -1) {
            assemblyCode = originalLine.substring(0, commentIndex).trim();
            comment = originalLine.substring(commentIndex + 1).trim();
        }

        // 构建各列
        const addressStr = instruction.address.toString(16).toUpperCase().padStart(5, '0');
        const machineCodeStr = instruction.machineCode.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

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
            if (breakpoints.has(instruction.address)) {
                breakpoints.delete(instruction.address);
                cpu.removeBreakpoint(instruction.address);
            } else {
                breakpoints.add(instruction.address);
                cpu.addBreakpoint(instruction.address);
            }
            updateInstructionsDisplay();
        });

        instructionsList.appendChild(rowElement);
    });
    
    // 自动滚动到当前指令行
    const currentInstructionRow = instructionsList.querySelector('.instructions-table-row.current');
    if (currentInstructionRow) {
        // 获取所有指令行元素
        const allInstructionRows = instructionsList.querySelectorAll('.instructions-table-row');
        
        // 获取当前行在所有行中的索引
        const currentIndex = Array.from(allInstructionRows).indexOf(currentInstructionRow);
        
        // 假设有11行可见，如果当前行在后半部分（第6行及之后），则滚动到中间
        const visibleLines = 11;
        const middleLineIndex = Math.floor(visibleLines / 2);
        
        // 如果当前行索引大于中间行索引，则滚动到中间
        if (currentIndex >= middleLineIndex) {
            const rowHeight = currentInstructionRow.offsetHeight;
            // 计算滚动到使当前行在中间的位置
            const scrollTo = (currentIndex - middleLineIndex) * rowHeight;
            instructionsList.scrollTop = scrollTo;
        }
    }
}

// 页面加载完成后初始化
window.addEventListener('load', initSimulator);
