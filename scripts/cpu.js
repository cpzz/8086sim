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

        // 更新显示控制的回调函数
        this.updateOutputDisplay = null;
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
            case 0x14: // ADC AL, Ib
                const imm8adc = this.readMemory8(currentAddress + 1);
                const aladc = this.getRegister('ax') & 0xff;
                const carryadc = this.flags.cf;
                const resultadc = aladc + imm8adc + carryadc;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (resultadc & 0xff));
                // 设置标志位
                this.updateFlags8(resultadc, aladc, imm8adc + carryadc);
                instructionLength = 2;
                break;
            case 0x15: // ADC AX, Iv
                const imm16adc = this.readMemory16(currentAddress + 1);
                const axadc = this.getRegister('ax');
                const carryadc16 = this.flags.cf;
                const result16adc = axadc + imm16adc + carryadc16;
                this.setRegister('ax', result16adc & 0xffff);
                // 设置标志位
                this.updateFlags16(result16adc, axadc, imm16adc + carryadc16);
                instructionLength = 3;
                break;
            case 0x2c: // SUB AL, Ib
                const imm8sub = this.readMemory8(currentAddress + 1);
                const alsub = this.getRegister('ax') & 0xff;
                const resultsub = alsub - imm8sub;
                this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (resultsub & 0xff));
                // 设置标志位
                this.updateFlags8(resultsub, alsub, imm8sub);
                instructionLength = 2;
                break;
            case 0x2d: // SUB AX, Iv
                const imm16sub = this.readMemory16(currentAddress + 1);
                const axsub = this.getRegister('ax');
                const resultsub16 = axsub - imm16sub;
                this.setRegister('ax', resultsub16 & 0xffff);
                // 设置标志位
                this.updateFlags16(resultsub16, axsub, imm16sub);
                instructionLength = 3;
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
                    // [BP] + disp16 (暂时不支持偏移量)
                    instructionLength = 4;
                } else {
                    // 内存到寄存器传送
                    let address = null;
                    let segmentReg = 'ds';

                    // 根据 r/m 字段确定寻址方式
                    if (rm8b === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si'));
                    } else if (rm8b === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di'));
                    } else if (rm8b === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si'));
                    } else if (rm8b === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di'));
                    } else if (rm8b === 4) {
                        // [SI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si'));
                    } else if (rm8b === 5) {
                        // [DI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di'));
                    } else if (rm8b === 6) {
                        // [BP]
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp'));
                    } else if (rm8b === 7) {
                        // [BX]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx'));
                    }

                    if (address !== null) {
                        this.setRegister(regToName[reg8b], this.readMemory16(address));
                        instructionLength = 2;
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
                } else {
                    // 内存到寄存器传送 (8位)
                    let address = null;

                    // 根据 r/m 字段确定寻址方式
                    if (rm8a === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si'));
                    } else if (rm8a === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di'));
                    } else if (rm8a === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si'));
                    } else if (rm8a === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di'));
                    } else if (rm8a === 4) {
                        // [SI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si'));
                    } else if (rm8a === 5) {
                        // [DI]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di'));
                    } else if (rm8a === 6) {
                        // [BP]
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp'));
                    } else if (rm8a === 7) {
                        // [BX]
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx'));
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
                        instructionLength = 2;
                    } else {
                        console.error(`执行错误: 不支持的寻址模式 0x${modrm8a.toString(16)}`);
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
                    // [BP] + disp16 (暂时不支持偏移量)
                    instructionLength = 4;
                } else {
                    // 寄存器到内存传送
                    let address = null;
                    let segmentReg = 'ds';

                    // 根据 r/m 字段确定寻址方式
                    if (rm89 === 0) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('si'));
                    } else if (rm89 === 1) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx') + this.getRegister('di'));
                    } else if (rm89 === 2) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('si'));
                    } else if (rm89 === 3) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp') + this.getRegister('di'));
                    } else if (rm89 === 4) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si'));
                    } else if (rm89 === 5) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('di'));
                    } else if (rm89 === 6) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('bp'));
                    } else if (rm89 === 7) {
                        address = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('bx'));
                    }

                    if (address !== null) {
                        this.writeMemory16(address, this.getRegister(srcRegToName[reg89]));
                        instructionLength = 2;
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
            case 0x90: // NOP
                instructionLength = 1;
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
                // 简单处理：INT 21h 用于 DOS 功能调用
                if (interruptNum === 0x21) {
                    const ah = (this.getRegister('ax') >> 8) & 0xff;
                    if (ah === 0x02) {
                        // DOS 功能 02h：显示字符（DL）
                        const dl = this.getRegister('dx') & 0xff;
                        const char = String.fromCharCode(dl);
                        // 将字符添加到输出缓冲区
                        this.outputBuffer += char;
                        // 调用更新显示的回调函数
                        if (this.updateOutputDisplay) {
                            this.updateOutputDisplay();
                        }
                    } else if (ah === 0x09) {
                        // DOS 功能 09h：显示字符串（DS:DX）
                        const ds = this.getSegmentRegister('ds');
                        const dx = this.getRegister('dx');
                        const stringAddress = (ds << 4) + dx;
                        let char = this.readMemory8(stringAddress);
                        while (char !== 0x24) { // 0x24 是 '$' 结束符
                            this.outputBuffer += String.fromCharCode(char);
                            char = this.readMemory8((ds << 4) + (++dx));
                        }
                        // 调用更新显示的回调函数
                        if (this.updateOutputDisplay) {
                            this.updateOutputDisplay();
                        }
                    } else if (ah === 0x4c) {
                        // DOS 功能 4Ch：程序结束
                        this.running = false;
                        instructionLength = 2;
                        this.ip += instructionLength;
                        this.ip &= 0xffff;
                        return false;
                    }
                }
                instructionLength = 2;
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
            case 0xd0: // SHL/SHR r/m8, 1
                const modrm8 = this.readMemory8(currentAddress + 1);
                const reg8 = (modrm8 >> 3) & 0x7; // 4=SHL, 5=SHR
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

                    if (reg8 === 4) {
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
            case 0xd1: // SHL/SHR r/m16, 1
                const modrm16 = this.readMemory8(currentAddress + 1);
                const reg16 = (modrm16 >> 3) & 0x7; // 4=SHL, 5=SHR
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

                    if (reg16 === 4) {
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
                    this.updateFlags16(result39, dstValue, srcValue);
                    instructionLength = 2;
                } else {
                    console.error(`执行错误: 不支持的寻址模式 mod=${mod39}`);
                    this.running = false;
                    return false;
                }
                break;
            case 0xeb: // JMP short
                const offset8 = this.readMemory8(currentAddress + 1);
                // 符号扩展
                const signedOffset = offset8 > 0x7f ? offset8 - 0x100 : offset8;
                // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                this.ip = this.ip + 2 + signedOffset;
                this.ip &= 0xffff;
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
                    this.updateFlags16(result, oldValue, imm16_81);
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
    updateFlags8(result, operand1, operand2) {
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
        this.flags.cf = result > 0xff ? 1 : 0;
        
        // 辅助进位标志（D3位的进位）
        this.flags.af = ((operand1 & 0x0f) + (operand2 & 0x0f)) > 0x0f ? 1 : 0;
        
        // 溢出标志（有符号数溢出）
        const signedResult = result > 0x7f ? result - 0x100 : result;
        const signedOperand1 = operand1 > 0x7f ? operand1 - 0x100 : operand1;
        const signedOperand2 = operand2 > 0x7f ? operand2 - 0x100 : operand2;
        this.flags.of = (signedResult !== signedOperand1 + signedOperand2) ? 1 : 0;
    }
    
    // 更新16位操作的标志位
    updateFlags16(result, operand1, operand2) {
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
        this.flags.cf = result > 0xffff ? 1 : 0;
        
        // 辅助进位标志（D3位的进位）
        this.flags.af = ((operand1 & 0x0f) + (operand2 & 0x0f)) > 0x0f ? 1 : 0;
        
        // 溢出标志（有符号数溢出）
        const signedResult = result > 0x7fff ? result - 0x10000 : result;
        const signedOperand1 = operand1 > 0x7fff ? operand1 - 0x10000 : operand1;
        const signedOperand2 = operand2 > 0x7fff ? operand2 - 0x10000 : operand2;
        this.flags.of = (signedResult !== signedOperand1 + signedOperand2) ? 1 : 0;
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
}
