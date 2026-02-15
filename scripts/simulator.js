// 全局变量
let memory;
let cpu;
let assembler;
let instructions = [];
let breakpoints = new Set();
let currentMemorySegment = 'cs'; // 当前选中的内存段
let currentMemoryOffset = 0; // 当前内存显示的偏移地址
let segmentMemoryOffsets = { cs: 0, ds: 0, ss: null, es: 0 }; // 每个段独立记录偏移，null表示未初始化
let currentLeftTab = 'screen'; // 当前选中的左侧tab: screen, registers, memory
let previousRegisterValues = {}; // 存储上一次的寄存器值
let hasExecuted = false; // 跟踪是否已经执行了指令
let isAtEnd = false; // 跟踪是否执行到了最后一条指令
let currentState = '初始状态'; // 当前状态：初始状态、已加载文件、单步执行、执行中、已暂停、已执行完毕、遇到断点、中断
let interruptResumeMode = null; // 中断恢复模式：'step' 或 'run'
let shouldScrollToCurrent = false; // 是否需要在更新显示时滚动到当前行
let segmentOperationAddresses = { cs: { reads: new Map(), writes: new Map() }, ds: { reads: new Map(), writes: new Map() }, ss: { reads: new Map(), writes: new Map() }, es: { reads: new Map(), writes: new Map() } }; // 各段读写的地址集合（累积，值为步骤号）
let currentStepOperationAddresses = { cs: { reads: new Set(), writes: new Set() }, ds: { reads: new Set(), writes: new Set() }, ss: { reads: new Set(), writes: new Set() }, es: { reads: new Set(), writes: new Set() } }; // 当前步骤读写的地址集合
let executionStepCounter = 0; // 执行步骤计数器
let stackDisplayBase = null; // 堆栈段显示的起始地址（固定后不再改变）
let previousSegmentValues = { cs: 0x1000, ds: 0x2000, ss: 0x3000, es: 0x4000 }; // 各段寄存器上次值

// 获取当前段的内存显示偏移地址
function getMemoryDisplayOffset() {
    const seg = currentMemorySegment;
    // 如果该段有保存的偏移，优先使用
    if (segmentMemoryOffsets[seg] !== undefined && segmentMemoryOffsets[seg] !== null) {
        // 检查是否有新的内存访问需要跟踪
        if (cpu.lastSegmentAccessAddress[seg] >= 0) {
            const base = cpu.getSegmentRegister(seg) << 4;
            const offset = cpu.lastSegmentAccessAddress[seg] - base;
            if (offset >= 0 && offset < 65536 && offset !== 0) {
                return offset & 0xFFF0;
            }
        }
        return segmentMemoryOffsets[seg];
    }
    // SS段默认显示SP附近
    if (seg === 'ss') {
        return cpu.getRegister('sp') & 0xFFF0;
    }
    return 0;
}

// 检查段寄存器是否发生变化
function checkSegmentRegisterChanges() {
    for (const seg of ['cs', 'ds', 'ss', 'es']) {
        const currentVal = cpu.getSegmentRegister(seg);
        if (currentVal !== previousSegmentValues[seg]) {
            previousSegmentValues[seg] = currentVal;
            // 段寄存器变化，更新跟踪地址到新段的起始位置
            cpu.lastSegmentAccessAddress[seg] = currentVal << 4;
        }
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

        case '中断':
            // 等待键盘输入时：禁用执行操作，允许加载和重置
            document.getElementById('run-btn').disabled = true;
            document.getElementById('step-btn').disabled = true;
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

// 更新状态指示器
function updateStatusIndicator(status) {
    const statusIndicator = document.getElementById('status-indicator');
    statusIndicator.textContent = `[${status}]`;
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

    // 检查是否因中断阻塞（如等待键盘输入）
    if (!success && cpu.waitingForKey) {
        currentState = '中断';
        updateStatusIndicator('中断');
        interruptResumeMode = 'step';
        updateButtonStates(false);
        return;
    }

    // 设置执行状态
    hasExecuted = true;
    // 设置滚动标志，执行后需要滚动到当前行
    shouldScrollToCurrent = true;
    // 检查是否执行到了最后一条指令
    checkIfAtEnd();
    // 查找各段读写的地址（累积）
    findSegmentOperationAddresses();
    // 检查段寄存器变化
    checkSegmentRegisterChanges();
    // 保存寄存器操作跟踪
    const registerOperations = new Map(cpu.getRegisterOperations());
    // 更新显示
    updateRegistersDisplay(registerOperations);
    updateMemoryDisplay(getMemoryDisplayOffset()); // 跟踪内存访问位置
    updateInstructionsDisplay();
    updateScreenDisplay(); // 更新屏幕显示
    if (currentMemorySegment === 'ivt') updateIvtDisplay();
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

    // 检查是否因中断阻塞（如等待键盘输入）
    if (cpu.waitingForKey) {
        currentState = '中断';
        updateStatusIndicator('中断');
        interruptResumeMode = 'run';
        // 更新显示
        hasExecuted = true;
        shouldScrollToCurrent = true;
        findSegmentOperationAddresses();
        checkSegmentRegisterChanges();
        const registerOperations = new Map(cpu.getRegisterOperations());
        updateRegistersDisplay(registerOperations);
        updateMemoryDisplay(getMemoryDisplayOffset());
        updateInstructionsDisplay();
        updateScreenDisplay();
        if (currentMemorySegment === 'ivt') updateIvtDisplay();
        highlightRegisterChanges(registerOperations);
        highlightIPRegister();
        updateButtonStates(false);
        return;
    }

    // 设置执行状态
    hasExecuted = true;
    // 设置滚动标志，执行后需要滚动到当前行
    shouldScrollToCurrent = true;
    // 查找各段读写的地址（累积）
    findSegmentOperationAddresses();
    // 检查段寄存器变化
    checkSegmentRegisterChanges();
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
    updateMemoryDisplay(getMemoryDisplayOffset()); // 跟踪内存访问位置
    updateInstructionsDisplay();
    updateScreenDisplay(); // 更新屏幕显示
    if (currentMemorySegment === 'ivt') updateIvtDisplay();
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
    // 设置滚动标志，暂停后需要滚动到当前行
    shouldScrollToCurrent = true;
    // 更新指令列表显示，高亮当前指令
    updateInstructionsDisplay();

    // 高亮IP寄存器
    highlightIPRegister();
}

// 中断恢复：键盘输入完成后自动恢复执行
function resumeAfterInterrupt() {
    const mode = interruptResumeMode;
    interruptResumeMode = null;
    if (mode === 'step') {
        stepExecution();
    } else if (mode === 'run') {
        runExecution();
    }
}

// 重置模拟器
function resetSimulator() {
    // 清空内存
    memory.clear();
    
    cpu.reset();
    breakpoints.clear();

    // 重置状态变量
    hasExecuted = false;
    isAtEnd = false;
    interruptResumeMode = null;
    cancelKeyboardWait();
    segmentOperationAddresses = { cs: { reads: new Map(), writes: new Map() }, ds: { reads: new Map(), writes: new Map() }, ss: { reads: new Map(), writes: new Map() }, es: { reads: new Map(), writes: new Map() } };
    currentStepOperationAddresses = { cs: { reads: new Set(), writes: new Set() }, ds: { reads: new Set(), writes: new Set() }, ss: { reads: new Set(), writes: new Set() }, es: { reads: new Set(), writes: new Set() } };
    executionStepCounter = 0;

    // 重置每段内存偏移记录
    segmentMemoryOffsets = { cs: 0, ds: 0, ss: null, es: 0 };

    // 清除上一次的寄存器值，确保重置后不会高亮
    previousRegisterValues = {};
    // 重置段寄存器跟踪
    previousSegmentValues = { cs: 0x1000, ds: 0x2000, ss: 0x3000, es: 0x4000 };

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

    // 清空输出缓冲区（清屏）
    cpu.outputBuffer = '';
    
    // 清空屏幕缓冲区
    if (typeof screenBuffer !== 'undefined') {
        screenBuffer = [];
        screenCursorLine = 0;
        screenCursorCol = 0;
        processedLength = 0;
    }

    // 如果有指令，重新写入代码段和数据段到内存
    if (instructions.length > 0) {
        assembler.writeCodeSegmentToMemory(cpu);
        assembler.writeDataSegmentToMemory(cpu);
        
        // 设置IP为入口点（大小写不敏感查找）
        let entryAddr = null;
        if (assembler.entryPoint) {
            const epLower = assembler.entryPoint.toLowerCase();
            for (const key in assembler.symbols) {
                if (key.toLowerCase() === epLower && typeof assembler.symbols[key] === 'number') {
                    entryAddr = assembler.symbols[key];
                    break;
                }
            }
        }
        if (entryAddr !== null) {
            cpu.ip = entryAddr;
        } else {
            // 否则使用第一条指令的地址
            cpu.ip = instructions[0].address;
        }
        currentState = '已加载文件';
        updateStatusIndicator('已加载文件');
        // 重置后滚动到入口点
        shouldScrollToCurrent = true;
    } else {
        currentState = '初始状态';
        updateStatusIndicator('初始状态');
    }

    updateRegistersDisplay();
    {
        const savedOffset = segmentMemoryOffsets[currentMemorySegment];
        if (savedOffset !== null && savedOffset !== undefined) {
            updateMemoryDisplay(savedOffset);
        } else if (currentMemorySegment === 'ss') {
            updateMemoryDisplay(cpu.getRegister('sp') & 0xFFF0);
        } else {
            updateMemoryDisplay(0x0000);
        }
    }
    updateInstructionsDisplay(); // 更新指令列表显示，高亮当前指令
    updateDisplayOutput(); // 清空屏幕显示
    resetIvtSnapshot(); // 复位后重置IVT快照，避免误标变化
    updateIvtDisplay(); // 更新中断向量表显示

    // 重置按钮状态
    updateButtonStates(false);
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

// 处理文件加载
function handleFileLoad(e) {
    const file = e.target.files[0];
    if (file) {
        assembler.loadFromFile(file).then((parsedInstructions) => {
            instructions = parsedInstructions;

            // 重置CPU（包括寄存器和标志位）
            memory.clear();
            cpu.reset();

            // 重置状态变量
            hasExecuted = false;
            isAtEnd = false;
            interruptResumeMode = null;
            cancelKeyboardWait();
            currentState = '已加载文件';
            stackDisplayBase = null; // 重置堆栈显示基址
            previousSegmentValues = { cs: 0x1000, ds: 0x2000, ss: 0x3000, es: 0x4000 }; // 重置段跟踪

            // 清除断点
            breakpoints.clear();
            cpu.breakpoints.clear();
            // 清除内存高亮
            segmentOperationAddresses = { cs: { reads: new Map(), writes: new Map() }, ds: { reads: new Map(), writes: new Map() }, ss: { reads: new Map(), writes: new Map() }, es: { reads: new Map(), writes: new Map() } };
            currentStepOperationAddresses = { cs: { reads: new Set(), writes: new Set() }, ds: { reads: new Set(), writes: new Set() }, ss: { reads: new Set(), writes: new Set() }, es: { reads: new Set(), writes: new Set() } };
            executionStepCounter = 0;

            // 重置每段内存偏移记录
            segmentMemoryOffsets = { cs: 0, ds: 0, ss: null, es: 0 };

            // 如果有指令，设置CPU的指令指针指向入口点
            if (instructions.length > 0) {
                // 如果汇编器指定了入口点（如 end main），则使用入口点
                let entryAddr = null;
                if (assembler.entryPoint) {
                    const epLower = assembler.entryPoint.toLowerCase();
                    for (const key in assembler.symbols) {
                        if (key.toLowerCase() === epLower && typeof assembler.symbols[key] === 'number') {
                            entryAddr = assembler.symbols[key];
                            break;
                        }
                    }
                }
                if (entryAddr !== null) {
                    cpu.ip = entryAddr;
                } else {
                    // 否则使用第一条指令的地址
                    cpu.ip = instructions[0].address;
                }
                updateStatusIndicator('已加载文件');
                // 加载文件后滚动到入口点
                shouldScrollToCurrent = true;
            }

            // 写入代码段和数据段到内存
            assembler.writeCodeSegmentToMemory(cpu);
            assembler.writeDataSegmentToMemory(cpu);
            // 初始化各段跟踪地址
            for (const seg of ['cs', 'ds', 'ss', 'es']) {
                cpu.lastSegmentAccessAddress[seg] = cpu.getSegmentRegister(seg) << 4;
            }

            // 清空输出缓冲区（清屏）
            cpu.outputBuffer = '';

            // 更新显示
            updateInstructionsDisplay();
            updateRegistersDisplay();
            // 保持当前选中的内存段不变
            // 只有当当前显示的是内存tab时，才更新内存显示
            if (currentLeftTab === 'memory') {
                const savedOffset = segmentMemoryOffsets[currentMemorySegment];
                if (savedOffset !== null && savedOffset !== undefined) {
                    updateMemoryDisplay(savedOffset);
                } else if (currentMemorySegment === 'ss') {
                    updateMemoryDisplay(cpu.getRegister('sp') & 0xFFF0);
                } else {
                    updateMemoryDisplay(0x0000);
                }
            }
            updateDisplayOutput(); // 清空屏幕显示
            resetIvtSnapshot(); // 加载文件后重置IVT快照，避免误标变化
            updateIvtDisplay(); // 更新中断向量表（加载文件后IVT已初始化）

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

// 初始化模拟器
function init() {
    memory = new Memory();
    cpu = new CPU8086(memory);
    assembler = new Assembler(memory);

    // 设置CPU的显示输出更新回调
    cpu.updateOutputDisplay = updateDisplayOutput;

    // 设置CPU的键盘输入回调
    cpu.waitForKeyPress = handleKeyPress;

    // 设置CPU的中断恢复回调
    cpu.onInputReady = resumeAfterInterrupt;

    // 初始化屏幕
    initScreen();

    // 设置键盘事件监听
    setupKeyboardInput();

    // 更新显示
    updateScreenDisplay();
    updateRegistersDisplay();
    {
        const savedOffset = segmentMemoryOffsets[currentMemorySegment];
        if (savedOffset !== null && savedOffset !== undefined) {
            updateMemoryDisplay(savedOffset);
        } else if (currentMemorySegment === 'ss') {
            updateMemoryDisplay(cpu.getRegister('sp') & 0xFFF0);
        } else {
            updateMemoryDisplay(0x0000);
        }
    }
    updateInstructionsDisplay();
    updateIvtDisplay();
}

// 页面加载完成后初始化
window.addEventListener('load', init);
