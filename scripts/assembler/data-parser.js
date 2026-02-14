Assembler.prototype.parseDB = function(dataPart, currentAddress) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();

    // Split by commas, respecting strings and parentheses
    const values = [];
    let currentValue = '';
    let inString = false;
    let stringDelimiter = '';
    let parenDepth = 0;

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];

        if ((char === "'" || char === '"') && !inString) {
            inString = true;
            stringDelimiter = char;
            currentValue += char;
        } else if (char === stringDelimiter && inString) {
            inString = false;
            currentValue += char;
        } else if (char === '(' && !inString) {
            parenDepth++;
            currentValue += char;
        } else if (char === ')' && !inString) {
            parenDepth--;
            currentValue += char;
        } else if (char === ',' && !inString && parenDepth === 0) {
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
                const dupContent = value.substring(valueStart, valueEnd).trim();

                // Parse the content inside DUP() - may contain multiple values
                const dupBytes = this.parseDB(dupContent, currentAddress);

                for (let i = 0; i < count; i++) {
                    for (const b of dupBytes) {
                        result.push(b);
                    }
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
            // $ = current address/offset location counter
            result.push(currentAddress !== undefined ? (currentAddress & 0xff) : 0);
        } else {
            const parsedValue = this.parseImmediate(value);
            result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
        }
    }
    return result;
};

Assembler.prototype.parseDW = function(dataPart, currentAddress) {
    const result = [];
    const dataWithoutComment = dataPart.split(';')[0].trim();

    // Split by commas, respecting strings and parentheses
    const values = [];
    let currentValue = '';
    let inString = false;
    let stringDelimiter = '';
    let parenDepth = 0;

    for (let i = 0; i < dataWithoutComment.length; i++) {
        const char = dataWithoutComment[i];

        if ((char === "'" || char === '"') && !inString) {
            inString = true;
            stringDelimiter = char;
            currentValue += char;
        } else if (char === stringDelimiter && inString) {
            inString = false;
            currentValue += char;
        } else if (char === '(' && !inString) {
            parenDepth++;
            currentValue += char;
        } else if (char === ')' && !inString) {
            parenDepth--;
            currentValue += char;
        } else if (char === ',' && !inString && parenDepth === 0) {
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
                const dupContent = value.substring(valueStart, valueEnd).trim();

                // Parse content inside DUP() recursively
                const dupWords = this.parseDW(dupContent, currentAddress);
                for (let i = 0; i < count; i++) {
                    for (const b of dupWords) {
                        result.push(b);
                    }
                }
            }
        } else if (value === '$') {
            const addr = currentAddress !== undefined ? currentAddress : 0;
            result.push(addr & 0xff);
            result.push((addr >> 8) & 0xff);
        } else {
            const parsedValue = this.parseImmediate(value);
            result.push(isNaN(parsedValue) ? 0 : (parsedValue & 0xff));
            result.push(isNaN(parsedValue) ? 0 : ((parsedValue >> 8) & 0xff));
        }
    }
    return result;
};

Assembler.prototype.parseDD = function(dataPart, currentAddress) {
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

Assembler.prototype.parseDQ = function(dataPart, currentAddress) {
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

Assembler.prototype.parseDT = function(dataPart, currentAddress) {
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
