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
                if (currentMemorySegment === 'ivt') {
                    updateIvtDisplay();
                } else {
                    // 恢复该段上次浏览的位置
                    const savedOffset = segmentMemoryOffsets[currentMemorySegment];
                    if (savedOffset !== undefined && savedOffset !== null) {
                        updateMemoryDisplay(savedOffset);
                    } else if (currentMemorySegment === 'ss') {
                        updateMemoryDisplay(cpu.getRegister('sp') & 0xFFF0);
                    } else {
                        updateMemoryDisplay(0x0000);
                    }
                }
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

            // 切换 memory-grid 和 ivt-grid 的显示
            const memoryGrid = document.getElementById('memory-grid');
            const ivtGrid = document.getElementById('ivt-grid');
            const memoryControls = document.getElementById('memory-controls');
            if (currentMemorySegment === 'ivt') {
                memoryGrid.style.display = 'none';
                ivtGrid.style.display = '';
                if (memoryControls) memoryControls.style.display = 'none';
                updateIvtDisplay();
            } else {
                memoryGrid.style.display = '';
                ivtGrid.style.display = 'none';
                if (memoryControls) memoryControls.style.display = '';
                // 恢复该段上次浏览的位置
                const savedOffset = segmentMemoryOffsets[currentMemorySegment];
                if (savedOffset !== undefined && savedOffset !== null) {
                    updateMemoryDisplay(savedOffset);
                } else if (currentMemorySegment === 'ss') {
                    updateMemoryDisplay(cpu.getRegister('sp') & 0xFFF0);
                } else {
                    updateMemoryDisplay(0x0000);
                }
            }
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

// 全局变量用于存储屏幕缓冲区
let screenBuffer = [];
const MAX_SCREEN_LINES = 1000;
const COLS = 80;
const MIN_SCREEN_ROWS = 25; // 初始固定显示25行
let screenCursorLine = 0;
let screenCursorCol = 0;
let processedLength = 0; // 记录已处理的字符数

// 单字符HTML转义
function escapeCharHtml(char) {
    switch(char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case ' ': return '&nbsp;';
        default: return char;
    }
}

// 初始化键盘事件监听器（仅初始化一次）
let screenKeyboardListenerInitialized = false;

function initScreenKeyboardListener() {
    if (screenKeyboardListenerInitialized) return;
    screenKeyboardListenerInitialized = true;

    document.addEventListener('keydown', (e) => {
        // 仅在屏幕tab激活时处理键盘事件
        if (currentLeftTab !== 'screen') return;

        const displayContent = document.querySelector('#ui-display-grid .display-content');
        if (!displayContent) return;

        const lineHeight = 18; // 每行高度
        const visibleHeight = displayContent.clientHeight;
        const pageSize = Math.floor(visibleHeight / lineHeight);

        switch(e.key) {
            case 'PageDown':
                e.preventDefault();
                displayContent.scrollTop += visibleHeight;
                break;
            case 'PageUp':
                e.preventDefault();
                displayContent.scrollTop = Math.max(0, displayContent.scrollTop - visibleHeight);
                break;
            case 'ArrowDown':
                e.preventDefault();
                displayContent.scrollTop += lineHeight;
                break;
            case 'ArrowUp':
                e.preventDefault();
                displayContent.scrollTop = Math.max(0, displayContent.scrollTop - lineHeight);
                break;
            case 'Home':
                if (e.ctrlKey) {
                    e.preventDefault();
                    displayContent.scrollTop = 0;
                }
                break;
            case 'End':
                if (e.ctrlKey) {
                    e.preventDefault();
                    displayContent.scrollTop = displayContent.scrollHeight;
                }
                break;
        }
    });
}

// 更新屏幕缓冲区
function updateScreenBuffer(outputText) {
    // 如果是第一次初始化或者输出被清空，重置缓冲区为25行
    if (!outputText || outputText.length === 0) {
        screenBuffer = [];
        for (let i = 0; i < MIN_SCREEN_ROWS; i++) {
            screenBuffer.push(' '.repeat(COLS));
        }
        screenCursorLine = 0;
        screenCursorCol = 0;
        processedLength = 0;
        return;
    }

    // 初始化缓冲区（如果为空）- 初始25行
    if (screenBuffer.length === 0) {
        for (let i = 0; i < MIN_SCREEN_ROWS; i++) {
            screenBuffer.push(' '.repeat(COLS));
        }
        screenCursorLine = 0;
        screenCursorCol = 0;
        processedLength = 0;
    }

    // 只处理新增的字符（从 processedLength 开始）
    for (let i = processedLength; i < outputText.length; i++) {
        const char = outputText[i];
        
        if (char === '\r') {
            // 回车符：回到当前行的开头
            screenCursorCol = 0;
        } else if (char === '\n') {
            // 换行符：移动到下一行
            screenCursorLine++;
            // 确保有足够的行
            while (screenBuffer.length <= screenCursorLine) {
                screenBuffer.push(' '.repeat(COLS));
            }
            // 超过最大行数时删除最早的行
            if (screenBuffer.length > MAX_SCREEN_LINES) {
                screenBuffer.shift();
                screenCursorLine--;
            }
            screenCursorCol = 0;
        } else {
            // 普通字符：添加到当前位置
            // 确保当前行存在
            while (screenBuffer.length <= screenCursorLine) {
                screenBuffer.push(' '.repeat(COLS));
            }
            
            const lineArray = screenBuffer[screenCursorLine].split('');
            lineArray[screenCursorCol] = char;
            screenBuffer[screenCursorLine] = lineArray.join('');
            screenCursorCol++;
            
            // 超过80列时换行
            if (screenCursorCol >= COLS) {
                screenCursorCol = 0;
                screenCursorLine++;
                // 确保有足够的行
                while (screenBuffer.length <= screenCursorLine) {
                    screenBuffer.push(' '.repeat(COLS));
                }
                // 超过最大行数时删除最早的行
                if (screenBuffer.length > MAX_SCREEN_LINES) {
                    screenBuffer.shift();
                    screenCursorLine--;
                }
            }
        }
    }
    
    // 更新已处理的字符数
    processedLength = outputText.length;
}

// 渲染屏幕控制界面 - 支持增量更新避免闪烁
function renderDisplayControl(memoryGrid) {
    // 初始化键盘监听器
    initScreenKeyboardListener();

    const outputText = cpu.outputBuffer || '';

    // 更新屏幕缓冲区
    updateScreenBuffer(outputText);

    // 确保至少显示25行
    const displayLines = Math.max(screenBuffer.length, MIN_SCREEN_ROWS);

    // 尝试增量更新（DOM已存在时）
    const linesContainer = memoryGrid.querySelector('.display-lines');
    if (linesContainer) {
        // 移除旧光标
        const oldCursor = linesContainer.querySelector('.cursor-active');
        if (oldCursor) oldCursor.classList.remove('cursor-active');

        const existingLineEls = linesContainer.children;

        // 移除多余的行
        while (existingLineEls.length > displayLines) {
            linesContainer.removeChild(linesContainer.lastChild);
        }

        // 更新已有行 + 追加新行
        for (let i = 0; i < displayLines; i++) {
            const lineContent = i < screenBuffer.length ? screenBuffer[i] : ' '.repeat(COLS);

            if (i < existingLineEls.length) {
                // 更新已有行的字符
                const charSpans = existingLineEls[i].children;
                for (let j = 0; j < COLS; j++) {
                    const ch = j < lineContent.length ? lineContent[j] : ' ';
                    const display = ch === ' ' ? '\u00A0' : ch;
                    if (charSpans[j].textContent !== display) {
                        charSpans[j].textContent = display;
                    }
                }
            } else {
                // 创建新行
                const lineEl = document.createElement('div');
                lineEl.className = 'display-line';
                lineEl.dataset.line = i;
                for (let j = 0; j < COLS; j++) {
                    const span = document.createElement('span');
                    span.className = 'display-char';
                    const ch = j < lineContent.length ? lineContent[j] : ' ';
                    span.textContent = ch === ' ' ? '\u00A0' : ch;
                    lineEl.appendChild(span);
                }
                linesContainer.appendChild(lineEl);
            }
        }

        // 设置光标
        if (screenCursorLine < displayLines && screenCursorCol < COLS) {
            const cursorLine = existingLineEls[screenCursorLine];
            if (cursorLine) {
                const cursorChar = cursorLine.children[screenCursorCol];
                if (cursorChar) cursorChar.classList.add('cursor-active');
            }
        }

        // 自动滚动到底部
        const displayContent = memoryGrid.querySelector('.display-content');
        if (displayContent) {
            displayContent.scrollTop = displayContent.scrollHeight;
        }
        return;
    }

    // 首次完整渲染
    let displayHtml = '';
    for (let i = 0; i < displayLines; i++) {
        const lineContent = i < screenBuffer.length ? screenBuffer[i] : ' '.repeat(COLS);
        let lineChars = '';
        for (let j = 0; j < COLS; j++) {
            const ch = j < lineContent.length ? lineContent[j] : ' ';
            lineChars += `<span class="display-char">${escapeCharHtml(ch)}</span>`;
        }
        displayHtml += `<div class="display-line" data-line="${i}">${lineChars}</div>`;
    }

    memoryGrid.innerHTML = `
        <div class="display-simulator">
            <div class="display-content" tabindex="0">
                <div class="display-lines">
                    ${displayHtml}
                </div>
            </div>
        </div>
    `;

    // 设置光标
    if (screenCursorLine < screenBuffer.length && screenCursorCol < COLS) {
        const cursorEl = memoryGrid.querySelector(`.display-line[data-line="${screenCursorLine}"] .display-char:nth-child(${screenCursorCol + 1})`);
        if (cursorEl) {
            cursorEl.classList.add('cursor-active');
        }
    }

    // 自动滚动到最底部
    const displayContent = memoryGrid.querySelector('.display-content');
    if (displayContent) {
        setTimeout(() => {
            displayContent.scrollTop = displayContent.scrollHeight;
        }, 0);
    }
}
