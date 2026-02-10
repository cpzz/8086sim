// 全局变量
let currentMemorySegment = 'cs'; // 当前选中的内存段
let currentMemoryOffset = 0; // 当前内存显示的偏移地址
let currentLeftTab = 'screen'; // 当前选中的左侧tab: screen, registers, memory
let previousRegisterValues = {}; // 存储上一次的寄存器值
let hasExecuted = false; // 跟踪是否已经执行了指令
let isAtEnd = false; // 跟踪是否执行到了最后一条指令
let currentState = '初始状态'; // 当前状态：初始状态、已加载文件、单步执行、执行中、已暂停、已执行完毕、遇到断点
let shouldScrollToCurrent = false; // 是否需要在更新显示时滚动到当前行
let segmentWriteAddresses = { cs: new Set(), ds: new Set(), ss: new Set(), es: new Set() }; // 各段写入的地址集合
let stackDisplayBase = null; // 堆栈段显示的起始地址（固定后不再改变）

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
    // 设置执行状态
    hasExecuted = true;
    // 设置滚动标志，执行后需要滚动到当前行
    shouldScrollToCurrent = true;
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
    updateScreenDisplay(); // 更新屏幕显示
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
    // 设置滚动标志，执行后需要滚动到当前行
    shouldScrollToCurrent = true;
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
    updateScreenDisplay(); // 更新屏幕显示
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

    // 清空输出缓冲区（清屏）
    cpu.outputBuffer = '';

    // 如果有指令，设置IP为入口点
    if (instructions.length > 0) {
        // 如果汇编器指定了入口点（如 end main），则使用入口点
        if (assembler.entryPoint && assembler.symbols.hasOwnProperty(assembler.entryPoint)) {
            cpu.ip = assembler.symbols[assembler.entryPoint];
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
    updateMemoryDisplay(0x0000);
    updateInstructionsDisplay(); // 更新指令列表显示，高亮当前指令
    updateDisplayOutput(); // 清空屏幕显示

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
