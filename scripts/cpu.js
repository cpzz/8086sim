class CPU8086 {
    constructor(memory) {
        this.memory = memory;
        
        // 模拟DOS加载程序后的寄存器状态
        this.registers = {
            ax: 0, // 程序返回码
            bx: 0x0000, // 环境块段地址
            cx: 0, // 命令行参数长度
            dx: 0, // 其他信息
            si: 0,
            di: 0,
            sp: 0xfffe, // 栈指针
            bp: 0
        };
        
        // 段寄存器初始化（按照DOS EXE程序标准，不同段）
        this.segmentRegisters = {
            cs: 0x1000, // 代码段
            ds: 0x2000, // 数据段
            ss: 0x3000, // 堆栈段
            es: 0x4000  // 附加段
        };
        
        // 指令指针（从0开始，与指令地址匹配）
        this.ip = 0x0000;
        
        // 标志位
        this.flags = {
            cf: 0, // 进位标志
            pf: 0, // 奇偶标志
            af: 0, // 辅助进位标志
            zf: 0, // 零标志
            sf: 0, // 符号标志
            tf: 0, // 陷阱标志
            if: 1, // 中断允许标志（DOS默认开启）
            df: 0, // 方向标志
            of: 0  // 溢出标志
        };
        
        // 断点
        this.breakpoints = new Set();

        // 运行状态
        this.running = false;
        this.currentInstruction = null;

        // 内存操作跟踪
        this.memoryOperations = new Map(); // 地址 -> {type: 'read'|'write', value: number}

        // 寄存器操作跟踪
        this.registerOperations = new Map(); // 寄存器名称 -> {type: 'read'|'write', value: number}

        // 显示输出缓冲区
        this.outputBuffer = '';

        // 键盘输入缓冲区
        this.keyboardBuffer = [];

        // 键盘输入等待标志
        this.waitingForKey = false;

        // 更新显示控制的回调函数
        this.updateOutputDisplay = null;

        // 键盘输入回调函数
        this.waitForKeyPress = null;
    }
    
    // 获取寄存器值（16位）
    getRegister(name) {
        const regName = name.toLowerCase();
        const value = this.registers[regName] || 0;
        // 跟踪寄存器读取操作，但不要覆盖已有的写入操作
        if (!this.registerOperations.has(regName) || this.registerOperations.get(regName).type !== 'write') {
            this.registerOperations.set(regName, { type: 'read', value });
        }
        return value;
    }
    
    // 设置寄存器值（16位）
    setRegister(name, value) {
        const regName = name.toLowerCase();

        // 处理IP寄存器（特殊情况，不是registers对象的属性）
        if (regName === 'ip') {
            const oldValue = this.ip;
            this.ip = value & 0xffff; // 确保16位
            // 跟踪寄存器写入操作
            this.registerOperations.set(regName, { type: 'write', value: this.ip, oldValue });
            return;
        }

        // 处理普通寄存器
        if (this.registers.hasOwnProperty(regName)) {
            const oldValue = this.registers[regName];
            this.registers[regName] = value & 0xffff; // 确保16位
            // 跟踪寄存器写入操作
            this.registerOperations.set(regName, { type: 'write', value: this.registers[regName], oldValue });
        }
    }
    
    // 获取段寄存器值
    getSegmentRegister(name) {
        const regName = name.toLowerCase();
        const value = this.segmentRegisters[regName] || 0;
        // 跟踪段寄存器读取操作
        this.registerOperations.set(regName, { type: 'read', value });
        return value;
    }
    
    // 设置段寄存器值
    setSegmentRegister(name, value) {
        const regName = name.toLowerCase();
        if (this.segmentRegisters.hasOwnProperty(regName)) {
            const oldValue = this.segmentRegisters[regName];
            this.segmentRegisters[regName] = value & 0xffff; // 确保16位
            // 跟踪段寄存器写入操作
            this.registerOperations.set(regName, { type: 'write', value: this.segmentRegisters[regName], oldValue });
        }
    }
    
    // 获取标志位
    getFlag(name) {
        return this.flags[name.toLowerCase()] || 0;
    }
    
    // 设置标志位
    setFlag(name, value) {
        name = name.toLowerCase();
        if (this.flags.hasOwnProperty(name)) {
            this.flags[name] = value ? 1 : 0;
        }
    }
    
    // 获取内存地址（考虑段寄存器）
    getMemoryAddress(segment, offset) {
        return (segment << 4) + offset;
    }
    
    // 读取内存（16位）
    readMemory16(address) {
        const value = this.memory.read16(address);
        // 跟踪内存读取操作
        this.memoryOperations.set(address, { type: 'read', value });
        this.memoryOperations.set(address + 1, { type: 'read', value: (value >> 8) & 0xff });
        return value;
    }
    
    // 写入内存（16位）
    writeMemory16(address, value) {
        this.memory.write16(address, value);
        // 跟踪内存写入操作
        this.memoryOperations.set(address, { type: 'write', value: value & 0xff });
        this.memoryOperations.set(address + 1, { type: 'write', value: (value >> 8) & 0xff });
    }
    
    // 读取内存（8位）
    readMemory8(address) {
        const value = this.memory.read8(address);
        // 跟踪内存读取操作
        this.memoryOperations.set(address, { type: 'read', value });
        return value;
    }
    
    // 写入内存（8位）
    writeMemory8(address, value) {
        this.memory.write8(address, value);
        // 跟踪内存写入操作
        this.memoryOperations.set(address, { type: 'write', value });
    }
    
    // 清除内存操作跟踪
    clearMemoryOperations() {
        this.memoryOperations.clear();
    }
    
    // 获取内存操作
    getMemoryOperations() {
        return this.memoryOperations;
    }
    
    // 清除寄存器操作跟踪
    clearRegisterOperations() {
        this.registerOperations.clear();
    }
    
    // 获取寄存器操作
    getRegisterOperations() {
        return this.registerOperations;
    }
    
    // 计算有效地址
    calculateEffectiveAddress(segmentReg, offsetReg) {
        const segment = this.getSegmentRegister(segmentReg);
        const offset = this.getRegister(offsetReg);
        return this.getMemoryAddress(segment, offset);
    }
    
    // 添加断点
    addBreakpoint(address) {
        this.breakpoints.add(address);
    }
    
    // 移除断点
    removeBreakpoint(address) {
        this.breakpoints.delete(address);
    }
    
    // 检查是否在断点处
    isAtBreakpoint() {
        // 断点存储的是偏移地址，直接用IP比较
        return this.breakpoints.has(this.ip);
    }
    
    // 重置CPU
    reset() {
        // 模拟DOS加载程序后的寄存器状态
        this.registers = {
            ax: 0, // 程序返回码
            bx: 0x0000, // 环境块段地址
            cx: 0, // 命令行参数长度
            dx: 0, // 其他信息
            si: 0,
            di: 0,
            sp: 0xfffe, // 栈指针
            bp: 0
        };
        
        // 段寄存器初始化（按照DOS EXE程序标准，不同段）
        this.segmentRegisters = {
            cs: 0x1000, // 代码段
            ds: 0x2000, // 数据段
            ss: 0x3000, // 堆栈段
            es: 0x4000  // 附加段
        };
        
        // 重置指令指针（从0开始，与指令地址匹配）
        this.ip = 0x0000;
        
        // 重置标志位
        this.flags = {
            cf: 0, // 进位标志
            pf: 0, // 奇偶标志
            af: 0, // 辅助进位标志
            zf: 0, // 零标志
            sf: 0, // 符号标志
            tf: 0, // 陷阱标志
            if: 1, // 中断允许标志（DOS默认开启）
            df: 0, // 方向标志
            of: 0  // 溢出标志
        };
        
        // 清空断点
        this.breakpoints.clear();
        
        // 清除内存操作跟踪
        this.clearMemoryOperations();

        // 重置键盘输入状态
        this.keyboardBuffer = [];
        this.waitingForKey = false;

        // 停止运行
        this.running = false;
        this.currentInstruction = null;
    }
    
    // 单步执行
    step() {
        // 读取当前指令
        const currentAddress = this.getMemoryAddress(this.getSegmentRegister('cs'), this.ip);
        const opcode = this.readMemory8(currentAddress);

        // 简单的指令解码和执行
        let instructionLength = 1;

        switch (opcode) {
            case 0x00: // ADD Eb, Gb
                // 简单实现，实际需要更复杂的寻址模式处理
                instructionLength = 2;
                break;
            case 0x02: // ADD Gb, Eb
                instructionLength = 2;
                break;
            case 0x03: // ADD Gv, Ev
                instructionLength = 2;
                break;
            case 0x04: // ADD AL, Ib
                const imm8 = this.readMemory8(currentAddress + 1);
                const al = this.getRegister('ax') & 0xff;
                const result = al + imm8;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (result & 0xff));
                // 设置标志位
                this.updateFlags8(result, al, imm8);
                instructionLength = 2;
                break;
            case 0x05: // ADD AX, Iv
                const imm16 = this.readMemory16(currentAddress + 1);
                const ax = this.getRegister('ax');
                const result16 = ax + imm16;
                this.setRegister('ax', result16 & 0xffff);
                // 设置标志位
                this.updateFlags16(result16, ax, imm16);
                instructionLength = 3;
                break;
            case 0x13: // ADC Gv, Ev (ADC r16, r/m16)
                const modrm13 = this.readMemory8(currentAddress + 1);
                const reg13 = (modrm13 >> 3) & 0x7;
                const mod13 = (modrm13 >> 6) & 0x3;
                const rm13 = modrm13 & 0x7;

                // 寄存器映射
                const regToName13 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName13 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod13 === 3) {
                    // 寄存器到寄存器 ADC
                    const srcValue13 = this.getRegister(rmToName13[rm13]);
                    const dstValue13 = this.getRegister(regToName13[reg13]);
                    const result13 = dstValue13 + srcValue13 + this.flags.cf;
                    this.setRegister(regToName13[reg13], result13 & 0xffff);
                    // 设置标志位
                    this.updateFlags16(result13, dstValue13, srcValue13 + this.flags.cf, 'add');
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod13}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x14: // ADC AL, Ib
                const imm8adc = this.readMemory8(currentAddress + 1);
                const aladc = this.getRegister('ax') & 0xff;
                const result8adc = aladc + imm8adc + this.flags.cf;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (result8adc & 0xff));
                // 设置标志位
                this.updateFlags8(result8adc, aladc, imm8adc + this.flags.cf, 'add');
                instructionLength = 2;
                break;
            case 0x15: // ADC AX, Iv
                const imm16adc = this.readMemory16(currentAddress + 1);
                const axadc = this.getRegister('ax');
                const result16adc = axadc + imm16adc + this.flags.cf;
                this.setRegister('ax', result16adc & 0xffff);
                // 设置标志位
                this.updateFlags16(result16adc, axadc, imm16adc + this.flags.cf, 'add');
                instructionLength = 3;
                break;
            case 0x19: // SBB r/m16, r16
                const modrm19 = this.readMemory8(currentAddress + 1);
                const reg19 = (modrm19 >> 3) & 0x7;
                const mod19 = (modrm19 >> 6) & 0x3;
                const rm19 = modrm19 & 0x7;

                // 寄存器映射
                const regToName19 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName19 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod19 === 3) {
                    // 寄存器到寄存器 SBB
                    const srcValue19 = this.getRegister(regToName19[reg19]);
                    const dstValue19 = this.getRegister(rmToName19[rm19]);
                    const carry19 = this.flags.cf;
                    const result19 = dstValue19 - srcValue19 - carry19;
                    this.setRegister(rmToName19[rm19], result19 & 0xffff);
                    this.updateFlags16(result19, dstValue19, srcValue19 + carry19, 'sub');
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod19}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x1b: // SBB r16, r/m16
                const modrm1b = this.readMemory8(currentAddress + 1);
                const reg1b = (modrm1b >> 3) & 0x7;
                const mod1b = (modrm1b >> 6) & 0x3;
                const rm1b = modrm1b & 0x7;

                // 寄存器映射
                const regToName1b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName1b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod1b === 3) {
                    // 寄存器到寄存器 SBB
                    const srcValue1b = this.getRegister(rmToName1b[rm1b]);
                    const dstValue1b = this.getRegister(regToName1b[reg1b]);
                    const carry1b = this.flags.cf;
                    const result1b = dstValue1b - srcValue1b - carry1b;
                    this.setRegister(regToName1b[reg1b], result1b & 0xffff);
                    this.updateFlags16(result1b, dstValue1b, srcValue1b + carry1b, 'sub');
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod1b}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x1c: // SBB AL, Ib
                const imm8sbb = this.readMemory8(currentAddress + 1);
                const alsbb = this.getRegister('ax') & 0xff;
                const carry1c = this.flags.cf;
                const result8sbb = alsbb - imm8sbb - carry1c;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (result8sbb & 0xff));
                // 设置标志位
                this.updateFlags8(result8sbb, alsbb, imm8sbb + carry1c, 'sub');
                instructionLength = 2;
                break;
            case 0x1d: // SBB AX, Iv
                const imm16sbb = this.readMemory16(currentAddress + 1);
                const axsbb = this.getRegister('ax');
                const carry1d = this.flags.cf;
                const result16sbb = axsbb - imm16sbb - carry1d;
                this.setRegister('ax', result16sbb & 0xffff);
                // 设置标志位
                this.updateFlags16(result16sbb, axsbb, imm16sbb + carry1d, 'sub');
                instructionLength = 3;
                break;
            case 0xf9: // STC - 设置进位标志
                this.flags.cf = 1;
                instructionLength = 1;
                break;
            case 0xf8: // CLC - 清除进位标志
                this.flags.cf = 0;
                instructionLength = 1;
                break;
            case 0xf5: // CMC - 进位标志取反
                this.flags.cf = this.flags.cf ? 0 : 1;
                instructionLength = 1;
                break;
            case 0x2c: // SUB AL, Ib
                const imm8sub = this.readMemory8(currentAddress + 1);
                const alsub = this.getRegister('ax') & 0xff;
                const resultsub = alsub - imm8sub;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (resultsub & 0xff));
                // 设置标志位
                this.updateFlags8(resultsub, alsub, imm8sub, 'sub');
                instructionLength = 2;
                break;
            case 0x2d: // SUB AX, Iv
                const imm16sub = this.readMemory16(currentAddress + 1);
                const axsub = this.getRegister('ax');
                const resultsub16 = axsub - imm16sub;
                this.setRegister('ax', resultsub16 & 0xffff);
                // 设置标志位
                this.updateFlags16(resultsub16, axsub, imm16sub, 'sub');
                instructionLength = 3;
                break;
            case 0x29: // SUB r/m16, r16
                const modrm29 = this.readMemory8(currentAddress + 1);
                const reg29 = (modrm29 >> 3) & 0x7;
                const mod29 = (modrm29 >> 6) & 0x3;
                const rm29 = modrm29 & 0x7;

                // 寄存器映射
                const regToName29 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName29 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod29 === 3) {
                    // 寄存器到寄存器 SUB
                    const srcValue29 = this.getRegister(regToName29[reg29]);
                    const dstValue29 = this.getRegister(rmToName29[rm29]);
                    const result29 = dstValue29 - srcValue29;
                    this.setRegister(rmToName29[rm29], result29 & 0xffff);
                    this.updateFlags16(result29, dstValue29, srcValue29, 'sub');
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod29}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x2b: // SUB r16, r/m16
                const modrm2b = this.readMemory8(currentAddress + 1);
                const reg2b = (modrm2b >> 3) & 0x7;
                const mod2b = (modrm2b >> 6) & 0x3;
                const rm2b = modrm2b & 0x7;

                // 寄存器映射
                const regToName2b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName2b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod2b === 3) {
                    // 寄存器到寄存器 SUB
                    const srcValue2b = this.getRegister(rmToName2b[rm2b]);
                    const dstValue2b = this.getRegister(regToName2b[reg2b]);
                    const result2b = dstValue2b - srcValue2b;
                    this.setRegister(regToName2b[reg2b], result2b & 0xffff);
                    this.updateFlags16(result2b, dstValue2b, srcValue2b, 'sub');
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod2b}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x24: // AND AL, Ib
                const imm8and = this.readMemory8(currentAddress + 1);
                const aland = this.getRegister('ax') & 0xff;
                const resultand = aland & imm8and;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (resultand & 0xff));
                // 设置标志位
                this.updateFlags8(resultand, aland, imm8and);
                instructionLength = 2;
                break;
            case 0x25: // AND AX, Iv
                const imm16and = this.readMemory16(currentAddress + 1);
                const axand = this.getRegister('ax');
                const resultand16 = axand & imm16and;
                this.setRegister('ax', resultand16 & 0xffff);
                // 设置标志位
                this.updateFlags16(resultand16, axand, imm16and);
                instructionLength = 3;
                break;
            case 0x0c: // OR AL, Ib
                const imm8or = this.readMemory8(currentAddress + 1);
                const alor = this.getRegister('ax') & 0xff;
                const resultor = alor | imm8or;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (resultor & 0xff));
                // 设置标志位
                this.updateFlags8(resultor, alor, imm8or);
                instructionLength = 2;
                break;
            case 0x0d: // OR AX, Iv
                const imm16or = this.readMemory16(currentAddress + 1);
                const axor = this.getRegister('ax');
                const resultor16 = axor | imm16or;
                this.setRegister('ax', resultor16 & 0xffff);
                // 设置标志位
                this.updateFlags16(resultor16, axor, imm16or);
                instructionLength = 3;
                break;
            case 0x34: // XOR AL, Ib
                const imm8xor = this.readMemory8(currentAddress + 1);
                const alxor = this.getRegister('ax') & 0xff;
                const resultxor = alxor ^ imm8xor;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (resultxor & 0xff));
                // 设置标志位
                this.updateFlags8(resultxor, alxor, imm8xor);
                instructionLength = 2;
                break;
            case 0x35: // XOR AX, Iv
                const imm16xor = this.readMemory16(currentAddress + 1);
                const axxor = this.getRegister('ax');
                const resultxor16 = axxor ^ imm16xor;
                this.setRegister('ax', resultxor16 & 0xffff);
                // 设置标志位
                this.updateFlags16(resultxor16, axxor, imm16xor);
                instructionLength = 3;
                break;
            case 0x31: // XOR r/m16, r16
                const modrm31 = this.readMemory8(currentAddress + 1);
                const reg31 = (modrm31 >> 3) & 0x7;
                const mod31 = (modrm31 >> 6) & 0x3;
                const rm31 = modrm31 & 0x7;

                // 寄存器映射
                const regToName31 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName31 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod31 === 3) {
                    // 寄存器到寄存器 XOR
                    const srcValue = this.getRegister(regToName31[reg31]);
                    const dstValue = this.getRegister(rmToName31[rm31]);
                    const result31 = dstValue ^ srcValue;
                    this.setRegister(rmToName31[rm31], result31 & 0xffff);
                    this.updateFlags16(result31, dstValue, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod31}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x21: // AND r/m16, r16
                const modrm21 = this.readMemory8(currentAddress + 1);
                const reg21 = (modrm21 >> 3) & 0x7;
                const mod21 = (modrm21 >> 6) & 0x3;
                const rm21 = modrm21 & 0x7;

                // 寄存器映射
                const regToName21 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName21 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod21 === 3) {
                    // 寄存器到寄存器 AND
                    const srcValue21 = this.getRegister(regToName21[reg21]);
                    const dstValue21 = this.getRegister(rmToName21[rm21]);
                    const result21 = dstValue21 & srcValue21;
                    this.setRegister(rmToName21[rm21], result21 & 0xffff);
                    this.updateFlags16(result21, dstValue21, srcValue21);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod21}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x23: // AND r/m16, r16
                const modrm23 = this.readMemory8(currentAddress + 1);
                const reg23 = (modrm23 >> 3) & 0x7;
                const mod23 = (modrm23 >> 6) & 0x3;
                const rm23 = modrm23 & 0x7;

                // 寄存器映射
                const regToName23 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName23 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod23 === 3) {
                    // 寄存器到寄存器 AND
                    const srcValue = this.getRegister(regToName23[reg23]);
                    const dstValue = this.getRegister(rmToName23[rm23]);
                    const result23 = dstValue & srcValue;
                    this.setRegister(rmToName23[rm23], result23 & 0xffff);
                    this.updateFlags16(result23, dstValue, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod23}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x09: // OR r/m16, r16
                const modrm09 = this.readMemory8(currentAddress + 1);
                const reg09 = (modrm09 >> 3) & 0x7;
                const mod09 = (modrm09 >> 6) & 0x3;
                const rm09 = modrm09 & 0x7;

                // 寄存器映射
                const regToName09 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName09 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod09 === 3) {
                    // 寄存器到寄存器 OR
                    const srcValue = this.getRegister(regToName09[reg09]);
                    const dstValue = this.getRegister(rmToName09[rm09]);
                    const result09 = dstValue | srcValue;
                    this.setRegister(rmToName09[rm09], result09 & 0xffff);
                    this.updateFlags16(result09, dstValue, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod09}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x01: // ADD r/m16, r16
                const modrm01 = this.readMemory8(currentAddress + 1);
                const reg01 = (modrm01 >> 3) & 0x7;
                const mod01 = (modrm01 >> 6) & 0x3;
                const rm01 = modrm01 & 0x7;

                // 寄存器映射
                const regToName01 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName01 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod01 === 3) {
                    // 寄存器到寄存器 ADD
                    const srcValue = this.getRegister(regToName01[reg01]);
                    const dstValue = this.getRegister(rmToName01[rm01]);
                    const result01 = dstValue + srcValue;
                    this.setRegister(rmToName01[rm01], result01 & 0xffff);
                    this.updateFlags16(result01, dstValue, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod01}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x8b: // MOV Gv, Ev (Gv是目标，Ev是源)
                const modrm8b = this.readMemory8(currentAddress + 1);
                const reg8b = (modrm8b >> 3) & 0x7;
                const rm8b = modrm8b & 0x7;
                const mod8b = (modrm8b >> 6) & 0x3;

                // 目标寄存器映射 (reg字段)
                const regToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod8b === 3) {
                    // 寄存器到寄存器传送
                    const srcRegToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                    this.setRegister(regToName[reg8b], this.getRegister(srcRegToName[rm8b]));
                    instructionLength = 2;
                } else if (mod8b === 0 && rm8b === 6) {
                    // 直接内存寻址 [disp16] - 从指令中提取16位地址
                    const disp16 = this.readMemory16(currentAddress + 2);
                    const address = this.getMemoryAddress(this.getSegmentRegister('ds'), disp16);
                    this.setRegister(regToName[reg8b], this.readMemory16(address));
                    instructionLength = 4;
                } else {
                    // 内存到寄存器传送
                    let address = null;
                    let disp = 0;

                    // 读取偏移量（如果有）
                    if (mod8b === 1) {
                        // 8位偏移量
                        disp = this.readMemory8(currentAddress + 2);
                        if (disp >= 128) disp -= 256; // 符号扩展
                    } else if (mod8b === 2) {
                        // 16位偏移量
                        disp = this.readMemory16(currentAddress + 2);
                        if (disp >= 32768) disp -= 65536; // 符号扩展
                    }

                    // 根据 r/m 字段确定寻址方式
                    if (rm8b === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp);
                    } else if (rm8b === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp);
                    } else if (rm8b === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp);
                    } else if (rm8b === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp);
                    } else if (rm8b === 4) {
                        // [SI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp);
                    } else if (rm8b === 5) {
                        // [DI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp);
                    } else if (rm8b === 6) {
                        // [BP]
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + disp);
                    } else if (rm8b === 7) {
                        // [BX]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp);
                    }

                    if (address !== null) {
                        this.setRegister(regToName[reg8b], this.readMemory16(address));
                        // 根据mod确定指令长度
                        if (mod8b === 0) {
                            instructionLength = 2;
                        } else if (mod8b === 1) {
                            instructionLength = 3; // 操作码 + modr/m + 8位偏移
                        } else if (mod8b === 2) {
                            instructionLength = 4; // 操作码 + modr/m + 16位偏移
                        }
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 0x${modrm8b.toString(16)}`);
                        this.running = false;
                        return false;
                    }
                }
                break;
            case 0x8a: // MOV Gb, Eb (Gb是目标，Eb是源) - 8位版本
                const modrm8a = this.readMemory8(currentAddress + 1);
                const reg8a = (modrm8a >> 3) & 0x7;
                const rm8a = modrm8a & 0x7;
                const mod8a = (modrm8a >> 6) & 0x3;

                // 目标8位寄存器映射 (reg字段) - 0=AL, 1=CL, 2=DL, 3=BL, 4=AH, 5=CH, 6=DH, 7=BH
                const regToName8 = ['ax', 'cx', 'dx', 'bx', 'ax', 'cx', 'dx', 'bx'];
                const isHighByte = [false, false, false, false, true, true, true, true]; // 是否操作高字节

                if (mod8a === 3) {
                    // 寄存器到寄存器传送 (8位)
                    const srcRegToName8 = ['ax', 'cx', 'dx', 'bx', 'ax', 'cx', 'dx', 'bx'];
                    const srcIsHighByte = [false, false, false, false, true, true, true, true];

                    const srcReg = srcRegToName8[rm8a];
                    const srcValue = this.getRegister(srcReg);
                    const srcByteValue = srcIsHighByte[rm8a] ? (srcValue >> 8) & 0xff : srcValue & 0xff;

                    const dstReg = regToName8[reg8a];
                    const dstValue = this.getRegister(dstReg);

                    if (isHighByte[reg8a]) {
                        this.setRegister(dstReg, (dstValue & 0x00ff) | (srcByteValue << 8));
                    } else {
                        this.setRegister(dstReg, (dstValue & 0xff00) | srcByteValue);
                    }
                    instructionLength = 2;
                } else if (mod8a === 0 && rm8a === 6) {
                    // 直接寻址模式：MOV r8, [disp16]
                    const offset16 = this.readMemory16(currentAddress + 2);
                    const address = this.getMemoryAddress(this.getSegmentRegister('ds'), offset16);
                    const byteValue = this.readMemory8(address);
                    const dstReg = regToName8[reg8a];
                    const dstValue = this.getRegister(dstReg);

                    if (isHighByte[reg8a]) {
                        this.setRegister(dstReg, (dstValue & 0x00ff) | (byteValue << 8));
                    } else {
                        this.setRegister(dstReg, (dstValue & 0xff00) | byteValue);
                    }
                    instructionLength = 4;
                } else {
                    // 内存到寄存器传送 (8位)
                    let address = null;
                    let disp = 0;

                    // 读取偏移量（如果有）
                    if (mod8a === 1) {
                        // 8位偏移量
                        disp = this.readMemory8(currentAddress + 2);
                        if (disp >= 128) disp -= 256; // 符号扩展
                    } else if (mod8a === 2) {
                        // 16位偏移量
                        disp = this.readMemory16(currentAddress + 2);
                        if (disp >= 32768) disp -= 65536; // 符号扩展
                    }

                    // 根据 r/m 字段确定寻址方式
                    if (rm8a === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp);
                    } else if (rm8a === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp);
                    } else if (rm8a === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp);
                    } else if (rm8a === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp);
                    } else if (rm8a === 4) {
                        // [SI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp);
                    } else if (rm8a === 5) {
                        // [DI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp);
                    } else if (rm8a === 6) {
                        // [BP]
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + disp);
                    } else if (rm8a === 7) {
                        // [BX]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp);
                    }

                    if (address !== null) {
                        const byteValue = this.readMemory8(address);
                        const dstReg = regToName8[reg8a];
                        const dstValue = this.getRegister(dstReg);

                        if (isHighByte[reg8a]) {
                            this.setRegister(dstReg, (dstValue & 0x00ff) | (byteValue << 8));
                        } else {
                            this.setRegister(dstReg, (dstValue & 0xff00) | byteValue);
                        }
                        // 根据mod确定指令长度
                        if (mod8a === 0) {
                            instructionLength = 2;
                        } else if (mod8a === 1) {
                            instructionLength = 3; // 操作码 + modr/m + 8位偏移
                        } else if (mod8a === 2) {
                            instructionLength = 4; // 操作码 + modr/m + 16位偏移
                        }
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 0x${modrm8a.toString(16)}`);
                        this.running = false;
                        return false;
                    }
                }
                break;
            case 0x88: // MOV Eb, Gb (Gb是源，Eb是目标) - 8位版本
                const modrm88 = this.readMemory8(currentAddress + 1);
                const reg88 = (modrm88 >> 3) & 0x7;
                const rm88 = modrm88 & 0x7;
                const mod88 = (modrm88 >> 6) & 0x3;

                // 源8位寄存器映射 (reg字段) - 0=AL, 1=CL, 2=DL, 3=BL, 4=AH, 5=CH, 6=DH, 7=BH
                const srcRegToName88 = ['ax', 'cx', 'dx', 'bx', 'ax', 'cx', 'dx', 'bx'];
                const srcIsHighByte88 = [false, false, false, false, true, true, true, true];

                // 获取源寄存器的8位值
                const srcReg88 = srcRegToName88[reg88];
                const srcValue88 = this.getRegister(srcReg88);
                const srcByteValue88 = srcIsHighByte88[reg88] ? (srcValue88 >> 8) & 0xff : srcValue88 & 0xff;

                if (mod88 === 3) {
                    // 寄存器到寄存器传送 (8位)
                    const dstRegToName88 = ['ax', 'cx', 'dx', 'bx', 'ax', 'cx', 'dx', 'bx'];
                    const dstIsHighByte88 = [false, false, false, false, true, true, true, true];
                    const dstReg88 = dstRegToName88[rm88];
                    const dstValue88 = this.getRegister(dstReg88);

                    if (dstIsHighByte88[rm88]) {
                        this.setRegister(dstReg88, (dstValue88 & 0x00ff) | (srcByteValue88 << 8));
                    } else {
                        this.setRegister(dstReg88, (dstValue88 & 0xff00) | srcByteValue88);
                    }
                    instructionLength = 2;
                } else if (mod88 === 0 && rm88 === 6) {
                    // 直接寻址模式：MOV m8, r8 - [disp16]
                    const offset16 = this.readMemory16(currentAddress + 2);
                    const address = this.getMemoryAddress(this.getSegmentRegister('ds'), offset16);
                    this.writeMemory8(address, srcByteValue88);
                    this.memoryOperations.set(address, { type: 'write', value: srcByteValue88 });
                    instructionLength = 4;
                } else {
                    // 寄存器到内存传送 (8位)
                    let address = null;
                    let disp = 0;
                    let segmentReg = 'ds';

                    // 读取偏移量（如果有）
                    if (mod88 === 1) {
                        // 8位偏移量
                        disp = this.readMemory8(currentAddress + 2);
                        if (disp >= 128) disp -= 256; // 符号扩展
                    } else if (mod88 === 2) {
                        // 16位偏移量
                        disp = this.readMemory16(currentAddress + 2);
                        if (disp >= 32768) disp -= 65536; // 符号扩展
                    }

                    // 根据 r/m 字段确定寻址方式
                    if (rm88 === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp);
                    } else if (rm88 === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp);
                    } else if (rm88 === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp);
                    } else if (rm88 === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp);
                    } else if (rm88 === 4) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp);
                    } else if (rm88 === 5) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp);
                    } else if (rm88 === 6) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + disp);
                    } else if (rm88 === 7) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp);
                    }

                    if (address !== null) {
                        this.writeMemory8(address, srcByteValue88);
                        // 根据mod确定指令长度
                        if (mod88 === 0) {
                            instructionLength = 2;
                        } else if (mod88 === 1) {
                            instructionLength = 3; // 操作码 + modr/m + 8位偏移
                        } else if (mod88 === 2) {
                            instructionLength = 4; // 操作码 + modr/m + 16位偏移
                        }
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 0x${modrm88.toString(16)}`);
                        this.running = false;
                        return false;
                    }
                }
                break;
            case 0x89: // MOV Ev, Gv (Gv是源，Ev是目标)
                const modrm89 = this.readMemory8(currentAddress + 1);
                const reg89 = (modrm89 >> 3) & 0x7;
                const rm89 = modrm89 & 0x7;
                const mod89 = (modrm89 >> 6) & 0x3;

                // 源寄存器映射 (reg字段)
                const srcRegToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod89 === 3) {
                    // 寄存器到寄存器传送
                    const dstRegToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                    this.setRegister(dstRegToName[rm89], this.getRegister(srcRegToName[reg89]));
                    instructionLength = 2;
                } else if (mod89 === 0 && rm89 === 6) {
                    // 直接寻址模式：MOV m16, r16 - [disp16]
                    // 读取偏移量
                    const offset16 = this.readMemory16(currentAddress + 2);
                    // 计算内存地址（使用 DS 段）
                    const address = this.getMemoryAddress(this.getSegmentRegister('ds'), offset16);
                    // 读取源寄存器值
                    const srcValue = this.getRegister(srcRegToName[reg89]);
                    // 写入内存
                    this.writeMemory16(address, srcValue);
                    // 跟踪内存写入操作
                    this.memoryOperations.set(address, { type: 'write', value: srcValue });
                    instructionLength = 4;
                } else {
                    // 寄存器到内存传送
                    let address = null;
                    let disp = 0;

                    // 读取偏移量（如果有）
                    if (mod89 === 1) {
                        // 8位偏移量
                        disp = this.readMemory8(currentAddress + 2);
                        if (disp >= 128) disp -= 256; // 符号扩展
                    } else if (mod89 === 2) {
                        // 16位偏移量
                        disp = this.readMemory16(currentAddress + 2);
                        if (disp >= 32768) disp -= 65536; // 符号扩展
                    }

                    // 根据 r/m 字段确定寻址方式
                    if (rm89 === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp);
                    } else if (rm89 === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp);
                    } else if (rm89 === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp);
                    } else if (rm89 === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp);
                    } else if (rm89 === 4) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp);
                    } else if (rm89 === 5) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp);
                    } else if (rm89 === 6) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + disp);
                    } else if (rm89 === 7) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp);
                    }

                    if (address !== null) {
                        this.writeMemory16(address, this.getRegister(srcRegToName[reg89]));
                        // 根据mod确定指令长度
                        if (mod89 === 0) {
                            instructionLength = 2;
                        } else if (mod89 === 1) {
                            instructionLength = 3; // 操作码 + modr/m + 8位偏移
                        } else if (mod89 === 2) {
                            instructionLength = 4; // 操作码 + modr/m + 16位偏移
                        }
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 0x${modrm89.toString(16)}`);
                        this.running = false;
                        return false;
                    }
                }
                break;
            case 0xb0: // MOV AL, imm8
                const imm8al = this.readMemory8(currentAddress + 1);
                const currentAx = this.getRegister('ax');
                this.setRegister('ax', (currentAx & 0xff00) | imm8al);
                instructionLength = 2;
                break;
            case 0xb1: // MOV CL, imm8
                const imm8cl = this.readMemory8(currentAddress + 1);
                const currentCx = this.getRegister('cx');
                this.setRegister('cx', (currentCx & 0xff00) | imm8cl);
                instructionLength = 2;
                break;
            case 0xb2: // MOV DL, imm8
                const imm8dl = this.readMemory8(currentAddress + 1);
                const currentDx = this.getRegister('dx');
                this.setRegister('dx', (currentDx & 0xff00) | imm8dl);
                instructionLength = 2;
                break;
            case 0xb3: // MOV BL, imm8
                const imm8bl = this.readMemory8(currentAddress + 1);
                const currentBx = this.getRegister('bx');
                this.setRegister('bx', (currentBx & 0xff00) | imm8bl);
                instructionLength = 2;
                break;
            case 0xb4: // MOV AH, imm8
                const imm8ah = this.readMemory8(currentAddress + 1);
                const currentAh = this.getRegister('ax');
                this.setRegister('ax', (currentAh & 0x00ff) | (imm8ah << 8));
                instructionLength = 2;
                break;
            case 0xb5: // MOV CH, imm8
                const imm8ch = this.readMemory8(currentAddress + 1);
                const currentCh = this.getRegister('cx');
                this.setRegister('cx', (currentCh & 0x00ff) | (imm8ch << 8));
                instructionLength = 2;
                break;
            case 0xb6: // MOV DH, imm8
                const imm8dh = this.readMemory8(currentAddress + 1);
                const currentDh = this.getRegister('dx');
                this.setRegister('dx', (currentDh & 0x00ff) | (imm8dh << 8));
                instructionLength = 2;
                break;
            case 0xb7: // MOV BH, imm8
                const imm8bh = this.readMemory8(currentAddress + 1);
                const currentBh = this.getRegister('bx');
                this.setRegister('bx', (currentBh & 0x00ff) | (imm8bh << 8));
                instructionLength = 2;
                break;
            case 0xb8: // MOV AX, imm16
                const imm16ax = this.readMemory16(currentAddress + 1);
                this.setRegister('ax', imm16ax);
                instructionLength = 3;
                break;
            case 0xbb: // MOV BX, imm16
                const imm16bx = this.readMemory16(currentAddress + 1);
                this.setRegister('bx', imm16bx);
                instructionLength = 3;
                break;
            case 0xb9: // MOV CX, imm16
                const imm16cx = this.readMemory16(currentAddress + 1);
                this.setRegister('cx', imm16cx);
                instructionLength = 3;
                break;
            case 0xba: // MOV DX, imm16
                const imm16dx = this.readMemory16(currentAddress + 1);
                this.setRegister('dx', imm16dx);
                instructionLength = 3;
                break;
            case 0xbe: // MOV SI, imm16
                const imm16si = this.readMemory16(currentAddress + 1);
                this.setRegister('si', imm16si);
                instructionLength = 3;
                break;
            case 0xbf: // MOV DI, imm16
                const imm16di = this.readMemory16(currentAddress + 1);
                this.setRegister('di', imm16di);
                instructionLength = 3;
                break;
            case 0xbd: // MOV BP, imm16
                const imm16bp = this.readMemory16(currentAddress + 1);
                this.setRegister('bp', imm16bp);
                instructionLength = 3;
                break;
            case 0xbc: // MOV SP, imm16
                const imm16sp = this.readMemory16(currentAddress + 1);
                this.setRegister('sp', imm16sp);
                instructionLength = 3;
                break;
            case 0x90: // NOP
                instructionLength = 1;
                break;
            case 0x91: // XCHG AX, CX
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('cx'));
                    this.setRegister('cx', temp);
                    instructionLength = 1;
                }
                break;
            case 0x92: // XCHG AX, DX
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('dx'));
                    this.setRegister('dx', temp);
                    instructionLength = 1;
                }
                break;
            case 0x93: // XCHG AX, BX
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('bx'));
                    this.setRegister('bx', temp);
                    instructionLength = 1;
                }
                break;
            case 0x94: // XCHG AX, SP
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('sp'));
                    this.setRegister('sp', temp);
                    instructionLength = 1;
                }
                break;
            case 0x95: // XCHG AX, BP
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('bp'));
                    this.setRegister('bp', temp);
                    instructionLength = 1;
                }
                break;
            case 0x96: // XCHG AX, SI
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('si'));
                    this.setRegister('si', temp);
                    instructionLength = 1;
                }
                break;
            case 0x97: // XCHG AX, DI
                {
                    const temp = this.getRegister('ax');
                    this.setRegister('ax', this.getRegister('di'));
                    this.setRegister('di', temp);
                    instructionLength = 1;
                }
                break;
            case 0x9c: // PUSHF - 将标志寄存器压入堆栈
                {
                    const flags = this.getFlags();
                    const currentSP = this.getRegister('sp');
                    const newSP = currentSP - 2;
                    this.setRegister('sp', newSP);
                    const address = this.getMemoryAddress(this.getSegmentRegister('ss'), newSP);
                    this.writeMemory16(address, flags);
                    instructionLength = 1;
                }
                break;
            case 0x9d: // POPF - 从堆栈弹出标志寄存器
                {
                    const currentSP = this.getRegister('sp');
                    const address = this.getMemoryAddress(this.getSegmentRegister('ss'), currentSP);
                    const flags = this.readMemory16(address);
                    this.setFlags(flags);
                    this.setRegister('sp', currentSP + 2);
                    instructionLength = 1;
                }
                break;
            case 0xc3: // RET
                const currentSP = this.getRegister('sp');
                if (currentSP === 0xfffe) {
                    // 没有调用过函数，执行完最后一条指令
                    // 保持SP为初始值，符合DOS行为
                    // 设置IP为0xffff，表明无法继续执行
                    this.setRegister('ip', 0xffff);
                    return false; // 没有返回地址，停止执行
                } else {
                    // 正常情况，从堆栈弹出返回地址
                    const returnAddress = this.readMemory16(this.getMemoryAddress(this.getSegmentRegister('ss'), currentSP));
                    this.setRegister('sp', currentSP + 2);
                    this.setRegister('ip', returnAddress);
                }
                // 对于RET指令，不需要再增加IP，因为已经设置了returnAddress
                instructionLength = 0;
                break;
            case 0xcd: // INT imm8
                const interruptNum = this.readMemory8(currentAddress + 1);

                // 调用对应的中断处理程序
                if (interruptNum === 0x21) {
                    // INT 21h - DOS功能调用
                    const result = this.handleInt21();
                    if (!result) {
                        return false; // 暂停执行（如等待输入）
                    }
                    // handler已经更新了IP，不需要再增加
                    instructionLength = 0;
                } else if (interruptNum === 0x16) {
                    // INT 16h - BIOS键盘服务
                    const result = this.handleInt16();
                    if (!result) {
                        return false; // 暂停执行（如等待输入）
                    }
                    // handler已经更新了IP，不需要再增加
                    instructionLength = 0;
                } else {
                    // 其他中断，简单处理
                    instructionLength = 2;
                }
                break;
            case 0x40: // INC AX
            case 0x41: // INC CX
            case 0x42: // INC DX
            case 0x43: // INC BX
            case 0x44: // INC SP
            case 0x45: // INC BP
            case 0x46: // INC SI
            case 0x47: // INC DI
                const regInc = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][opcode - 0x40];
                const valueInc = this.registers[regInc];
                this.setRegister(regInc, (valueInc + 1) & 0xffff);
                instructionLength = 1;
                break;
            case 0x48: // DEC AX
            case 0x49: // DEC CX
            case 0x4a: // DEC DX
            case 0x4b: // DEC BX
            case 0x4c: // DEC SP
            case 0x4d: // DEC BP
            case 0x4e: // DEC SI
            case 0x4f: // DEC DI
                const regDec = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][opcode - 0x48];
                const valueDec = this.registers[regDec];
                const newValueDec = (valueDec - 1) & 0xffff;
                this.setRegister(regDec, newValueDec);
                // 设置标志位
                this.flags.zf = (newValueDec === 0) ? 1 : 0;
                this.flags.sf = (newValueDec & 0x8000) ? 1 : 0;
                // 计算奇偶标志（基于低8位）
                let parityDec = 0;
                let valueParityDec = newValueDec & 0xff;
                for (let i = 0; i < 8; i++) {
                    parityDec += valueParityDec & 1;
                    valueParityDec >>= 1;
                }
                this.flags.pf = (parityDec % 2 === 0) ? 1 : 0;
                instructionLength = 1;
                break;
            case 0xf8: // CLC
                this.flags.cf = 0;
                instructionLength = 1;
                break;
            case 0xf9: // STC
                this.flags.cf = 1;
                instructionLength = 1;
                break;
            case 0xfc: // CLD
                this.flags.df = 0;
                instructionLength = 1;
                break;
            case 0xfd: // STD
                this.flags.df = 1;
                instructionLength = 1;
                break;
            case 0xfa: // CLI - 清除中断标志
                this.flags.if = 0;
                instructionLength = 1;
                break;
            case 0xfb: // STI - 设置中断标志
                this.flags.if = 1;
                instructionLength = 1;
                break;
            case 0xa8: // TEST AL, Ib
                {
                    const imm = this.readMemory8(currentAddress + 1);
                    const al = this.getRegister('ax') & 0xff;
                    const r = al & imm;
                    this.updateFlags8(r, al, imm, 'and'); // 只更新标志位
                    instructionLength = 2;
                }
                break;
            case 0xa9: // TEST AX, Iv
                {
                    const imm = this.readMemory16(currentAddress + 1);
                    const ax = this.getRegister('ax');
                    const r = ax & imm;
                    this.updateFlags16(r, ax, imm, 'and');
                    instructionLength = 3;
                }
                break;
            case 0xd0: // SHL/SHR/ROL/ROR r/m8, 1
                const modrm8 = this.readMemory8(currentAddress + 1);
                const reg8 = (modrm8 >> 3) & 0x7; // 0=ROL, 1=ROR, 4=SHL, 5=SHR
                const mod8 = (modrm8 >> 6) & 0x3;
                const rm8 = modrm8 & 0x7;

                // 寄存器映射 (r/m字段，当mod=11时)
                const rmToName8 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod8 === 3) {
                    // 寄存器操作（8位）
                    const destReg = rmToName8[rm8];
                    const oldValue = this.getRegister(destReg) & 0xff;
                    const highByte = this.getRegister(destReg) & 0xff00;
                    let result;
                    let carryOut;

                    if (reg8 === 0) {
                        // ROL - 循环左移
                        carryOut = (oldValue & 0x80) >> 7;
                        result = ((oldValue << 1) | carryOut) & 0xff;
                    } else if (reg8 === 1) {
                        // ROR - 循环右移
                        carryOut = oldValue & 0x01;
                        result = ((oldValue >> 1) | (carryOut << 7)) & 0xff;
                    } else if (reg8 === 4) {
                        // SHL
                        carryOut = (oldValue & 0x80) >> 7;
                        result = (oldValue << 1) & 0xff;
                    } else if (reg8 === 5) {
                        // SHR
                        carryOut = oldValue & 0x01;
                        result = (oldValue >> 1) & 0xff;
                    } else {
                        console.error(`执行错误: 不支持的移位操作码 ${reg8}`);
                        this.running = false;
                        return false;
                    }

                    this.setRegister(destReg, highByte | result);
                    // 设置标志位
                    this.flags.cf = carryOut;
                    this.flags.zf = (result === 0) ? 1 : 0;
                    this.flags.sf = (result & 0x80) ? 1 : 0;
                    // 计算奇偶标志
                    let parity = 0;
                    let value = result;
                    for (let i = 0; i < 8; i++) {
                        parity += value & 1;
                        value >>= 1;
                    }
                    this.flags.pf = (parity % 2 === 0) ? 1 : 0;
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod8}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0xd1: // SHL/SHR/ROL/ROR r/m16, 1
                const modrm16 = this.readMemory8(currentAddress + 1);
                const reg16 = (modrm16 >> 3) & 0x7; // 0=ROL, 1=ROR, 4=SHL, 5=SHR
                const mod16 = (modrm16 >> 6) & 0x3;
                const rm16 = modrm16 & 0x7;

                // 寄存器映射 (r/m字段，当mod=11时)
                const rmToName16 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod16 === 3) {
                    // 寄存器操作
                    const destReg = rmToName16[rm16];
                    const oldValue = this.getRegister(destReg);
                    let result;
                    let carryOut;

                    if (reg16 === 0) {
                        // ROL - 循环左移
                        carryOut = (oldValue & 0x8000) >> 15;
                        result = ((oldValue << 1) | carryOut) & 0xffff;
                    } else if (reg16 === 1) {
                        // ROR - 循环右移
                        carryOut = oldValue & 0x0001;
                        result = ((oldValue >> 1) | (carryOut << 15)) & 0xffff;
                    } else if (reg16 === 4) {
                        // SHL
                        carryOut = (oldValue & 0x8000) >> 15;
                        result = (oldValue << 1) & 0xffff;
                    } else if (reg16 === 5) {
                        // SHR
                        carryOut = oldValue & 0x0001;
                        result = (oldValue >> 1) & 0xffff;
                    } else {
                        console.error(`执行错误: 不支持的移位操作码 ${reg16}`);
                        this.running = false;
                        return false;
                    }

                    this.setRegister(destReg, result);
                    // 设置标志位
                    this.flags.cf = carryOut;
                    this.flags.zf = (result === 0) ? 1 : 0;
                    this.flags.sf = (result & 0x8000) ? 1 : 0;
                    // 计算奇偶标志（基于低8位）
                    let parity = 0;
                    let value = result & 0xff;
                    for (let i = 0; i < 8; i++) {
                        parity += value & 1;
                        value >>= 1;
                    }
                    this.flags.pf = (parity % 2 === 0) ? 1 : 0;
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod16}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0xf6: { // Group 3 r/m8
                const modrm = this.readMemory8(currentAddress + 1);
                const reg = (modrm >> 3) & 0x7;
                const mod = (modrm >> 6) & 0x3;
                const rm  = modrm & 0x7;
                if (mod !== 3) {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod}`);
                    this.running = false;
                    return false;
                }
                const regToName8 = ['ax','cx','dx','bx','ax','cx','dx','bx'];
                const isHigh     = [false,false,false,false,true,true,true,true];
                const base = regToName8[rm];
                let full = this.getRegister(base);
                let op8  = isHigh[rm] ? ((full >> 8) & 0xff) : (full & 0xff);

                switch (reg) {
                    case 2: { // NOT
                        const r = (~op8) & 0xff;
                        full = isHigh[rm] ? ((full & 0x00ff) | (r << 8))
                                           : ((full & 0xff00) | r);
                        this.setRegister(base, full);
                        instructionLength = 2;
                        break;
                    }
                    case 3: { // NEG
                        const r = (-op8) & 0xff;
                        full = isHigh[rm] ? ((full & 0x00ff) | (r << 8))
                                           : ((full & 0xff00) | r);
                        this.setRegister(base, full);
                        this.updateFlags8(r, 0, op8, 'sub');
                        this.flags.cf = op8 !== 0 ? 1 : 0;
                        instructionLength = 2;
                        break;
                    }
                    case 4: { // MUL (AL * r/m8 -> AX)
                        const al = this.getRegister('ax') & 0xff;
                        const prod = al * op8;
                        const ax = prod & 0xffff;
                        this.setRegister('ax', ax);
                        const ah = (ax >> 8) & 0xff;
                        this.flags.cf = this.flags.of = ah !== 0 ? 1 : 0;
                        instructionLength = 2;
                        break;
                    }
                    case 5: { // IMUL
                        let al = this.getRegister('ax') & 0xff;
                        let b  = op8;
                        if (al & 0x80) al -= 0x100;
                        if (b  & 0x80) b  -= 0x100;
                        const prod = al * b;
                        this.setRegister('ax', prod & 0xffff);
                        this.flags.cf = this.flags.of = (prod < -128 || prod > 127) ? 1 : 0;
                        instructionLength = 2;
                        break;
                    }
                    case 6: { // DIV
                        const ax = this.getRegister('ax') & 0xffff;
                        const d  = op8;
                        if (d === 0 || Math.floor(ax / d) > 0xff) {
                            console.error('执行错误: DIV 除法错误');
                            this.running = false;
                            return false;
                        }
                        const q = Math.floor(ax / d) & 0xff;
                        const r = (ax % d) & 0xff;
                        this.setRegister('ax', (r << 8) | q);
                        instructionLength = 2;
                        break;
                    }
                    case 7: { // IDIV
                        let ax = this.getRegister('ax') & 0xffff;
                        if (ax & 0x8000) ax -= 0x10000;
                        let d = op8;
                        if (d & 0x80) d -= 0x100;
                        if (d === 0) {
                            console.error('执行错误: IDIV 被0除');
                            this.running = false;
                            return false;
                        }
                        const q = (ax / d) | 0;
                        if (q < -128 || q > 127) {
                            console.error('执行错误: IDIV 商溢出');
                            this.running = false;
                            return false;
                        }
                        const r = ax - q * d;
                        const al = q & 0xff;
                        const ah = r & 0xff;
                        this.setRegister('ax', (ah << 8) | al);
                        instructionLength = 2;
                        break;
                    }
                    default:
                        console.error(`执行错误: 不支持的0xF6扩展操作码 ${reg}`);
                        this.running = false;
                        return false;
                }
                break;
            }
            case 0xf7: { // Group 3 r/m16
                const modrm = this.readMemory8(currentAddress + 1);
                const reg = (modrm >> 3) & 0x7;
                const mod = (modrm >> 6) & 0x3;
                const rm  = modrm & 0x7;
                if (mod !== 3) {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod}`);
                    this.running = false;
                    return false;
                }
                const rmToName = ['ax','cx','dx','bx','sp','bp','si','di'];
                const base = rmToName[rm];
                let op16 = this.getRegister(base);

                switch (reg) {
                    case 2: { // NOT
                        const r = (~op16) & 0xffff;
                        this.setRegister(base, r);
                        instructionLength = 2;
                        break;
                    }
                    case 3: { // NEG
                        const r = (-op16) & 0xffff;
                        this.setRegister(base, r);
                        this.updateFlags16(r, 0, op16, 'sub');
                        this.flags.cf = op16 !== 0 ? 1 : 0;
                        instructionLength = 2;
                        break;
                    }
                    case 4: { // MUL (AX * r/m16 -> DX:AX)
                        const ax = this.getRegister('ax') & 0xffff;
                        const prod = ax * (op16 & 0xffff);
                        const axr = prod & 0xffff;
                        const dxr = (prod >>> 16) & 0xffff;
                        this.setRegister('ax', axr);
                        this.setRegister('dx', dxr);
                        this.flags.cf = this.flags.of = dxr !== 0 ? 1 : 0;
                        instructionLength = 2;
                        break;
                    }
                    case 5: { // IMUL
                        let ax = this.getRegister('ax');
                        let b  = op16;
                        if (ax & 0x8000) ax -= 0x10000;
                        if (b  & 0x8000) b  -= 0x10000;
                        const prod = ax * b;
                        const axr = prod & 0xffff;
                        const dxr = (prod >> 16) & 0xffff;
                        this.setRegister('ax', axr);
                        this.setRegister('dx', dxr);
                        this.flags.cf = this.flags.of = (prod < -32768 || prod > 32767) ? 1 : 0;
                        instructionLength = 2;
                        break;
                    }
                    case 6: { // DIV (DX:AX / r/m16)
                        const ax = this.getRegister('ax') & 0xffff;
                        const dx = this.getRegister('dx') & 0xffff;
                        const dividend = (dx << 16) | ax;
                        const d = op16 & 0xffff;
                        if (d === 0 || Math.floor(dividend / d) > 0xffff) {
                            console.error('执行错误: DIV 除法错误');
                            this.running = false;
                            return false;
                        }
                        const q = Math.floor(dividend / d) & 0xffff;
                        const r = dividend % d;
                        this.setRegister('ax', q);
                        this.setRegister('dx', r & 0xffff);
                        instructionLength = 2;
                        break;
                    }
                    case 7: { // IDIV (有符号 DX:AX / r/m16)
                        let ax = this.getRegister('ax') & 0xffff;
                        let dx = this.getRegister('dx') & 0xffff;
                        let dividend = (dx << 16) | ax;
                        if (dx & 0x8000) dividend -= 0x100000000;
                        let d = op16 & 0xffff;
                        if (d & 0x8000) d -= 0x10000;
                        if (d === 0) {
                            console.error('执行错误: IDIV 被0除');
                            this.running = false;
                            return false;
                        }
                        const q = (dividend / d) | 0;
                        if (q < -32768 || q > 32767) {
                            console.error('执行错误: IDIV 商溢出');
                            this.running = false;
                            return false;
                        }
                        const r = dividend - q * d;
                        this.setRegister('ax', q & 0xffff);
                        this.setRegister('dx', r & 0xffff);
                        instructionLength = 2;
                        break;
                    }
                    default:
                        console.error(`执行错误: 不支持的0xF7扩展操作码 ${reg}`);
                        this.running = false;
                        return false;
                }
                break;
            }
            case 0x50: // PUSH AX
                this.setRegister('sp', this.getRegister('sp') - 2);
                const stackAddress = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.writeMemory16(stackAddress, this.getRegister('ax'));
                instructionLength = 1;
                break;
            case 0x51: // PUSH CX
                this.setRegister('sp', this.getRegister('sp') - 2);
                const stackAddress1 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.writeMemory16(stackAddress1, this.getRegister('cx'));
                instructionLength = 1;
                break;
            case 0x52: // PUSH DX
                this.setRegister('sp', this.getRegister('sp') - 2);
                const stackAddress2 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.writeMemory16(stackAddress2, this.getRegister('dx'));
                instructionLength = 1;
                break;
            case 0x53: // PUSH BX
                this.setRegister('sp', this.getRegister('sp') - 2);
                const stackAddress3 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.writeMemory16(stackAddress3, this.getRegister('bx'));
                instructionLength = 1;
                break;
            case 0x58: // POP AX
                const stackAddress4 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.setRegister('ax', this.readMemory16(stackAddress4));
                this.setRegister('sp', this.getRegister('sp') + 2);
                instructionLength = 1;
                break;
            case 0x59: // POP CX
                const stackAddress5 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.setRegister('cx', this.readMemory16(stackAddress5));
                this.setRegister('sp', this.getRegister('sp') + 2);
                instructionLength = 1;
                break;
            case 0x5a: // POP DX
                const stackAddress6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.setRegister('dx', this.readMemory16(stackAddress6));
                this.setRegister('sp', this.getRegister('sp') + 2);
                instructionLength = 1;
                break;
            case 0x5b: // POP BX
                const stackAddress7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.setRegister('bx', this.readMemory16(stackAddress7));
                this.setRegister('sp', this.getRegister('sp') + 2);
                instructionLength = 1;
                break;
            case 0xf3: { // REP前缀
                // 读取下一个字节以确定是哪种串操作
                const nextByte = this.readMemory8(currentAddress + 1);
                if (nextByte === 0xa4) { // REP MOVSB
                    const cx = this.getRegister('cx');
                    if (cx === 0) {
                        // CX=0，跳过REP MOVSB
                        instructionLength = 2;
                    } else {
                        // 执行一次MOVSB
                        const ds = this.getSegmentRegister('ds');
                        const es = this.getSegmentRegister('es');
                        const si = this.getRegister('si');
                        const di = this.getRegister('di');
                        const src = this.getMemoryAddress(ds, si);
                        const dst = this.getMemoryAddress(es, di);
                        const value = this.readMemory8(src);
                        this.writeMemory8(dst, value);
                        const delta = this.flags.df ? -1 : 1;
                        this.setRegister('si', (si + delta) & 0xffff);
                        this.setRegister('di', (di + delta) & 0xffff);
                        // CX减1
                        this.setRegister('cx', (cx - 1) & 0xffff);
                        // 如果CX不为0，重复执行REP MOVSB
                        if (this.getRegister('cx') !== 0) {
                            instructionLength = 0; // 不增加IP，重复执行
                        } else {
                            instructionLength = 2; // 执行完毕，跳过REP MOVSB
                        }
                    }
                } else if (nextByte === 0xa5) { // REP MOVSW
                    const cx = this.getRegister('cx');
                    if (cx === 0) {
                        instructionLength = 2;
                    } else {
                        const ds = this.getSegmentRegister('ds');
                        const es = this.getSegmentRegister('es');
                        const si = this.getRegister('si');
                        const di = this.getRegister('di');
                        const src = this.getMemoryAddress(ds, si);
                        const dst = this.getMemoryAddress(es, di);
                        const value = this.readMemory16(src);
                        this.writeMemory16(dst, value);
                        const delta = this.flags.df ? -2 : 2;
                        this.setRegister('si', (si + delta) & 0xffff);
                        this.setRegister('di', (di + delta) & 0xffff);
                        this.setRegister('cx', (cx - 1) & 0xffff);
                        if (this.getRegister('cx') !== 0) {
                            instructionLength = 0;
                        } else {
                            instructionLength = 2;
                        }
                    }
                } else {
                    console.error(`执行错误: 不支持的REP操作 0x${nextByte.toString(16)}`);
                    this.running = false;
                    return false;
                }
                break;
            }
            case 0xa4: { // MOVSB
                const ds = this.getSegmentRegister('ds');
                const es = this.getSegmentRegister('es');
                const si = this.getRegister('si');
                const di = this.getRegister('di');
                const src = this.getMemoryAddress(ds, si);
                const dst = this.getMemoryAddress(es, di);
                const value = this.readMemory8(src);
                this.writeMemory8(dst, value);
                const delta = this.flags.df ? -1 : 1;
                this.setRegister('si', (si + delta) & 0xffff);
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xa5: { // MOVSW
                const ds = this.getSegmentRegister('ds');
                const es = this.getSegmentRegister('es');
                const si = this.getRegister('si');
                const di = this.getRegister('di');
                const src = this.getMemoryAddress(ds, si);
                const dst = this.getMemoryAddress(es, di);
                const value = this.readMemory16(src);
                this.writeMemory16(dst, value);
                const delta = this.flags.df ? -2 : 2;
                this.setRegister('si', (si + delta) & 0xffff);
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xaa: { // STOSB
                const es = this.getSegmentRegister('es');
                const di = this.getRegister('di');
                const dst = this.getMemoryAddress(es, di);
                const al = this.getRegister('ax') & 0xff;
                this.writeMemory8(dst, al);
                const delta = this.flags.df ? -1 : 1;
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xab: { // STOSW
                const es = this.getSegmentRegister('es');
                const di = this.getRegister('di');
                const dst = this.getMemoryAddress(es, di);
                const ax = this.getRegister('ax');
                this.writeMemory16(dst, ax);
                const delta = this.flags.df ? -2 : 2;
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xac: { // LODSB
                const ds = this.getSegmentRegister('ds');
                const si = this.getRegister('si');
                const src = this.getMemoryAddress(ds, si);
                const value = this.readMemory8(src);
                const ax = this.getRegister('ax');
                this.setRegister('ax', (ax & 0xff00) | value);
                const delta = this.flags.df ? -1 : 1;
                this.setRegister('si', (si + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xad: { // LODSW
                const ds = this.getSegmentRegister('ds');
                const si = this.getRegister('si');
                const src = this.getMemoryAddress(ds, si);
                const value = this.readMemory16(src);
                this.setRegister('ax', value);
                const delta = this.flags.df ? -2 : 2;
                this.setRegister('si', (si + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xae: { // SCASB
                const es = this.getSegmentRegister('es');
                const di = this.getRegister('di');
                const dst = this.getMemoryAddress(es, di);
                const mem = this.readMemory8(dst);
                const al = this.getRegister('ax') & 0xff;
                const result = al - mem;
                this.updateFlags8(result, al, mem, 'sub');
                const delta = this.flags.df ? -1 : 1;
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xaf: { // SCASW
                const es = this.getSegmentRegister('es');
                const di = this.getRegister('di');
                const dst = this.getMemoryAddress(es, di);
                const mem = this.readMemory16(dst);
                const ax = this.getRegister('ax');
                const result = ax - mem;
                this.updateFlags16(result, ax, mem, 'sub');
                const delta = this.flags.df ? -2 : 2;
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xa6: { // CMPSB
                const ds = this.getSegmentRegister('ds');
                const es = this.getSegmentRegister('es');
                const si = this.getRegister('si');
                const di = this.getRegister('di');
                const src = this.getMemoryAddress(ds, si);
                const dst = this.getMemoryAddress(es, di);
                const left = this.readMemory8(src);
                const right = this.readMemory8(dst);
                const result = left - right;
                this.updateFlags8(result, left, right, 'sub');
                const delta = this.flags.df ? -1 : 1;
                this.setRegister('si', (si + delta) & 0xffff);
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xa7: { // CMPSW
                const ds = this.getSegmentRegister('ds');
                const es = this.getSegmentRegister('es');
                const si = this.getRegister('si');
                const di = this.getRegister('di');
                const src = this.getMemoryAddress(ds, si);
                const dst = this.getMemoryAddress(es, di);
                const left = this.readMemory16(src);
                const right = this.readMemory16(dst);
                const result = left - right;
                this.updateFlags16(result, left, right, 'sub');
                const delta = this.flags.df ? -2 : 2;
                this.setRegister('si', (si + delta) & 0xffff);
                this.setRegister('di', (di + delta) & 0xffff);
                instructionLength = 1;
                break;
            }
            case 0xE8: // CALL rel16 (近调用)
                const offset16 = this.readMemory16(currentAddress + 1);
                // 符号扩展
                const signedOffsetCall = offset16 > 0x7fff ? offset16 - 0x10000 : offset16;
                // 压入返回地址（下一条指令的地址）
                this.setRegister('sp', this.getRegister('sp') - 2);
                const returnAddr = this.ip + 3; // CALL指令长度为3字节
                const stackAddr = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
                this.writeMemory16(stackAddr, returnAddr);
                // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                this.ip = this.ip + 3 + signedOffsetCall;
                this.ip &= 0xffff;
                instructionLength = 0; // 不增加IP，因为已经手动设置了
                break;
            case 0x70: // JO short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (this.flags.of) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x71: // JNO short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (!this.flags.of) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x72: // JB/JNAE/JC short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (this.flags.cf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x73: // JNB/JAE/JNC short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (!this.flags.cf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x76: // JBE/JNA short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (this.flags.cf || this.flags.zf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x77: // JA/JNBE short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (!this.flags.cf && !this.flags.zf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x78: // JS short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (this.flags.sf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x79: // JNS short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (!this.flags.sf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x7a: // JP/JPE short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (this.flags.pf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x7b: // JNP/JPO short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (!this.flags.pf) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0x3c: // CMP AL, Ib
                const imm8cmp = this.readMemory8(currentAddress + 1);
                const alcmp = this.getRegister('ax') & 0xff;
                const resultcmp = alcmp - imm8cmp;
                // 设置标志位，但不修改寄存器
                this.flags.cf = (resultcmp < 0) ? 1 : 0;
                this.flags.zf = (resultcmp === 0) ? 1 : 0;
                this.flags.sf = (resultcmp < 0) ? 1 : 0;
                // 计算奇偶标志
                let paritycmp = 0;
                let valuecmp = resultcmp & 0xff;
                for (let i = 0; i < 8; i++) {
                    paritycmp += valuecmp & 1;
                    valuecmp >>= 1;
                }
                this.flags.pf = (paritycmp % 2 === 0) ? 1 : 0;
                // 辅助进位标志
                this.flags.af = (((alcmp & 0x0f) - (imm8cmp & 0x0f)) < 0) ? 1 : 0;
                // 溢出标志
                const signedResult = resultcmp > 0x7f ? resultcmp - 0x100 : resultcmp;
                const signedOperand1 = alcmp > 0x7f ? alcmp - 0x100 : alcmp;
                const signedOperand2 = imm8cmp > 0x7f ? imm8cmp - 0x100 : imm8cmp;
                this.flags.of = (signedResult !== signedOperand1 - signedOperand2) ? 1 : 0;
                instructionLength = 2;
                break;
            case 0x75: // JNZ/JNE short
                const offset75 = this.readMemory8(currentAddress + 1);
                const signedOffset75 = offset75 > 0x7f ? offset75 - 0x100 : offset75;
                if (!this.flags.zf) {
                    // ZF=0 时跳转
                    this.ip = this.ip + 2 + signedOffset75;
                    this.ip &= 0xffff;
                    instructionLength = 0;
                } else {
                    instructionLength = 2;
                }
                break;
            case 0x3d: // CMP AX, Iv
                const imm16cmp = this.readMemory16(currentAddress + 1);
                const axcmp = this.getRegister('ax');
                const result16cmp = axcmp - imm16cmp;
                // 设置标志位，但不修改寄存器
                this.flags.cf = (result16cmp < 0) ? 1 : 0;
                this.flags.zf = (result16cmp === 0) ? 1 : 0;
                this.flags.sf = (result16cmp < 0) ? 1 : 0;
                // 计算奇偶标志（基于低8位）
                let parity16cmp = 0;
                let value16cmp = result16cmp & 0xff;
                for (let i = 0; i < 8; i++) {
                    parity16cmp += value16cmp & 1;
                    value16cmp >>= 1;
                }
                this.flags.pf = (parity16cmp % 2 === 0) ? 1 : 0;
                // 辅助进位标志
                this.flags.af = (((axcmp & 0x0f) - (imm16cmp & 0x0f)) < 0) ? 1 : 0;
                // 溢出标志
                const signedResult16 = result16cmp > 0x7fff ? result16cmp - 0x10000 : result16cmp;
                const signedOperand116 = axcmp > 0x7fff ? axcmp - 0x10000 : axcmp;
                const signedOperand216 = imm16cmp > 0x7fff ? imm16cmp - 0x10000 : imm16cmp;
                this.flags.of = (signedResult16 !== signedOperand116 - signedOperand216) ? 1 : 0;
                instructionLength = 3;
                break;
            case 0x39: // CMP r/m16, r16
                const modrm39 = this.readMemory8(currentAddress + 1);
                const reg39 = (modrm39 >> 3) & 0x7;
                const mod39 = (modrm39 >> 6) & 0x3;
                const rm39 = modrm39 & 0x7;

                // 寄存器映射
                const regToName39 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const rmToName39 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod39 === 3) {
                    // 寄存器到寄存器 CMP
                    const srcValue = this.getRegister(regToName39[reg39]);
                    const dstValue = this.getRegister(rmToName39[rm39]);
                    const result39 = dstValue - srcValue;
                    // 设置标志位，但不修改寄存器
                    this.updateFlags16(result39, dstValue, srcValue, 'sub');
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod39}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0xe0: // LOOPNZ/LOOPNE short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    const cx = this.getRegister('cx');
                    const newCx = (cx - 1) & 0xffff;
                    this.setRegister('cx', newCx);
                    if (newCx !== 0 && this.flags.zf === 0) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0xe1: // LOOPZ/LOOPE short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    const cx = this.getRegister('cx');
                    const newCx = (cx - 1) & 0xffff;
                    this.setRegister('cx', newCx);
                    if (newCx !== 0 && this.flags.zf === 1) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0xe2: // LOOP short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    const cx = this.getRegister('cx');
                    const newCx = (cx - 1) & 0xffff;
                    this.setRegister('cx', newCx);
                    if (newCx !== 0) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0xe3: // JCXZ short
                {
                    const off = this.readMemory8(currentAddress + 1);
                    const s = off > 0x7f ? off - 0x100 : off;
                    if (this.getRegister('cx') === 0) {
                        this.ip = (this.ip + 2 + s) & 0xffff;
                        instructionLength = 0;
                    } else {
                        instructionLength = 2;
                    }
                }
                break;
            case 0xeb: // JMP short
                const offset8 = this.readMemory8(currentAddress + 1);
                // 符号扩展（8位有符号数转换为16位）
                const signedOffset = offset8 > 0x7f ? offset8 - 0x100 : offset8;
                // 跳转到目标地址：当前IP + 指令长度(2) + 偏移量
                // 注意：this.ip当前指向本条指令，所以直接加上指令长度和偏移量
                this.ip = (this.ip + 2 + signedOffset) & 0xffff;
                instructionLength = 0; // 不增加IP，因为已经手动设置了
                break;
            case 0x74: // JZ/JE short
                const offset8jz = this.readMemory8(currentAddress + 1);
                if (this.flags.zf === 1) {
                    // 符号扩展
                    const signedOffsetJz = offset8jz > 0x7f ? offset8jz - 0x100 : offset8jz;
                    // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                    this.ip = this.ip + 2 + signedOffsetJz;
                    this.ip &= 0xffff;
                    instructionLength = 0; // 不增加IP，因为已经手动设置了
                } else {
                    instructionLength = 2;
                }
                break;
            case 0x7c: // JL short
                const offset8jl = this.readMemory8(currentAddress + 1);
                // JL: 小于跳转，条件是 SF !== OF
                if (this.flags.sf !== this.flags.of) {
                    // 符号扩展
                    const signedOffsetJl = offset8jl > 0x7f ? offset8jl - 0x100 : offset8jl;
                    // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                    this.ip = this.ip + 2 + signedOffsetJl;
                    this.ip &= 0xffff;
                    instructionLength = 0; // 不增加IP，因为已经手动设置了
                } else {
                    instructionLength = 2;
                }
                break;
            case 0x7e: // JLE short
                const offset8jle = this.readMemory8(currentAddress + 1);
                // JLE: 小于等于跳转，条件是 (SF !== OF) || (ZF === 1)
                if ((this.flags.sf !== this.flags.of) || (this.flags.zf === 1)) {
                    // 符号扩展
                    const signedOffsetJle = offset8jle > 0x7f ? offset8jle - 0x100 : offset8jle;
                    // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                    this.ip = this.ip + 2 + signedOffsetJle;
                    this.ip &= 0xffff;
                    instructionLength = 0; // 不增加IP，因为已经手动设置了
                } else {
                    instructionLength = 2;
                }
                break;
            case 0x7f: // JG short
                const offset8jg = this.readMemory8(currentAddress + 1);
                // JG: 大于跳转，条件是 (SF === OF) && (ZF === 0)
                if ((this.flags.sf === this.flags.of) && (this.flags.zf === 0)) {
                    // 符号扩展
                    const signedOffsetJg = offset8jg > 0x7f ? offset8jg - 0x100 : offset8jg;
                    // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                    this.ip = this.ip + 2 + signedOffsetJg;
                    this.ip &= 0xffff;
                    instructionLength = 0; // 不增加IP，因为已经手动设置了
                } else {
                    instructionLength = 2;
                }
                break;
            case 0x81: // Group - ADD/OR/ADC/SBB/AND/SUB/XOR/CMP Ev, Iv
                const modrm81 = this.readMemory8(currentAddress + 1);
                const reg81 = (modrm81 >> 3) & 0x7; // 扩展操作码
                const mod81 = (modrm81 >> 6) & 0x3;
                const rm81 = modrm81 & 0x7;

                // 读取立即数
                const imm16_81 = this.readMemory16(currentAddress + 2);
                
                // 目标寄存器映射 (r/m字段，当mod=11时)
                const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

                if (mod81 === 3) {
                    // 寄存器操作
                    const destReg = rmToName[rm81];
                    const oldValue = this.getRegister(destReg);
                    let result;

                    switch (reg81) {
                        case 0: // ADD
                            result = oldValue + imm16_81;
                            break;
                        case 1: // OR
                            result = oldValue | imm16_81;
                            break;
                        case 2: // ADC
                            result = oldValue + imm16_81 + this.flags.cf;
                            break;
                        case 3: // SBB
                            result = oldValue - imm16_81 - this.flags.cf;
                            break;
                        case 4: // AND
                            result = oldValue & imm16_81;
                            break;
                        case 5: // SUB
                            result = oldValue - imm16_81;
                            break;
                        case 6: // XOR
                            result = oldValue ^ imm16_81;
                            break;
                        case 7: // CMP
                            result = oldValue - imm16_81;
                            break;
                        default:
                            console.error(`执行错误: 不支持的扩展操作码 ${reg81}`);
                            this.running = false;
                            return false;
                    }

                    // 设置标志位（CMP不设置目标寄存器）
                    if (reg81 !== 7) {
                        this.setRegister(destReg, result & 0xffff);
                    }
                    // 根据操作类型设置标志位
                    let operation = 'add';
                    switch (reg81) {
                        case 0: // ADD
                        case 2: // ADC
                            operation = 'add';
                            break;
                        case 3: // SBB
                        case 5: // SUB
                        case 7: // CMP
                            operation = 'sub';
                            break;
                        case 1: // OR
                        case 4: // AND
                        case 6: // XOR
                            operation = reg81 === 1 ? 'or' : (reg81 === 4 ? 'and' : 'xor');
                            break;
                    }
                    this.updateFlags16(result, oldValue, imm16_81, operation);
                    instructionLength = 4;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod81}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x8c: // MOV r/m16, Sreg (从段寄存器到通用寄存器/内存)
                const modrm8c = this.readMemory8(currentAddress + 1);
                const reg8c = (modrm8c >> 3) & 0x7; // 段寄存器：0=ES, 1=CS, 2=SS, 3=DS
                const rm8c = modrm8c & 0x7;
                const mod8c = (modrm8c >> 6) & 0x3;

                // 段寄存器映射
                const sregToName = ['es', 'cs', 'ss', 'ds'];
                const srcSegment = sregToName[reg8c];
                const segmentValue = this.getSegmentRegister(srcSegment);

                if (mod8c === 3) {
                    // 寄存器到寄存器传送
                    const dstReg = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][rm8c];
                    this.setRegister(dstReg, segmentValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: MOV Sreg 不支持的内存寻址模式`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x8d: // LEA r16, m
                const modrm8d = this.readMemory8(currentAddress + 1);
                const reg8d = (modrm8d >> 3) & 0x7; // 目标寄存器
                const mod8d = (modrm8d >> 6) & 0x3;
                const rm8d = modrm8d & 0x7;

                // 寄存器映射
                const regToName8d = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                const dstReg = regToName8d[reg8d];

                if (mod8d === 0 && rm8d === 6) {
                    // 直接寻址模式：LEA r16, [disp16]
                    const offset16 = this.readMemory16(currentAddress + 2);
                    this.setRegister(dstReg, offset16);
                    instructionLength = 4;
                } else if (mod8d === 3) {
                    // 寄存器到寄存器（无意义，但为了完整性实现）
                    const srcReg = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][rm8d];
                    const srcValue = this.getRegister(srcReg);
                    this.setRegister(dstReg, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: LEA 不支持的寻址模式`);
                    this.running = false;
                    return false;
                }
                break;
            case 0x8e: // MOV Sreg, r/m16 (从通用寄存器/内存到段寄存器)
                const modrm8e = this.readMemory8(currentAddress + 1);
                const reg8e = (modrm8e >> 3) & 0x7; // 段寄存器：0=ES, 1=CS, 2=SS, 3=DS
                const rm8e = modrm8e & 0x7;
                const mod8e = (modrm8e >> 6) & 0x3;

                // 段寄存器映射
                const sregToName8e = ['es', 'cs', 'ss', 'ds'];
                const dstSegment = sregToName8e[reg8e];

                if (mod8e === 3) {
                    // 寄存器到寄存器传送
                    const srcReg = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][rm8e];
                    const srcValue = this.getRegister(srcReg);
                    this.setSegmentRegister(dstSegment, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: MOV Sreg 不支持的内存寻址模式`);
                    this.running = false;
                    return false;
                }
                break;
            case 0xc6: // MOV r/m8, imm8
                const modrm_c6 = this.readMemory8(currentAddress + 1);
                const reg_c6 = (modrm_c6 >> 3) & 0x7; // 扩展操作码，必须为0
                const mod_c6 = (modrm_c6 >> 6) & 0x3;
                const rm_c6 = modrm_c6 & 0x7;

                if (reg_c6 !== 0) {
                    console.error(`执行错误: MOV r/m8, imm8 不支持的扩展操作码 ${reg_c6}`);
                    this.running = false;
                    return false;
                }

                let imm8_c6;
                let instructionLength_c6 = 3;

                if (mod_c6 === 3) {
                    // 寄存器操作（8位）
                    imm8_c6 = this.readMemory8(currentAddress + 2);
                    const rmToName8_c6 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                    const destReg = rmToName8_c6[rm_c6];
                    const oldValue = this.getRegister(destReg);
                    const highByte = oldValue & 0xff00;
                    this.setRegister(destReg, highByte | imm8_c6);
                    instructionLength_c6 = 3;
                } else if (mod_c6 === 0 && rm_c6 === 6) {
                    // 直接寻址模式：MOV [disp16], imm8
                    const offset16_c6 = this.readMemory16(currentAddress + 2);
                    imm8_c6 = this.readMemory8(currentAddress + 4);
                    const address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), offset16_c6);
                    this.writeMemory8(address_c6, imm8_c6);
                    instructionLength_c6 = 5;
                } else if (mod_c6 === 1) {
                    // 寄存器+8位位移量寻址：MOV [reg+disp8], imm8
                    const disp8_c6 = this.readMemory8(currentAddress + 2);
                    imm8_c6 = this.readMemory8(currentAddress + 3);
                    let address_c6 = null;
                    if (rm_c6 === 0) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp8_c6);
                    } else if (rm_c6 === 1) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp8_c6);
                    } else if (rm_c6 === 2) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp8_c6);
                    } else if (rm_c6 === 3) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp8_c6);
                    } else if (rm_c6 === 4) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp8_c6);
                    } else if (rm_c6 === 5) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp8_c6);
                    } else if (rm_c6 === 7) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp8_c6);
                    }
                    if (address_c6 !== null) {
                        this.writeMemory8(address_c6, imm8_c6);
                        instructionLength_c6 = 4;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 mod=${mod_c6}, rm=${rm_c6}`);
                        this.running = false;
                        return false;
                    }
                } else if (mod_c6 === 2) {
                    // 寄存器+16位位移量寻址：MOV [reg+disp16], imm8
                    const disp16_c6 = this.readMemory16(currentAddress + 2);
                    imm8_c6 = this.readMemory8(currentAddress + 4);
                    let address_c6 = null;
                    if (rm_c6 === 0) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp16_c6);
                    } else if (rm_c6 === 1) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp16_c6);
                    } else if (rm_c6 === 2) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp16_c6);
                    } else if (rm_c6 === 3) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp16_c6);
                    } else if (rm_c6 === 4) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp16_c6);
                    } else if (rm_c6 === 5) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp16_c6);
                    } else if (rm_c6 === 7) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp16_c6);
                    }
                    if (address_c6 !== null) {
                        this.writeMemory8(address_c6, imm8_c6);
                        instructionLength_c6 = 5;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 mod=${mod_c6}, rm=${rm_c6}`);
                        this.running = false;
                        return false;
                    }
                } else {
                    // 寄存器间接寻址
                    imm8_c6 = this.readMemory8(currentAddress + 2);
                    let address_c6 = null;
                    if (rm_c6 === 0) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si'));
                    } else if (rm_c6 === 1) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di'));
                    } else if (rm_c6 === 2) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si'));
                    } else if (rm_c6 === 3) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di'));
                    } else if (rm_c6 === 4) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si'));
                    } else if (rm_c6 === 5) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di'));
                    } else if (rm_c6 === 7) {
                        address_c6 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx'));
                    }

                    if (address_c6 !== null) {
                        this.writeMemory8(address_c6, imm8_c6);
                        instructionLength_c6 = 3;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 mod=${mod_c6}, rm=${rm_c6}`);
                        this.running = false;
                        return false;
                    }
                }
                instructionLength = instructionLength_c6;
                break;
            case 0xc7: // MOV r/m16, imm16
                const modrm_c7 = this.readMemory8(currentAddress + 1);
                const reg_c7 = (modrm_c7 >> 3) & 0x7; // 扩展操作码，必须为0
                const mod_c7 = (modrm_c7 >> 6) & 0x3;
                const rm_c7 = modrm_c7 & 0x7;

                if (reg_c7 !== 0) {
                    console.error(`执行错误: MOV r/m16, imm16 不支持的扩展操作码 ${reg_c7}`);
                    this.running = false;
                    return false;
                }

                let imm16_c7;
                let instructionLength_c7 = 4;

                if (mod_c7 === 3) {
                    // 寄存器操作（16位）
                    imm16_c7 = this.readMemory16(currentAddress + 2);
                    const rmToName16_c7 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                    const destReg = rmToName16_c7[rm_c7];
                    this.setRegister(destReg, imm16_c7);
                    instructionLength_c7 = 4;
                } else if (mod_c7 === 0 && rm_c7 === 6) {
                    // 直接寻址模式：MOV [disp16], imm16
                    const offset16_c7 = this.readMemory16(currentAddress + 2);
                    imm16_c7 = this.readMemory16(currentAddress + 4);
                    const address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), offset16_c7);
                    this.writeMemory16(address_c7, imm16_c7);
                    instructionLength_c7 = 6;
                } else if (mod_c7 === 1) {
                    // 寄存器+8位位移量寻址：MOV [reg+disp8], imm16
                    const disp8_c7 = this.readMemory8(currentAddress + 2);
                    imm16_c7 = this.readMemory16(currentAddress + 3);
                    let address_c7 = null;
                    if (rm_c7 === 0) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp8_c7);
                    } else if (rm_c7 === 1) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp8_c7);
                    } else if (rm_c7 === 2) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp8_c7);
                    } else if (rm_c7 === 3) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp8_c7);
                    } else if (rm_c7 === 4) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp8_c7);
                    } else if (rm_c7 === 5) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp8_c7);
                    } else if (rm_c7 === 7) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp8_c7);
                    }
                    if (address_c7 !== null) {
                        this.writeMemory16(address_c7, imm16_c7);
                        instructionLength_c7 = 5;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 mod=${mod_c7}, rm=${rm_c7}`);
                        this.running = false;
                        return false;
                    }
                } else if (mod_c7 === 2) {
                    // 寄存器+16位位移量寻址：MOV [reg+disp16], imm16
                    const disp16_c7 = this.readMemory16(currentAddress + 2);
                    imm16_c7 = this.readMemory16(currentAddress + 4);
                    let address_c7 = null;
                    if (rm_c7 === 0) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si') + disp16_c7);
                    } else if (rm_c7 === 1) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di') + disp16_c7);
                    } else if (rm_c7 === 2) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si') + disp16_c7);
                    } else if (rm_c7 === 3) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di') + disp16_c7);
                    } else if (rm_c7 === 4) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si') + disp16_c7);
                    } else if (rm_c7 === 5) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di') + disp16_c7);
                    } else if (rm_c7 === 7) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + disp16_c7);
                    }
                    if (address_c7 !== null) {
                        this.writeMemory16(address_c7, imm16_c7);
                        instructionLength_c7 = 6;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 mod=${mod_c7}, rm=${rm_c7}`);
                        this.running = false;
                        return false;
                    }
                } else {
                    // 寄存器间接寻址
                    imm16_c7 = this.readMemory16(currentAddress + 2);
                    let address_c7 = null;
                    if (rm_c7 === 0) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si'));
                    } else if (rm_c7 === 1) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di'));
                    } else if (rm_c7 === 2) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si'));
                    } else if (rm_c7 === 3) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di'));
                    } else if (rm_c7 === 4) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si'));
                    } else if (rm_c7 === 5) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di'));
                    } else if (rm_c7 === 7) {
                        address_c7 = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx'));
                    }

                    if (address_c7 !== null) {
                        this.writeMemory16(address_c7, imm16_c7);
                        instructionLength_c7 = 4;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 mod=${mod_c7}, rm=${rm_c7}`);
                        this.running = false;
                        return false;
                    }
                }
                instructionLength = instructionLength_c7;
                break;
            default:
                // 所有未实现的指令都报非法指令错误
                console.error(`执行错误: 遇到非法指令 0x${opcode.toString(16).padStart(2, '0')}`);
                this.running = false;
                return false;
        }

        // 更新指令指针（RET、CALL、JMP指令已经设置了IP，不需要再增加）
        if (opcode !== 0xc3 && opcode !== 0xE8 && opcode !== 0xeb) { // 0xc3=RET, 0xE8=CALL, 0xeb=JMP short
            this.ip += instructionLength;
            this.ip &= 0xffff; // 确保16位
        }

        return true;
    }
    
    // 更新8位操作的标志位
    // operation: 'add' | 'sub' | 'and' | 'or' | 'xor'
    updateFlags8(result, operand1, operand2, operation = 'add') {
        // 零标志
        this.flags.zf = (result & 0xff) === 0 ? 1 : 0;
        
        // 符号标志
        this.flags.sf = (result & 0x80) !== 0 ? 1 : 0;
        
        // 奇偶标志（计算结果低8位中1的个数是否为偶数）
        let parity = 0;
        let value = result & 0xff;
        for (let i = 0; i < 8; i++) {
            parity += value & 1;
            value >>= 1;
        }
        this.flags.pf = (parity % 2 === 0) ? 1 : 0;
        
        // 进位标志
        if (operation === 'add' || operation === 'sub') {
            this.flags.cf = result > 0xff ? 1 : 0;
        } else {
            this.flags.cf = 0; // AND/OR/XOR 进位标志为0
        }
        
        // 辅助进位标志（D3位的进位）
        if (operation === 'add') {
            this.flags.af = ((operand1 & 0x0f) + (operand2 & 0x0f)) > 0x0f ? 1 : 0;
        } else if (operation === 'sub') {
            this.flags.af = ((operand1 & 0x0f) < (operand2 & 0x0f)) ? 1 : 0;
        } else {
            this.flags.af = 0; // AND/OR/XOR 辅助进位标志为0
        }
        
        // 溢出标志（有符号数溢出）
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
            this.flags.of = 0; // AND/OR/XOR 溢出标志为0
        }
    }
    
    // 更新16位操作的标志位
    // operation: 'add' | 'sub' | 'and' | 'or' | 'xor'
    updateFlags16(result, operand1, operand2, operation = 'add') {
        // 零标志
        this.flags.zf = (result & 0xffff) === 0 ? 1 : 0;
        
        // 符号标志
        this.flags.sf = (result & 0x8000) !== 0 ? 1 : 0;
        
        // 奇偶标志（计算结果低8位中1的个数是否为偶数）
        let parity = 0;
        let value = result & 0xff;
        for (let i = 0; i < 8; i++) {
            parity += value & 1;
            value >>= 1;
        }
        this.flags.pf = (parity % 2 === 0) ? 1 : 0;
        
        // 进位标志
        if (operation === 'add' || operation === 'sub') {
            this.flags.cf = result > 0xffff ? 1 : 0;
        } else {
            this.flags.cf = 0; // AND/OR/XOR 进位标志为0
        }
        
        // 辅助进位标志（D3位的进位）
        if (operation === 'add') {
            this.flags.af = ((operand1 & 0x0f) + (operand2 & 0x0f)) > 0x0f ? 1 : 0;
        } else if (operation === 'sub') {
            this.flags.af = ((operand1 & 0x0f) < (operand2 & 0x0f)) ? 1 : 0;
        } else {
            this.flags.af = 0; // AND/OR/XOR 辅助进位标志为0
        }
        
        // 溢出标志（有符号数溢出）
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
            this.flags.of = 0; // AND/OR/XOR 溢出标志为0
        }
    }

    // 获取标志寄存器值（16位）
    getFlags() {
        // 标志位布局（从低到高）：CF(0), PF(2), AF(4), ZF(6), SF(7), TF(8), IF(9), DF(10), OF(11)
        let flags = 0;
        flags |= (this.flags.cf || 0) << 0;   // 进位标志
        flags |= (this.flags.pf || 0) << 2;   // 奇偶标志
        flags |= (this.flags.af || 0) << 4;   // 辅助进位标志
        flags |= (this.flags.zf || 0) << 6;   // 零标志
        flags |= (this.flags.sf || 0) << 7;   // 符号标志
        flags |= (this.flags.tf || 0) << 8;   // 陷阱标志
        flags |= (this.flags.if || 0) << 9;   // 中断使能标志
        flags |= (this.flags.df || 0) << 10;  // 方向标志
        flags |= (this.flags.of || 0) << 11;  // 溢出标志
        // 固定为1的位（位1, 3, 5）
        flags |= 0x0002; // 位1固定为1
        flags |= 0x0008; // 位3固定为1
        flags |= 0x0020; // 位5固定为1
        return flags & 0xffff;
    }

    // 设置标志寄存器值（16位）
    setFlags(flags) {
        // 标志位布局（从低到高）：CF(0), PF(2), AF(4), ZF(6), SF(7), TF(8), IF(9), DF(10), OF(11)
        this.flags.cf = (flags >> 0) & 1;   // 进位标志
        this.flags.pf = (flags >> 2) & 1;   // 奇偶标志
        this.flags.af = (flags >> 4) & 1;   // 辅助进位标志
        this.flags.zf = (flags >> 6) & 1;   // 零标志
        this.flags.sf = (flags >> 7) & 1;   // 符号标志
        this.flags.tf = (flags >> 8) & 1;   // 陷阱标志
        this.flags.if = (flags >> 9) & 1;   // 中断使能标志
        this.flags.df = (flags >> 10) & 1;  // 方向标志
        this.flags.of = (flags >> 11) & 1;  // 溢出标志
    }

    // 运行
    run() {
        this.running = true;
        let instructionCount = 0;
        const maxInstructions = 10000; // 最大执行指令数，防止无限循环

        while (this.running && instructionCount < maxInstructions) {
            // 执行前检查是否在断点处（第一条指令不检查，避免还没开始就停住）
            if (instructionCount > 0 && this.isAtBreakpoint()) {
                this.running = false;
                break;
            }

            // 执行前清除寄存器和内存操作，只保留最后一条指令的操作
            if (instructionCount > 0) {
                this.clearRegisterOperations();
                this.clearMemoryOperations();
            }

            // 执行一条指令
            if (!this.step()) {
                break;
            }

            instructionCount++;
        }

        if (instructionCount >= maxInstructions) {
            this.running = false;
        }
    }
    
    // 暂停
    pause() {
        this.running = false;
    }
    
    // 获取当前指令地址
    getCurrentAddress() {
        return this.getMemoryAddress(this.getSegmentRegister('cs'), this.ip);
    }
    
    // 获取寄存器的低8位
    getLowByte(reg) {
        return this.registers[reg] & 0xff;
    }
    
    // 获取寄存器的高8位
    getHighByte(reg) {
        return (this.registers[reg] >> 8) & 0xff;
    }
    
    // 设置寄存器的低8位
    setLowByte(reg, value) {
        const oldValue = this.registers[reg];
        this.registers[reg] = (this.registers[reg] & 0xff00) | (value & 0xff);
        // 跟踪寄存器写入操作
        this.registerOperations.set(reg, { type: 'write', value: this.registers[reg], oldValue });
        // 跟踪8位寄存器操作
        const lowByteReg = reg.charAt(0) + 'l'; // al, bl, cl, dl
        this.registerOperations.set(lowByteReg, { type: 'write', value: value & 0xff, oldValue: oldValue & 0xff });
    }
    
    // 设置寄存器的高8位
    setHighByte(reg, value) {
        const oldValue = this.registers[reg];
        this.registers[reg] = (this.registers[reg] & 0x00ff) | ((value & 0xff) << 8);
        // 跟踪寄存器写入操作
        this.registerOperations.set(reg, { type: 'write', value: this.registers[reg], oldValue });
        // 跟踪8位寄存器操作
        const highByteReg = reg.charAt(0) + 'h'; // ah, bh, ch, dh
        this.registerOperations.set(highByteReg, { type: 'write', value: value & 0xff, oldValue: (oldValue >> 8) & 0xff });
    }

    // ==================== 中断处理程序 ====================

    // INT 21h 处理程序 - DOS功能调用
    handleInt21() {
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
            default:
                console.warn(`未实现的INT 21h功能: AH=${ah.toString(16).padStart(2, '0')}`);
                return true; // 继续执行
        }
    }

    // INT 21h AH=01h: 从键盘读取字符并回显
    int21AH01KeyboardInput() {
        if (this.keyboardBuffer.length > 0) {
            // 有按键，处理它
            const key = this.keyboardBuffer.shift();
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
            // 回显到屏幕
            this.outputBuffer += String.fromCharCode(key);
            if (this.updateOutputDisplay) {
                this.updateOutputDisplay();
            }
            // 更新IP到下一条指令（INT 21h是2字节指令）
            this.ip += 2;
            this.ip &= 0xffff;
            return true; // 处理完成，继续执行
        } else {
            // 等待键盘输入
            if (this.waitForKeyPress && !this.waitingForKey) {
                this.waitingForKey = true;
                this.waitForKeyPress((key) => {
                    this.keyboardBuffer.push(key);
                    this.waitingForKey = false;
                    // 更新显示
                    if (this.updateOutputDisplay) {
                        this.updateOutputDisplay();
                    }
                });
            }
            return false; // 暂停执行，等待输入
        }
    }

    // INT 21h AH=02h: 显示字符
    int21AH02DisplayChar() {
        const dl = this.getRegister('dx') & 0xff;
        const char = String.fromCharCode(dl);
        this.outputBuffer += char;
        if (this.updateOutputDisplay) {
            this.updateOutputDisplay();
        }
        // 更新IP到下一条指令
        this.ip += 2;
        this.ip &= 0xffff;
        return true;
    }

    // INT 21h AH=06h: 直接控制台I/O
    int21AH06DirectConsoleIO() {
        const dl = this.getRegister('dx') & 0xff;

        if (dl === 0xff) {
            // 输入模式：检查是否有按键
            if (this.keyboardBuffer.length > 0) {
                // 有按键，读取但不从缓冲区移除
                const key = this.keyboardBuffer[0];
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
                // 清除ZF标志（表示有按键）
                this.flags.zf = 0;
            } else {
                // 无按键，设置ZF标志
                this.flags.zf = 1;
            }
        } else {
            // 输出模式：显示字符
            const char = String.fromCharCode(dl);
            this.outputBuffer += char;
            if (this.updateOutputDisplay) {
                this.updateOutputDisplay();
            }
        }
        // 更新IP到下一条指令
        this.ip += 2;
        this.ip &= 0xffff;
        return true;
    }

    // INT 21h AH=07h: 无回显直接输入
    int21AH07DirectInputNoEcho() {
        if (this.keyboardBuffer.length > 0) {
            // 有按键，处理它（不回显）
            const key = this.keyboardBuffer.shift();
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
            // 更新IP到下一条指令
            this.ip += 2;
            this.ip &= 0xffff;
            return true;
        } else {
            // 等待键盘输入
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
            return false; // 暂停执行，等待输入
        }
    }

    // INT 21h AH=09h: 显示字符串
    int21AH09DisplayString() {
        const ds = this.getSegmentRegister('ds');
        let dx = this.getRegister('dx');
        const stringAddress = (ds << 4) + dx;
        let char = this.readMemory8(stringAddress);
        while (char !== 0x24) { // 0x24 是 '$' 结束符
            this.outputBuffer += String.fromCharCode(char);
            dx++;
            char = this.readMemory8((ds << 4) + dx);
        }
        if (this.updateOutputDisplay) {
            this.updateOutputDisplay();
        }
        // 更新IP到下一条指令
        this.ip += 2;
        this.ip &= 0xffff;
        return true;
    }

    // INT 21h AH=0Ah: 字符串输入
    int21AH0AStringInput() {
        const ds = this.getSegmentRegister('ds');
        const dx = this.getRegister('dx');
        const bufferAddress = (ds << 4) + dx;

        // 读取缓冲区的最大长度（第一个字节）
        const maxLength = this.readMemory8(bufferAddress);

        if (this.keyboardBuffer.length > 0) {
            // 收集所有可用的按键，直到遇到回车(0x0D)或达到最大长度
            let inputLength = 0;
            let inputString = '';

            while (this.keyboardBuffer.length > 0 && inputLength < maxLength) {
                const key = this.keyboardBuffer.shift();

                if (key === 0x0D) { // 回车键
                    break;
                } else if (key === 0x08) { // 退格键
                    if (inputLength > 0) {
                        inputLength--;
                        inputString = inputString.slice(0, -1);
                        // 从屏幕删除字符（发送退格-空格-退格序列）
                        this.outputBuffer += '\b \b';
                    }
                } else {
                    inputString += String.fromCharCode(key);
                    inputLength++;
                    // 回显到屏幕
                    this.outputBuffer += String.fromCharCode(key);
                }
            }

            // 将输入的字符串写入缓冲区
            // 第二个字节是实际输入的长度
            this.writeMemory8(bufferAddress + 1, inputLength);
            // 从第三个字节开始存储字符串
            for (let i = 0; i < inputLength; i++) {
                this.writeMemory8(bufferAddress + 2 + i, inputString.charCodeAt(i));
            }

            if (this.updateOutputDisplay) {
                this.updateOutputDisplay();
            }

            // 更新IP到下一条指令
            this.ip += 2;
            this.ip &= 0xffff;
            return true;
        } else {
            // 等待键盘输入
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
            return false; // 暂停执行，等待输入
        }
    }

    // INT 21h AH=4Ch: 程序结束
    int21AH4CExit() {
        this.running = false;
        // 将IP设置为一个非法值，确保程序真正结束
        this.ip = 0xffff;
        this.ip &= 0xffff;
        return false; // 停止执行
    }

    // INT 16h 处理程序 - BIOS键盘服务
    handleInt16() {
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
    }

    // INT 16h AH=00h: 等待键盘输入
    int16AH00WaitKey() {
        if (this.keyboardBuffer.length > 0) {
            const key = this.keyboardBuffer.shift();
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
            // 更新IP到下一条指令
            this.ip += 2;
            this.ip &= 0xffff;
            return true;
        } else {
            // 等待键盘输入
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
            return false; // 暂停执行，等待输入
        }
    }

    // INT 16h AH=01h: 检查键盘缓冲区
    int16AH01CheckKey() {
        if (this.keyboardBuffer.length > 0) {
            // 有按键，ZF=0
            this.flags.zf = 0;
            // 读取但不移除按键
            const key = this.keyboardBuffer[0];
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | key);
        } else {
            // 无按键，ZF=1
            this.flags.zf = 1;
        }
        // 更新IP到下一条指令
        this.ip += 2;
        this.ip &= 0xffff;
        return true;
    }
}
