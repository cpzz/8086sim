// 全局变量
let memory;
let cpu;
let assembler;
let instructions = [];
let breakpoints = new Set();

// 初始化模拟器
function initSimulator() {
    memory = new Memory();
    cpu = new CPU8086(memory);
    assembler = new Assembler(memory);

    // 设置CPU的显示输出更新回调
    cpu.updateOutputDisplay = updateDisplayOutput;

    // 设置CPU的键盘输入回调
    cpu.waitForKeyPress = handleKeyPress;

    // 初始化屏幕
    initScreen();

    // 设置键盘事件监听
    setupKeyboardInput();

    // 更新显示
    updateScreenDisplay();
    updateRegistersDisplay();
    updateMemoryDisplay(0x0000);
    updateInstructionsDisplay();
}

// 页面加载完成后初始化
window.addEventListener('load', initSimulator);
