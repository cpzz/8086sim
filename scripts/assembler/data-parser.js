Assembler.prototype.parseDB = function(dataPart) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();

    const values = [];
    let currentValue = '';
    let inString = false;
    let stringDelimiter = '';

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];

        if ((char === "'" || char === '"') && !inString) {
            inString = true;
            stringDelimiter = char;
            currentValue += char;
        } else if (char === stringDelimiter && inString) {
            inString = false;
            currentValue += char;
        } else if (char === ',' && !inString) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    if (currentValue.trim() !== '') {
        values.push(currentValue.trim());
    }

    for (const value of values) {
        if (value.includes('DUP(') || value.includes('dup(')) {
            const dupIndex = value.toLowerCase().indexOf('dup(');
            if (dupIndex > 0) {
                const countStr = value.substring(0, dupIndex).trim();
                const count = parseInt(countStr);

                const valueStart = value.indexOf('(') + 1;
                const valueEnd = value.lastIndexOf(')');
                const dupValue = value.substring(valueStart, valueEnd).trim();

                let parsedDupValue;
                if (dupValue.startsWith("'") && dupValue.endsWith("'")) {
                    parsedDupValue = dupValue.charCodeAt(1);
                } else if (dupValue.startsWith('"') && dupValue.endsWith('"')) {
                    parsedDupValue = dupValue.charCodeAt(1);
                } else {
                    parsedDupValue = this.parseImmediate(dupValue);
                }

                for (let i = 0; i < count; i++) {
                    result.push(isNaN(parsedDupValue) ? 0 : (parsedDupValue & 0xff));
                }
            }
        } else if (value.startsWith("'") && value.endsWith("'")) {
            const str = value.slice(1, -1);
            for (let i = 0; i < str.length; i++) {
                result.push(str.charCodeAt(i));
            }
        } else if (value.startsWith('"') && value.endsWith('"')) {
            const str = value.slice(1, -1);
            for (let i = 0; i < str.length; i++) {
                result.push(str.charCodeAt(i));
            }
        } else if (value === '$') {
            result.push('$'.charCodeAt(0));
        } else {
            const parsedValue = this.parseImmediate(value);
            result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
        }
    }
    return result;
};

Assembler.prototype.parseDW = function(dataPart) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();

    const values = [];
    let currentValue = '';

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];

        if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    if (currentValue.trim() !== '') {
        values.push(currentValue.trim());
    }

    for (const value of values) {
        const parsedValue = this.parseImmediate(value);
        result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
        result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 8) & 0xff));
    }
    return result;
};

Assembler.prototype.parseDD = function(dataPart) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();

    const values = [];
    let currentValue = '';

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];

        if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    if (currentValue.trim() !== '') {
        values.push(currentValue.trim());
    }

    for (const value of values) {
        const parsedValue = this.parseImmediate(value);
        result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
        result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 8) & 0xff));
        result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 16) & 0xff));
        result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 24) & 0xff));
    }
    return result;
};

Assembler.prototype.parseDQ = function(dataPart) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();
    const values = [];
    let currentValue = '';

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];
        if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    if (currentValue.trim() !== '') {
        values.push(currentValue.trim());
    }

    for (const value of values) {
        const trimmedValue = value.trim();

        let hexStr = null;
        if (trimmedValue.startsWith('0x') || trimmedValue.startsWith('0X')) {
            hexStr = trimmedValue.substring(2);
        } else if (trimmedValue.endsWith('h') || trimmedValue.endsWith('H')) {
            hexStr = trimmedValue.slice(0, -1);
        }

        if (hexStr && hexStr.length > 8) {
            hexStr = hexStr.padStart(16, '0');
            const lowStr = hexStr.substring(8, 16);
            const highStr = hexStr.substring(0, 8);

            const low = parseInt(lowStr, 16) || 0;
            const high = parseInt(highStr, 16) || 0;

            result.push((low >> 0) & 0xff);
            result.push((low >> 8) & 0xff);
            result.push((low >> 16) & 0xff);
            result.push((low >> 24) & 0xff);
            result.push((high >> 0) & 0xff);
            result.push((high >> 8) & 0xff);
            result.push((high >> 16) & 0xff);
            result.push((high >> 24) & 0xff);
        } else {
            const parsedValue = this.parseImmediate(trimmedValue);
            for (let i = 0; i < 8; i++) {
                result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> (i * 8)) & 0xff));
            }
        }
    }
    return result;
};

Assembler.prototype.parseDT = function(dataPart) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();
    const values = [];
    let currentValue = '';

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];
        if (char === ',' && !currentValue.includes('"') && !currentValue.includes("'")) {
            values.push(currentValue.trim());
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    if (currentValue.trim() !== '') {
        values.push(currentValue.trim());
    }

    for (const value of values) {
        const parsedValue = this.parseImmediate(value);
        for (let i = 0; i < 10; i++) {
            result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> (i * 8)) & 0xff));
        }
    }
    return result;
};