// 键盘输入处理
let keyPressCallback = null;
let isWaitingForKey = false;

// 设置键盘输入监听
function setupKeyboardInput() {
    // 只监听keydown事件
    document.addEventListener('keydown', (e) => {
        // 如果正在等待键盘输入
        if (isWaitingForKey && keyPressCallback) {
            // 忽略纯修饰键（Shift、Ctrl、Alt、Meta）
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            
            // 获取按键的ASCII码
            let charCode;
            if (e.key.length === 1) {
                // 可打印字符，使用charCodeAt获取ASCII码
                charCode = e.key.charCodeAt(0);
            } else if (e.key === 'Enter') {
                charCode = 0x0D;
            } else if (e.key === 'Backspace') {
                charCode = 0x08;
            } else if (e.key === 'Escape') {
                charCode = 0x1B;
            } else if (e.key === 'Tab') {
                charCode = 0x09;
            } else {
                // 其他不可映射的功能键，忽略
                return;
            }
            
            // 确保是8位值
            charCode = charCode & 0xFF;
            
            // 调用回调
            const callback = keyPressCallback;
            keyPressCallback = null;
            isWaitingForKey = false;
            
            // 处理回车键：自动添加换行符（CR+LF）
            if (charCode === 0x0D) {
                // 先发送回车符
                callback(0x0D);
                // 再发送换行符
                setTimeout(() => {
                    if (cpu.outputBuffer !== undefined) {
                        cpu.outputBuffer += '\n';
                        if (cpu.updateOutputDisplay) {
                            cpu.updateOutputDisplay();
                        }
                    }
                }, 0);
            } else {
                callback(charCode);
            }
        }
    }, true);
}

// 取消键盘等待状态
function cancelKeyboardWait() {
    keyPressCallback = null;
    isWaitingForKey = false;
}

// 处理键盘输入请求
function handleKeyPress(callback) {
    keyPressCallback = callback;
    isWaitingForKey = true;
    // 设置焦点到文档，确保能接收键盘事件
    window.focus();
    document.body.focus();
}
