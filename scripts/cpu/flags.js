CPU8086.prototype.updateFlags8 = function(result, operand1, operand2, operation = 'add') {
    this.flags.zf = (result & 0xff) === 0 ? 1 : 0;
    
    this.flags.sf = (result & 0x80) !== 0 ? 1 : 0;
    
    let parity = 0;
    let value = result & 0xff;
    for (let i = 0; i < 8; i++) {
        parity += value & 1;
        value >>= 1;
    }
    this.flags.pf = (parity % 2 === 0) ? 1 : 0;
    
    if (operation === 'add' || operation === 'sub') {
        if (operation === 'sub') {
            this.flags.cf = operand1 < operand2 ? 1 : 0;
        } else {
            this.flags.cf = result > 0xff ? 1 : 0;
        }
    } else {
        this.flags.cf = 0;
    }
    
    if (operation === 'add') {
        this.flags.af = ((operand1 & 0x0f) + (operand2 & 0x0f)) > 0x0f ? 1 : 0;
    } else if (operation === 'sub') {
        this.flags.af = ((operand1 & 0x0f) < (operand2 & 0x0f)) ? 1 : 0;
    } else {
        this.flags.af = 0;
    }
    
    if (operation === 'add') {
        const signedResult = result > 0x7f ? result - 0x100 : result;
        const signedOperand1 = operand1 > 0x7f ? operand1 - 0x100 : operand1;
        const signedOperand2 = operand2 > 0x7f ? operand2 - 0x100 : operand2;
        this.flags.of = (signedResult !== signedOperand1 + signedOperand2) ? 1 : 0;
    } else if (operation === 'sub') {
        const signedResult = result > 0x7f ? result - 0x100 : result;
        const signedOperand1 = operand1 > 0x7f ? operand1 - 0x100 : operand1;
        const signedOperand2 = operand2 > 0x7f ? operand2 - 0x100 : operand2;
        this.flags.of = (signedResult !== signedOperand1 - signedOperand2) ? 1 : 0;
    } else {
        this.flags.of = 0;
    }
};

CPU8086.prototype.updateFlags16 = function(result, operand1, operand2, operation = 'add') {
    this.flags.zf = (result & 0xffff) === 0 ? 1 : 0;
    
    this.flags.sf = (result & 0x8000) !== 0 ? 1 : 0;
    
    let parity = 0;
    let value = result & 0xff;
    for (let i = 0; i < 8; i++) {
        parity += value & 1;
        value >>= 1;
    }
    this.flags.pf = (parity % 2 === 0) ? 1 : 0;
    
    if (operation === 'add' || operation === 'sub') {
        this.flags.cf = result > 0xffff ? 1 : 0;
    } else {
        this.flags.cf = 0;
    }
    
    if (operation === 'add') {
        this.flags.af = ((operand1 & 0x0f) + (operand2 & 0x0f)) > 0x0f ? 1 : 0;
    } else if (operation === 'sub') {
        this.flags.af = ((operand1 & 0x0f) < (operand2 & 0x0f)) ? 1 : 0;
    } else {
        this.flags.af = 0;
    }
    
    if (operation === 'add') {
        const signedResult = result > 0x7fff ? result - 0x10000 : result;
        const signedOperand1 = operand1 > 0x7fff ? operand1 - 0x10000 : operand1;
        const signedOperand2 = operand2 > 0x7fff ? operand2 - 0x10000 : operand2;
        this.flags.of = (signedResult !== signedOperand1 + signedOperand2) ? 1 : 0;
    } else if (operation === 'sub') {
        const signedResult = result > 0x7fff ? result - 0x10000 : result;
        const signedOperand1 = operand1 > 0x7fff ? operand1 - 0x10000 : operand1;
        const signedOperand2 = operand2 > 0x7fff ? operand2 - 0x10000 : operand2;
        this.flags.of = (signedResult !== signedOperand1 - signedOperand2) ? 1 : 0;
    } else {
        this.flags.of = 0;
    }
};
