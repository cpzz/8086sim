
// 更新UI显示输出
function updateDisplayOutput() {
    // 如果当前正好在用户界面tab，则更新显示
    if (currentLeftTab === 'ui') {
        updateUIDisplay();
    }
}

// HTML转义函数，防止XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 渲染用户界面控制界面 - DOS 80x25 文本模式
function renderDisplayControl(memoryGrid) {
    const outputText = cpu.outputBuffer || '';
    const hasOutput = outputText.length > 0;

    // DOS 标准 80列
    const COLS = 80;
    // 根据容器高度动态计算行数
    const LINE_HEIGHT = 18; // 每行高度（包括line-height: 1.4）
    const CONTENT_PADDING = 20; // display-content 的 padding: 10px * 2
    let ROWS = 25; // 默认25行

    // 尝试计算可用的行数
    try {
        const containerHeight = memoryGrid.clientHeight - CONTENT_PADDING;
        if (containerHeight > 0) {
            ROWS = Math.floor(containerHeight / LINE_HEIGHT);
            ROWS = Math.max(10, Math.min(ROWS, 50)); // 限制在10-50行之间
        }
    } catch (e) {
        // 如果计算失败，使用默认值
        ROWS = 25;
    }

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

    // 在光标位置添加光标类
    const cursorLineElement = memoryGrid.querySelector(`.display-line:nth-child(${cursorLine + 1}) .display-char:nth-child(${cursorCol + 1})`);
    if (cursorLineElement) {
        cursorLineElement.classList.add('cursor-active');
    }
}

