
// 处理文件加载
function handleFileLoad(e) {
    const file = e.target.files[0];
    if (file) {
        assembler.loadFromFile(file).then((parsedInstructions) => {
            instructions = parsedInstructions;

            // 重置CPU（包括寄存器和标志位）
            cpu.reset();

            // 清空所有段内存
            clearAllMemory();

            // 重置状态变量
            hasExecuted = false;
            isAtEnd = false;
            currentState = '已加载文件';
            stackDisplayBase = null; // 重置堆栈显示基址

            // 清除断点
            breakpoints.clear();
            cpu.breakpoints.clear();

            // 如果有指令，设置CPU的指令指针指向入口点
            if (instructions.length > 0) {
                // 如果汇编器指定了入口点（如 end main），则使用入口点
                if (assembler.entryPoint && assembler.symbols.hasOwnProperty(assembler.entryPoint)) {
                    cpu.ip = assembler.symbols[assembler.entryPoint];
                } else {
                    // 否则使用第一条指令的地址
                    cpu.ip = instructions[0].address;
                }
                updateStatusIndicator('已加载文件');
                // 加载文件后滚动到入口点
                shouldScrollToCurrent = true;
            }

            // 初始化不同段的内存值
            initializeSegmentMemory();

            // 清空输出缓冲区（清屏）
            cpu.outputBuffer = '';

            // 更新显示
            updateInstructionsDisplay();
            updateRegistersDisplay();
            // 保持当前选中的内存段不变
            // 只有当当前显示的是内存tab时，才更新内存显示
            if (currentLeftTab === 'memory') {
                updateMemoryDisplay(0x0000);
            }
            updateDisplayOutput(); // 清空屏幕显示

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
