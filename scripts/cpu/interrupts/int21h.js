CPU8086.prototype.handleInt21 = function() {
    const ah = (this.getRegister('ax') >> 8) & 0xff;

    switch (ah) {
        case 0x01:
            return this.int21AH01KeyboardInput();
        case 0x02:
            return this.int21AH02DisplayChar();
        case 0x06:
            return this.int21AH06DirectConsoleIO();
        case 0x07:
            return this.int21AH07DirectInputNoEcho();
        case 0x08:
            return this.int21AH08InputNoEcho();
        case 0x09:
            return this.int21AH09DisplayString();
        case 0x0a:
            return this.int21AH0AStringInput();
        case 0x0b:
            return this.int21AH0BCheckKeyboardStatus();
        case 0x25:
            return this.int21AH25SetInterruptVector();
        case 0x35:
            return this.int21AH35GetInterruptVector();
        case 0x4c:
            return this.int21AH4CExit();
        case 0x20:
            return true;
        default:
            console.warn(`未实现的INT 21h功能: AH=${ah.toString(16).padStart(2, '0')}`);
            return true;
    }
};

CPU8086.prototype.int21AH01KeyboardInput = function() {
    if (this.keyboardBuffer.length > 0) {
        const key = this.keyboardBuffer.shift();
        this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
        this.outputBuffer += String.fromCharCode(key);
        if (this.updateOutputDisplay) {
            if (!this._displayUpdateScheduled) {
                this._displayUpdateScheduled = true;
                requestAnimationFrame(() => {
                    this._displayUpdateScheduled = false;
                    this.updateOutputDisplay();
                });
            }
        }
        return true;
    } else {
        if (this.waitForKeyPress && !this.waitingForKey) {
            this.waitingForKey = true;
            this.waitForKeyPress((key) => {
                this.keyboardBuffer.push(key);
                this.waitingForKey = false;
                if (this.onInputReady) {
                    setTimeout(() => this.onInputReady(), 0);
                }
            });
        }
        return false;
    }
};

CPU8086.prototype.int21AH02DisplayChar = function() {
    const dl = this.getRegister('dx') & 0xff;
    const char = this.dosCharToUnicode(dl);
    this.outputBuffer += char;
    
    // 使用节流机制，批量更新显示以提升性能
    if (this.updateOutputDisplay) {
        if (!this._displayUpdateScheduled) {
            this._displayUpdateScheduled = true;
            // 使用 requestAnimationFrame 批量更新，提高流畅度
            requestAnimationFrame(() => {
                this._displayUpdateScheduled = false;
                this.updateOutputDisplay();
            });
        }
    }
    return true;
};

CPU8086.prototype.dosCharToUnicode = function(code) {
    if (code < 128) {
        return String.fromCharCode(code);
    }
    const cp437ToUnicode = [
        0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7,
        0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5,
        0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9,
        0x00FF, 0x00D6, 0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192,
        0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA,
        0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
        0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
        0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
        0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F,
        0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567,
        0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B,
        0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
        0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5, 0x03C4,
        0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229,
        0x2261, 0x00B1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248,
        0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F, 0x00B2, 0x25A0, 0x00A0
    ];
    return String.fromCharCode(cp437ToUnicode[code - 128]);
};

CPU8086.prototype.int21AH06DirectConsoleIO = function() {
    const dl = this.getRegister('dx') & 0xff;

    if (dl === 0xff) {
        if (this.keyboardBuffer.length > 0) {
            const key = this.keyboardBuffer.shift();
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
            this.flags.zf = 0;
        } else {
            this.flags.zf = 1;
        }
    } else {
        const char = String.fromCharCode(dl);
        this.outputBuffer += char;
        if (this.updateOutputDisplay) {
            if (!this._displayUpdateScheduled) {
                this._displayUpdateScheduled = true;
                requestAnimationFrame(() => {
                    this._displayUpdateScheduled = false;
                    this.updateOutputDisplay();
                });
            }
        }
    }
    return true;
};

CPU8086.prototype.int21AH07DirectInputNoEcho = function() {
    if (this.keyboardBuffer.length > 0) {
        const key = this.keyboardBuffer.shift();
        this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
        return true;
    } else {
        if (this.waitForKeyPress && !this.waitingForKey) {
            this.waitingForKey = true;
            this.waitForKeyPress((key) => {
                this.keyboardBuffer.push(key);
                this.waitingForKey = false;
                if (this.onInputReady) {
                    setTimeout(() => this.onInputReady(), 0);
                }
            });
        }
        return false;
    }
};

// AH=08H: 无回显有过滤键盘输入（阻塞，检查Ctrl+C）
CPU8086.prototype.int21AH08InputNoEcho = function() {
    if (this.keyboardBuffer.length > 0) {
        const key = this.keyboardBuffer.shift();
        // 检查Ctrl+C (ASCII 0x03)
        if (key === 0x03) {
            console.log('INT 21H AH=08H: 检测到Ctrl+C');
        }
        this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
        return true;
    } else {
        if (this.waitForKeyPress && !this.waitingForKey) {
            this.waitingForKey = true;
            this.waitForKeyPress((key) => {
                this.keyboardBuffer.push(key);
                this.waitingForKey = false;
                if (this.onInputReady) {
                    setTimeout(() => this.onInputReady(), 0);
                }
            });
        }
        return false;
    }
};

CPU8086.prototype.int21AH09DisplayString = function() {
    const ds = this.getSegmentRegister('ds');
    let dx = this.getRegister('dx');
    const stringAddress = (ds << 4) + dx;
    let char = this.readMemory8(stringAddress);
    while (char !== 0x24) {
        this.outputBuffer += this.dosCharToUnicode(char);
        dx++;
        char = this.readMemory8((ds << 4) + dx);
    }
    if (this.updateOutputDisplay) {
        if (!this._displayUpdateScheduled) {
            this._displayUpdateScheduled = true;
            requestAnimationFrame(() => {
                this._displayUpdateScheduled = false;
                this.updateOutputDisplay();
            });
        }
    }
    return true;
};

CPU8086.prototype.int21AH0AStringInput = function() {
    const ds = this.getSegmentRegister('ds');
    const dx = this.getRegister('dx');
    const bufferAddress = (ds << 4) + dx;
    const maxLength = this.readMemory8(bufferAddress);

    // 恢复或初始化字符串输入状态
    if (!this._stringInputState) {
        this._stringInputState = {
            bufferAddress: bufferAddress,
            maxLength: maxLength,
            inputLength: 0,
            inputString: '',
            done: false
        };
    }
    const state = this._stringInputState;

    // 处理缓冲区中所有可用的按键
    while (this.keyboardBuffer.length > 0 && !state.done) {
        const key = this.keyboardBuffer.shift();

        if (key === 0x0D) {
            state.done = true;
        } else if (key === 0x08) {
            // 退格
            if (state.inputLength > 0) {
                state.inputLength--;
                state.inputString = state.inputString.slice(0, -1);
                this.outputBuffer += '\b \b';
            }
        } else if (state.inputLength < state.maxLength) {
            state.inputString += String.fromCharCode(key);
            state.inputLength++;
            this.outputBuffer += String.fromCharCode(key);
            // 达到最大长度也视为完成
            if (state.inputLength >= state.maxLength) {
                state.done = true;
            }
        }
    }

    if (this.updateOutputDisplay) {
        this.updateOutputDisplay();
    }

    if (state.done) {
        // 输入完成，写入缓冲区
        this.writeMemory8(state.bufferAddress + 1, state.inputLength);
        for (let i = 0; i < state.inputLength; i++) {
            this.writeMemory8(state.bufferAddress + 2 + i, state.inputString.charCodeAt(i));
        }
        this._stringInputState = null;
        return true;
    }

    // 还需要更多输入，继续等待
    if (this.waitForKeyPress && !this.waitingForKey) {
        this.waitingForKey = true;
        this.waitForKeyPress((key) => {
            this.keyboardBuffer.push(key);
            this.waitingForKey = false;
            if (this.onInputReady) {
                setTimeout(() => this.onInputReady(), 0);
            }
        });
    }
    return false;
};

// AH=0BH: 检查键盘状态（非阻塞）
CPU8086.prototype.int21AH0BCheckKeyboardStatus = function() {
    if (this.keyboardBuffer.length > 0) {
        // 有字符可用，AL=0xFF
        this.setRegister('ax', (this.getRegister('ax') & 0xff00) | 0xff);
    } else {
        // 无字符可用，AL=0x00
        this.setRegister('ax', (this.getRegister('ax') & 0xff00) | 0x00);
    }
    return true;
};

CPU8086.prototype.int21AH4CExit = function() {
    this.running = false;
    // exit program, set IP to 0xFFFF to prevent further execution
    this.ip = 0xffff;
    return false;
};

// INT 21H AH=25H: 设置中断向量
// 入口: AL=中断号, DS:DX=新的中断处理程序地址
CPU8086.prototype.int21AH25SetInterruptVector = function() {
    const intNum = this.getRegister('ax') & 0xff; // AL = 中断号
    const newOffset = this.getRegister('dx');
    const newSegment = this.getSegmentRegister('ds');
    const ivtAddr = intNum * 4;
    this.memory.write16(ivtAddr, newOffset);
    this.memory.write16(ivtAddr + 2, newSegment);
    return true;
};

// INT 21H AH=35H: 读取中断向量
// 入口: AL=中断号
// 出口: ES:BX=中断处理程序地址
CPU8086.prototype.int21AH35GetInterruptVector = function() {
    const intNum = this.getRegister('ax') & 0xff; // AL = 中断号
    const ivtAddr = intNum * 4;
    const offset = this.memory.read16(ivtAddr);
    const segment = this.memory.read16(ivtAddr + 2);
    this.setRegister('bx', offset);
    this.setSegmentRegister('es', segment);
    return true;
};
