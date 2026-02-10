// 初始化Screen
function initScreen() {
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

    // 内存上页按钮（向上显示16行 = 256字节）
    document.getElementById('memory-prev-btn').addEventListener('click', () => {
        // 向上翻页，偏移地址减少256（16行）
        const newOffset = Math.max(0, currentMemoryOffset - 256);
        updateMemoryDisplay(newOffset);
        // 更新输入框显示
        document.getElementById('memory-address-input').value = newOffset.toString(16).toUpperCase();
        // 更新按钮状态
        updateMemoryPageButtons();
    });

    // 内存下页按钮（向下显示16行 = 256字节）
    document.getElementById('memory-next-btn').addEventListener('click', () => {
        // 向下翻页，偏移地址增加256（16行）
        const newOffset = currentMemoryOffset + 256;
        updateMemoryDisplay(newOffset);
        // 更新输入框显示
        document.getElementById('memory-address-input').value = newOffset.toString(16).toUpperCase();
        // 更新按钮状态
        updateMemoryPageButtons();
    });

    // 内存地址输入回车事件
    document.getElementById('memory-address-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('memory-go-btn').click();
        }
    });

    // 同步指令表格头部和表格体的横向滚动
    const instructionsTable = document.querySelector('.instructions-table');
    const instructionsTableHeader = document.querySelector('.instructions-table-header');
    const instructionsTableBody = document.querySelector('.instructions-table-body');

    if (instructionsTable && instructionsTableHeader && instructionsTableBody) {
        // 表格体滚动时同步表头
        instructionsTableBody.addEventListener('scroll', function() {
            instructionsTableHeader.style.transform = `translateX(-${this.scrollLeft}px)`;
        });
    }

    // 左侧tab页切换（屏幕/寄存器/内存）
    const leftTabs = document.querySelectorAll('.left-tab');
    leftTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有tab的active类
            leftTabs.forEach(t => t.classList.remove('active'));
            // 添加当前tab的active类
            tab.classList.add('active');
            // 更新当前tab
            currentLeftTab = tab.dataset.tab;

            // 切换内容显示
            document.querySelectorAll('.left-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const activeContent = document.querySelector(`.left-tab-content[data-content="${currentLeftTab}"]`);
            if (activeContent) {
                activeContent.classList.add('active');
            }

            // 更新显示
            if (currentLeftTab === 'screen') {
                updateScreenDisplay();
            } else if (currentLeftTab === 'registers') {
                updateRegistersDisplay();
            } else if (currentLeftTab === 'memory') {
                updateMemoryDisplay(0x0000);
            }
        });
    });

    // 内存段tab页切换
    const memorySegmentTabs = document.querySelectorAll('.memory-segment-tab');
    memorySegmentTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除所有tab的active类
            memorySegmentTabs.forEach(t => t.classList.remove('active'));
            // 添加当前tab的active类
            tab.classList.add('active');
            // 更新当前内存段
            currentMemorySegment = tab.dataset.segment;

            // 更新内存显示
            updateMemoryDisplay(0x0000);
        });
    });
}

// 更新屏幕显示
function updateScreenDisplay() {
    const uiDisplayGrid = document.getElementById('ui-display-grid');
    renderDisplayControl(uiDisplayGrid);
}

// 更新屏幕显示输出
function updateDisplayOutput() {
    // 更新显示（无论当前在哪个标签页）
    const uiDisplayGrid = document.getElementById('ui-display-grid');
    if (uiDisplayGrid) {
        renderDisplayControl(uiDisplayGrid);
    }
}

// HTML转义函数，防止XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 渲染屏幕控制界面 - DOS 80x25 文本模式
function renderDisplayControl(memoryGrid) {
    const outputText = cpu.outputBuffer || '';
    const hasOutput = outputText.length > 0;

    // DOS 标准 80列x25行
    const COLS = 80;
    const ROWS = 25; // 固定25行

    // 初始化显示缓冲区
    let displayLines = [];
    let cursorLine = 0;
    let cursorCol = 0;

    if (hasOutput) {
        // 初始化空行
        for (let i = 0; i < ROWS; i++) {
            displayLines.push(' '.repeat(COLS));
        }

        // 逐个字符处理
        for (let i = 0; i < outputText.length; i++) {
            const char = outputText[i];
            if (char === '\r') {
                // 回车符：回到当前行的开头
                cursorCol = 0;
            } else if (char === '\n') {
                // 换行符：移动到下一行
                cursorLine++;
                if (cursorLine >= ROWS) {
                    // 超出显示范围，将所有行向上滚动
                    for (let j = 0; j < ROWS - 1; j++) {
                        displayLines[j] = displayLines[j + 1];
                    }
                    displayLines[ROWS - 1] = ' '.repeat(COLS);
                    cursorLine = ROWS - 1;
                }
                cursorCol = 0;
            } else {
                // 普通字符：添加到当前位置
                const lineArray = displayLines[cursorLine].split('');
                lineArray[cursorCol] = char;
                displayLines[cursorLine] = lineArray.join('');
                cursorCol++;
                // 超过80列时换行
                if (cursorCol >= COLS) {
                    cursorCol = 0;
                    cursorLine++;
                    if (cursorLine >= ROWS) {
                        for (let j = 0; j < ROWS - 1; j++) {
                            displayLines[j] = displayLines[j + 1];
                        }
                        displayLines[ROWS - 1] = ' '.repeat(COLS);
                        cursorLine = ROWS - 1;
                    }
                }
            }
        }
    } else {
        // 初始状态，空行
        for (let i = 0; i < ROWS; i++) {
            displayLines.push(' '.repeat(COLS));
        }
    }

    // 渲染显示内容
    let displayHtml = '';
    for (let i = 0; i < ROWS; i++) {
        let lineContent = displayLines[i];
        let lineClass = 'display-line';

        lineContent = escapeHtml(lineContent);
        // 处理空格显示
        lineContent = lineContent.replace(/ /g, '&nbsp;');

        // 将每行按字符分割，为每个字符添加容器
        const charArray = lineContent.replace(/&nbsp;/g, ' ').split('');
        let lineWithChars = '';
        for (let j = 0; j < charArray.length; j++) {
            const charSpan = `<span class="display-char">${charArray[j] === ' ' ? '&nbsp;' : charArray[j]}</span>`;
            lineWithChars += charSpan;
        }

        displayHtml += `<div class="${lineClass}">${lineWithChars}</div>`;
    }

    memoryGrid.innerHTML = `
        <div class="display-simulator">
            <div class="display-content">
                <div class="display-lines">
                    ${displayHtml}
                </div>
            </div>
        </div>
    `;

    // 在光标位置添加光标类（确保光标位置有效）
    if (cursorLine < ROWS && cursorCol < COLS) {
        const cursorLineElement = memoryGrid.querySelector(`.display-line:nth-child(${cursorLine + 1}) .display-char:nth-child(${cursorCol + 1})`);
        if (cursorLineElement) {
            cursorLineElement.classList.add('cursor-active');
        }
    }
}
