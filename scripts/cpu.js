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
    
    // 获取8位寄存器值
    getRegister8(name) {
        const regName = name.toLowerCase();
        // 8位寄存器映射到16位寄存器
        const regMap = {
            'al': 'ax', 'ah': 'ax',
            'bl': 'bx', 'bh': 'bx',
            'cl': 'cx', 'ch': 'cx',
            'dl': 'dx', 'dh': 'dx'
        };
        const parentReg = regMap[regName];
        if (!parentReg) return 0;
        
        const value16 = this.getRegister(parentReg);
        if (regName.endsWith('h')) {
            // 高8位
            return (value16 >> 8) & 0xff;
        } else {
            // 低8位
            return value16 & 0xff;
        }
    }
    
    // 设置8位寄存器值
    setRegister8(name, value) {
        const regName = name.toLowerCase();
        // 8位寄存器映射到16位寄存器
        const regMap = {
            'al': 'ax', 'ah': 'ax',
            'bl': 'bx', 'bh': 'bx',
            'cl': 'cx', 'ch': 'cx',
            'dl': 'dx', 'dh': 'dx'
        };
        const parentReg = regMap[regName];
        if (!parentReg) return;
        
        const value16 = this.getRegister(parentReg);
        const newValue8 = value & 0xff;
        
        if (regName.endsWith('h')) {
            // 设置高8位
            this.setRegister(parentReg, (value16 & 0x00ff) | (newValue8 << 8));
        } else {
            // 设置低8位
            this.setRegister(parentReg, (value16 & 0xff00) | newValue8);
        }
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

    // 计算有效地址 (Effective Address) 用于寻址模式
    calculateEffectiveAddress(mod, rm, currentAddress) {
        let offset = 0;
        let address = 0;
        
        switch (mod) {
            case 0:
                // 无位移
                if (rm === 6) {
                    // [disp16] - 直接寻址
                    address = this.readMemory16(currentAddress + 2);
                    return { address, displacementSize: 2 };
                }
                break;
            case 1:
                // 8位位移
                offset = this.readMemory8(currentAddress + 2);
                // 符号扩展
                if (offset > 127) {
                    offset -= 256;
                }
                return { offset, displacementSize: 1 };
            case 2:
                // 16位位移
                offset = this.readMemory16(currentAddress + 2);
                return { offset, displacementSize: 2 };
            case 3:
                // 寄存器模式，不需要计算地址
                return { registerMode: true };
        }
        
        // 根据 rm 计算基地址
        switch (rm) {
            case 0:
                address = this.getRegister('bx') + this.getRegister('si');
                break;
            case 1:
                address = this.getRegister('bx') + this.getRegister('di');
                break;
            case 2:
                address = this.getRegister('bp') + this.getRegister('si');
                break;
            case 3:
                address = this.getRegister('bp') + this.getRegister('di');
                break;
            case 4:
                address = this.getRegister('si');
                break;
            case 5:
                address = this.getRegister('di');
                break;
            case 6:
                address = this.getRegister('bp');
                break;
            case 7:
                address = this.getRegister('bx');
                break;
        }
        
        // 添加位移
        address += offset;
        
        return { address, displacementSize: mod === 0 ? 0 : (mod === 1 ? 1 : 2) };
    }

    // 从 r/m 操作数读取8位值
    readRM8(mod, rm, currentAddress) {
        if (mod === 3) {
            // 寄存器模式
            const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const isHighByte = [false, false, false, false, true, true, true, true];
            const regName = rmToName[rm];
            const value = this.getRegister(regName);
            return isHighByte[rm] ? (value >> 8) & 0xff : value & 0xff;
        } else {
            // 内存模式
            const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
            return this.readMemory8(ea.address);
        }
    }

    // 从 r/m 操作数读取16位值
    readRM16(mod, rm, currentAddress) {
        if (mod === 3) {
            // 寄存器模式
            const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            return this.getRegister(rmToName[rm]);
        } else {
            // 内存模式
            const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
            return this.readMemory16(ea.address);
        }
    }

    // 向 r/m 操作数写入8位值
    writeRM8(mod, rm, currentAddress, value) {
        if (mod === 3) {
            // 寄存器模式
            const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const isHighByte = [false, false, false, false, true, true, true, true];
            const regName = rmToName[rm];
            const oldValue = this.getRegister(regName);
            const newValue = isHighByte[rm] ? 
                (oldValue & 0x00ff) | ((value & 0xff) << 8) : 
                (oldValue & 0xff00) | (value & 0xff);
            this.setRegister(regName, newValue);
        } else {
            // 内存模式
            const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
            this.writeMemory8(ea.address, value);
        }
    }

    // 向 r/m 操作数写入16位值
    writeRM16(mod, rm, currentAddress, value) {
        if (mod === 3) {
            // 寄存器模式
            const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            this.setRegister(rmToName[rm], value & 0xffff);
        } else {
            // 内存模式
            const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
            this.writeMemory16(ea.address, value);
        }
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
            // 对于减法，检查是否借位（无符号数溢出）
            if (operation === 'sub') {
                this.flags.cf = operand1 < operand2 ? 1 : 0;
            } else {
                this.flags.cf = result > 0xff ? 1 : 0;
            }
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
            case 0x20:
                // AH=20 不是标准 DOS 功能号，可能是程序错误
                // 直接返回避免陷入警告循环
                return true;
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
        // 将 DOS 扩展 ASCII (Code Page 437) 转换为 Unicode
        const char = this.dosCharToUnicode(dl);
        this.outputBuffer += char;
        if (this.updateOutputDisplay) {
            this.updateOutputDisplay();
        }
        // 更新IP到下一条指令
        this.ip += 2;
        this.ip &= 0xffff;
        return true;
    }

    // DOS 扩展 ASCII (Code Page 437) 到 Unicode 的转换
    dosCharToUnicode(code) {
        if (code < 128) {
            // 0-127 是标准 ASCII，直接返回
            return String.fromCharCode(code);
        }
        // 128-255 是扩展 ASCII，需要转换
        // Code Page 437 到 Unicode 的映射表
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
            // 将 DOS 扩展 ASCII 转换为 Unicode
            this.outputBuffer += this.dosCharToUnicode(char);
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
