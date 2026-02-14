CPU8086.prototype.handleInt16 = function() {
    const ah = (this.getRegister('ax') >> 8) & 0xff;

    switch (ah) {
        case 0x00:
            return this.int16AH00WaitKey();
        case 0x01:
            return this.int16AH01CheckKey();
        default:
            console.warn(`未实现的INT 16h功能: AH=${ah.toString(16).padStart(2, '0')}`);
            return true;
    }
};

CPU8086.prototype.int16AH00WaitKey = function() {
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

CPU8086.prototype.int16AH01CheckKey = function() {
    if (this.keyboardBuffer.length > 0) {
        this.flags.zf = 0;
        const key = this.keyboardBuffer[0];
        this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
    } else {
        this.flags.zf = 1;
    }
    return true;
};
