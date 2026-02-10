Assembler.prototype.writeInstructionToMemory = function(instruction) {
    for (let i = 0; i < instruction.machineCode.length; i++) {
        this.memory.write8(instruction.address + i, instruction.machineCode[i]);
    }
};

Assembler.prototype.loadFromFile = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const code = e.target.result;
            const instructions = this.parse(code);
            resolve(instructions);
        };
        reader.onerror = (e) => {
            reject(new Error('文件读取失败'));
        };
        reader.readAsText(file);
    });
};

Assembler.prototype.getInstructions = function() {
    return this.instructions;
};

Assembler.prototype.getSymbols = function() {
    return this.symbols;
};

Assembler.prototype.writeDataSegmentToMemory = function(cpu) {
    const ds = cpu.getSegmentRegister('ds');
    const dataSegmentBase = (ds << 4);

    for (const data of this.dataSegments) {
        const dataAddress = dataSegmentBase + data.offset;
        for (let i = 0; i < data.data.length; i++) {
            this.memory.write8(dataAddress + i, data.data[i]);
        }
    }
};

Assembler.prototype.writeCodeSegmentToMemory = function(cpu) {
    const cs = cpu.getSegmentRegister('cs');
    const codeSegmentBase = (cs << 4);

    for (const instruction of this.instructions) {
        const instructionAddress = codeSegmentBase + instruction.address;
        for (let i = 0; i < instruction.machineCode.length; i++) {
            this.memory.write8(instructionAddress + i, instruction.machineCode[i]);
        }
    }

    for (const data of this.codeDataSegments) {
        const dataAddress = codeSegmentBase + data.offset;
        for (let i = 0; i < data.data.length; i++) {
            this.memory.write8(dataAddress + i, data.data[i]);
        }
    }
};