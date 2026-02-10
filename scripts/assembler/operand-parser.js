Assembler.prototype.parseImmediate = function(value) {
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        const char = value.slice(1, -1);
        if (char.length > 0) {
            return char.charCodeAt(0);
        }
    }

    const valueLower = value.toLowerCase();
    for (const key in this.symbols) {
        if (key.toLowerCase() === valueLower) {
            return this.symbols[key];
        }
    }

    if (valueLower === '@data') {
        return 0x2000;
    }

    if (value.startsWith('0x')) {
        return parseInt(value, 16);
    } else if (value.endsWith('h') || value.endsWith('H')) {
        const hexValue = value.slice(0, -1);
        return parseInt(hexValue, 16);
    } else if (value.startsWith('0b')) {
        return parseInt(value, 2);
    } else if (value.startsWith('0') && value !== '0') {
        return parseInt(value, 8);
    } else {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
            return 0;
        }
        return parsed;
    }
};

Assembler.prototype.isImmediate = function(value) {
    const registers = ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'sp', 'bp', 'al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'];
    if (registers.includes(value.toLowerCase())) {
        return false;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
        return false;
    }
    const valueLower = value.toLowerCase();
    for (const dataVar of this.dataVariables) {
        if (dataVar.toLowerCase() === valueLower) {
            return false;
        }
    }
    return true;
};

Assembler.prototype.parseMemoryOperand = function(operand) {
    if (!operand.startsWith('[') || !operand.endsWith(']')) {
        return null;
    }

    const content = operand.substring(1, operand.length - 1).toLowerCase().trim();

    const validCombos = {
        'bx+si': { mod: 0, rm: 0 },
        'bx+di': { mod: 0, rm: 1 },
        'bp+si': { mod: 0, rm: 2 },
        'bp+di': { mod: 0, rm: 3 },
        'si': { mod: 0, rm: 4 },
        'di': { mod: 0, rm: 5 },
        'bp': { mod: 0, rm: 6 },
        'bx': { mod: 0, rm: 7 },
    };

    if (validCombos[content]) {
        return {
            mod: validCombos[content].mod,
            rm: validCombos[content].rm,
            disp: 0,
            dispSize: 0,
            hasLabel: false,
            labelName: null
        };
    }

    const plusMatch = content.match(/^(.+?)\+(.+)$/);
    const minusMatch = content.match(/^(.+?)\-(.+)$/);

    if (plusMatch || minusMatch) {
        const match = plusMatch || minusMatch;
        const regPart = match[1].trim();
        const dispPart = match[2].trim();
        const isNegative = !!minusMatch;

        if (validCombos[regPart]) {
            const dispValue = this.parseImmediate(dispPart);
            if (!isNaN(dispValue)) {
                const absDisp = isNegative ? -dispValue : dispValue;
                const disp8 = absDisp >= -128 && absDisp <= 127;
                return {
                    mod: disp8 ? 1 : 2,
                    rm: validCombos[regPart].rm,
                    disp: absDisp & 0xFFFF,
                    dispSize: disp8 ? 1 : 2,
                    hasLabel: false,
                    labelName: null
                };
            } else {
                return {
                    mod: 2,
                    rm: validCombos[regPart].rm,
                    disp: 0,
                    dispSize: 2,
                    hasLabel: true,
                    labelName: dispPart
                };
            }
        }

        for (const combo in validCombos) {
            if (combo.includes('+') && regPart === combo) {
                const dispValue = this.parseImmediate(dispPart);
                if (!isNaN(dispValue)) {
                    const absDisp = isNegative ? -dispValue : dispValue;
                    const disp8 = absDisp >= -128 && absDisp <= 127;
                    return {
                        mod: disp8 ? 1 : 2,
                        rm: validCombos[combo].rm,
                        disp: absDisp & 0xFFFF,
                        dispSize: disp8 ? 1 : 2,
                        hasLabel: false,
                        labelName: null
                    };
                } else {
                    return {
                        mod: 2,
                        rm: validCombos[combo].rm,
                        disp: 0,
                        dispSize: 2,
                        hasLabel: true,
                        labelName: dispPart
                    };
                }
            }
        }
    }

    const directAddr = this.parseImmediate(content);
    if (!isNaN(directAddr)) {
        return {
            mod: 0,
            rm: 6,
            disp: directAddr & 0xFFFF,
            dispSize: 2,
            hasLabel: false,
            labelName: null,
            isDirect: true
        };
    }

    if (content.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        return {
            mod: 0,
            rm: 6,
            disp: 0,
            dispSize: 2,
            hasLabel: true,
            labelName: content,
            isDirect: true
        };
    }

    const labelPlusMatch = content.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([\+\-])\s*(.+)$/);
    if (labelPlusMatch) {
        const labelName = labelPlusMatch[1];
        const operator = labelPlusMatch[2];
        const dispStr = labelPlusMatch[3];

        const validRegs = ['bx', 'si', 'di', 'bp', 'ax', 'cx', 'dx', 'sp',
                           'al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'];
        if (!validRegs.includes(labelName)) {
            const dispValue = this.parseImmediate(dispStr);

            if (!isNaN(dispValue)) {
                const finalDisp = operator === '-' ? -dispValue : dispValue;
                return {
                    mod: 0,
                    rm: 6,
                    disp: finalDisp & 0xFFFF,
                    dispSize: 2,
                    hasLabel: true,
                    labelName: labelName,
                    isDirect: true
                };
            }
        }
    }

    return null;
};