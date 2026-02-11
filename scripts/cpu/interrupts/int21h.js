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
        case 0x09:
            return this.int21AH09DisplayString();
        case 0x0a:
            return this.int21AH0AStringInput();
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
            this.updateOutputDisplay();
        }
        return true;
    } else {
        if (this.waitForKeyPress && !this.waitingForKey) {
            this.waitingForKey = true;
            this.waitForKeyPress((key) => {
                this.keyboardBuffer.push(key);
                this.waitingForKey = false;
                if (this.updateOutputDisplay) {
                    this.updateOutputDisplay();
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
    if (this.updateOutputDisplay) {
        this.updateOutputDisplay();
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
            const key = this.keyboardBuffer[0];
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
            this.flags.zf = 0;
        } else {
            this.flags.zf = 1;
        }
    } else {
        const char = String.fromCharCode(dl);
        this.outputBuffer += char;
        if (this.updateOutputDisplay) {
            this.updateOutputDisplay();
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
                if (this.updateOutputDisplay) {
                    this.updateOutputDisplay();
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
        this.updateOutputDisplay();
    }
    return true;
};

CPU8086.prototype.int21AH0AStringInput = function() {
    const ds = this.getSegmentRegister('ds');
    const dx = this.getRegister('dx');
    const bufferAddress = (ds << 4) + dx;

    const maxLength = this.readMemory8(bufferAddress);

    if (this.keyboardBuffer.length > 0) {
        let inputLength = 0;
        let inputString = '';

        while (this.keyboardBuffer.length > 0 && inputLength < maxLength) {
            const key = this.keyboardBuffer.shift();

            if (key === 0x0D) {
                break;
            } else if (key === 0x08) {
                if (inputLength > 0) {
                    inputLength--;
                    inputString = inputString.slice(0, -1);
                    this.outputBuffer += '\b \b';
                }
            } else {
                inputString += String.fromCharCode(key);
                inputLength++;
                this.outputBuffer += String.fromCharCode(key);
            }
        }

        this.writeMemory8(bufferAddress + 1, inputLength);
        for (let i = 0; i < inputLength; i++) {
            this.writeMemory8(bufferAddress + 2 + i, inputString.charCodeAt(i));
        }

        if (this.updateOutputDisplay) {
            this.updateOutputDisplay();
        }

        return true;
    } else {
        if (this.waitForKeyPress && !this.waitingForKey) {
            this.waitingForKey = true;
            this.waitForKeyPress((key) => {
                this.keyboardBuffer.push(key);
                this.waitingForKey = false;
                if (this.updateOutputDisplay) {
                    this.updateOutputDisplay();
                }
            });
        }
        return false;
    }
};

CPU8086.prototype.int21AH4CExit = function() {
    this.running = false;
    return false;
};
