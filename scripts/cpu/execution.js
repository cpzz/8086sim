// 重置CPU
CPU8086.prototype.reset = function() {
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

    // 重置各段内存访问跟踪
    this.lastSegmentAccessAddress = { cs: -1, ds: -1, ss: -1, es: -1 };

    // 重置键盘输入状态
    this.keyboardBuffer = [];
    this.waitingForKey = false;
    this._stringInputState = null;

    // 停止运行
    this.running = false;
    this.currentInstruction = null;
}

// 单步执行
CPU8086.prototype.step = function() {
    // 读取当前指令
    const currentAddress = this.getMemoryAddress(this.getSegmentRegister('cs'), this.ip);
    const opcode = this.readMemory8(currentAddress);


    // 简单的指令解码和执行
    let instructionLength = 1;

    switch (opcode) {
        case 0x00: { // ADD Eb, Gb (ADD r/m8, r8)
            const modrm00 = this.readMemory8(currentAddress + 1);
            const reg00 = (modrm00 >> 3) & 0x7;
            const mod00 = (modrm00 >> 6) & 0x3;
            const rm00 = modrm00 & 0x7;
            const reg8Names00 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal00 = this.getRegister8(reg8Names00[reg00]);
            if (mod00 === 3) {
                const dstVal00 = this.getRegister8(reg8Names00[rm00]);
                const res00 = dstVal00 + srcVal00;
                this.setRegister8(reg8Names00[rm00], res00 & 0xFF);
                this.updateFlags8(res00, dstVal00, srcVal00, 'add');
                instructionLength = 2;
            } else {
                const ea00 = this.calculateEffectiveAddress(mod00, rm00, currentAddress);
                const addr00 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea00.address);
                const dstVal00 = this.readMemory8(addr00);
                const res00 = dstVal00 + srcVal00;
                this.writeMemory8(addr00, res00 & 0xFF);
                this.updateFlags8(res00, dstVal00, srcVal00, 'add');
                instructionLength = 2 + ea00.displacementSize;
            }
            break;
        }
        case 0x02: { // ADD Gb, Eb (ADD r8, r/m8)
            const modrm02 = this.readMemory8(currentAddress + 1);
            const reg02 = (modrm02 >> 3) & 0x7;
            const mod02 = (modrm02 >> 6) & 0x3;
            const rm02 = modrm02 & 0x7;
            const reg8Names02 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal02 = this.getRegister8(reg8Names02[reg02]);
            let srcVal02;
            if (mod02 === 3) {
                srcVal02 = this.getRegister8(reg8Names02[rm02]);
                instructionLength = 2;
            } else {
                const ea02 = this.calculateEffectiveAddress(mod02, rm02, currentAddress);
                const addr02 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea02.address);
                srcVal02 = this.readMemory8(addr02);
                instructionLength = 2 + ea02.displacementSize;
            }
            const res02 = dstVal02 + srcVal02;
            this.setRegister8(reg8Names02[reg02], res02 & 0xFF);
            this.updateFlags8(res02, dstVal02, srcVal02, 'add');
            break;
        }
        case 0x03: { // ADD Gv, Ev (ADD r16, r/m16)
            const modrm03 = this.readMemory8(currentAddress + 1);
            const reg03 = (modrm03 >> 3) & 0x7;
            const mod03 = (modrm03 >> 6) & 0x3;
            const rm03 = modrm03 & 0x7;
            const regNames03 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const srcVal03 = this.readRM16(mod03, rm03, currentAddress);
            const dstVal03 = this.getRegister(regNames03[reg03]);
            const res03 = dstVal03 + srcVal03;
            this.setRegister(regNames03[reg03], res03);
            this.updateFlags16(res03, dstVal03, srcVal03, 'add');
            if (mod03 === 3) {
                instructionLength = 2;
            } else {
                const ea03 = this.calculateEffectiveAddress(mod03, rm03, currentAddress);
                instructionLength = 2 + ea03.displacementSize;
            }
            break;
        }
        case 0x08: { // OR Eb, Gb (OR r/m8, r8)
            const modrm08 = this.readMemory8(currentAddress + 1);
            const reg08 = (modrm08 >> 3) & 0x7;
            const mod08 = (modrm08 >> 6) & 0x3;
            const rm08 = modrm08 & 0x7;
            const reg8Names08 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal08 = this.getRegister8(reg8Names08[reg08]);
            if (mod08 === 3) {
                const dstVal08 = this.getRegister8(reg8Names08[rm08]);
                const res08 = dstVal08 | srcVal08;
                this.setRegister8(reg8Names08[rm08], res08 & 0xFF);
                this.updateFlags8(res08, dstVal08, srcVal08, 'or');
                instructionLength = 2;
            } else {
                const ea08 = this.calculateEffectiveAddress(mod08, rm08, currentAddress);
                const addr08 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea08.address);
                const dstVal08 = this.readMemory8(addr08);
                const res08 = dstVal08 | srcVal08;
                this.writeMemory8(addr08, res08 & 0xFF);
                this.updateFlags8(res08, dstVal08, srcVal08, 'or');
                instructionLength = 2 + ea08.displacementSize;
            }
            break;
        }
        case 0x0a: { // OR Gb, Eb (OR r8, r/m8)
            const modrm0a = this.readMemory8(currentAddress + 1);
            const reg0a = (modrm0a >> 3) & 0x7;
            const mod0a = (modrm0a >> 6) & 0x3;
            const rm0a = modrm0a & 0x7;
            const reg8Names0a = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal0a = this.getRegister8(reg8Names0a[reg0a]);
            let srcVal0a;
            if (mod0a === 3) {
                srcVal0a = this.getRegister8(reg8Names0a[rm0a]);
                instructionLength = 2;
            } else {
                const ea0a = this.calculateEffectiveAddress(mod0a, rm0a, currentAddress);
                const addr0a = this.getMemoryAddress(this.getSegmentRegister('ds'), ea0a.address);
                srcVal0a = this.readMemory8(addr0a);
                instructionLength = 2 + ea0a.displacementSize;
            }
            const res0a = dstVal0a | srcVal0a;
            this.setRegister8(reg8Names0a[reg0a], res0a & 0xFF);
            this.updateFlags8(res0a, dstVal0a, srcVal0a, 'or');
            break;
        }
        case 0x0b: { // OR Gv, Ev (OR r16, r/m16)
            const modrm0b = this.readMemory8(currentAddress + 1);
            const reg0b = (modrm0b >> 3) & 0x7;
            const mod0b = (modrm0b >> 6) & 0x3;
            const rm0b = modrm0b & 0x7;
            const regToName0b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const srcVal0b = this.readRM16(mod0b, rm0b, currentAddress);
            const dstVal0b = this.getRegister(regToName0b[reg0b]);
            const res0b = dstVal0b | srcVal0b;
            this.setRegister(regToName0b[reg0b], res0b);
            this.updateFlags16(res0b, dstVal0b, srcVal0b, 'or');
            if (mod0b === 3) {
                instructionLength = 2;
            } else {
                const ea0b = this.calculateEffectiveAddress(mod0b, rm0b, currentAddress);
                instructionLength = 2 + ea0b.displacementSize;
            }
            break;
        }
        case 0x10: { // ADC Eb, Gb (ADC r/m8, r8)
            const modrm10 = this.readMemory8(currentAddress + 1);
            const reg10 = (modrm10 >> 3) & 0x7;
            const mod10 = (modrm10 >> 6) & 0x3;
            const rm10 = modrm10 & 0x7;
            const reg8Names10 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal10 = this.getRegister8(reg8Names10[reg10]);
            const carry10 = this.flags.cf;
            if (mod10 === 3) {
                const dstVal10 = this.getRegister8(reg8Names10[rm10]);
                const res10 = dstVal10 + srcVal10 + carry10;
                this.setRegister8(reg8Names10[rm10], res10 & 0xFF);
                this.updateFlags8(res10, dstVal10, srcVal10 + carry10, 'add');
                instructionLength = 2;
            } else {
                const ea10 = this.calculateEffectiveAddress(mod10, rm10, currentAddress);
                const addr10 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea10.address);
                const dstVal10 = this.readMemory8(addr10);
                const res10 = dstVal10 + srcVal10 + carry10;
                this.writeMemory8(addr10, res10 & 0xFF);
                this.updateFlags8(res10, dstVal10, srcVal10 + carry10, 'add');
                instructionLength = 2 + ea10.displacementSize;
            }
            break;
        }
        case 0x11: { // ADC Ev, Gv (ADC r/m16, r16)
            const modrm11 = this.readMemory8(currentAddress + 1);
            const reg11 = (modrm11 >> 3) & 0x7;
            const mod11 = (modrm11 >> 6) & 0x3;
            const rm11 = modrm11 & 0x7;
            const regToName11 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const srcVal11 = this.getRegister(regToName11[reg11]);
            const dstVal11 = this.readRM16(mod11, rm11, currentAddress);
            const carry11 = this.flags.cf;
            const res11 = dstVal11 + srcVal11 + carry11;
            this.writeRM16(mod11, rm11, currentAddress, res11);
            this.updateFlags16(res11, dstVal11, srcVal11 + carry11, 'add');
            if (mod11 === 3) {
                instructionLength = 2;
            } else {
                const ea11 = this.calculateEffectiveAddress(mod11, rm11, currentAddress);
                instructionLength = 2 + ea11.displacementSize;
            }
            break;
        }
        case 0x12: { // ADC Gb, Eb (ADC r8, r/m8)
            const modrm12 = this.readMemory8(currentAddress + 1);
            const reg12 = (modrm12 >> 3) & 0x7;
            const mod12 = (modrm12 >> 6) & 0x3;
            const rm12 = modrm12 & 0x7;
            const reg8Names12 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal12 = this.getRegister8(reg8Names12[reg12]);
            const carry12 = this.flags.cf;
            let srcVal12;
            if (mod12 === 3) {
                srcVal12 = this.getRegister8(reg8Names12[rm12]);
                instructionLength = 2;
            } else {
                const ea12 = this.calculateEffectiveAddress(mod12, rm12, currentAddress);
                const addr12 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea12.address);
                srcVal12 = this.readMemory8(addr12);
                instructionLength = 2 + ea12.displacementSize;
            }
            const res12 = dstVal12 + srcVal12 + carry12;
            this.setRegister8(reg8Names12[reg12], res12 & 0xFF);
            this.updateFlags8(res12, dstVal12, srcVal12 + carry12, 'add');
            break;
        }
        case 0x18: { // SBB Eb, Gb (SBB r/m8, r8)
            const modrm18 = this.readMemory8(currentAddress + 1);
            const reg18 = (modrm18 >> 3) & 0x7;
            const mod18 = (modrm18 >> 6) & 0x3;
            const rm18 = modrm18 & 0x7;
            const reg8Names18 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal18 = this.getRegister8(reg8Names18[reg18]);
            const carry18 = this.flags.cf;
            if (mod18 === 3) {
                const dstVal18 = this.getRegister8(reg8Names18[rm18]);
                const res18 = dstVal18 - srcVal18 - carry18;
                this.setRegister8(reg8Names18[rm18], res18 & 0xFF);
                this.updateFlags8(res18, dstVal18, srcVal18 + carry18, 'sub');
                instructionLength = 2;
            } else {
                const ea18 = this.calculateEffectiveAddress(mod18, rm18, currentAddress);
                const addr18 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea18.address);
                const dstVal18 = this.readMemory8(addr18);
                const res18 = dstVal18 - srcVal18 - carry18;
                this.writeMemory8(addr18, res18 & 0xFF);
                this.updateFlags8(res18, dstVal18, srcVal18 + carry18, 'sub');
                instructionLength = 2 + ea18.displacementSize;
            }
            break;
        }
        case 0x1a: { // SBB Gb, Eb (SBB r8, r/m8)
            const modrm1a = this.readMemory8(currentAddress + 1);
            const reg1a = (modrm1a >> 3) & 0x7;
            const mod1a = (modrm1a >> 6) & 0x3;
            const rm1a = modrm1a & 0x7;
            const reg8Names1a = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal1a = this.getRegister8(reg8Names1a[reg1a]);
            const carry1a = this.flags.cf;
            let srcVal1a;
            if (mod1a === 3) {
                srcVal1a = this.getRegister8(reg8Names1a[rm1a]);
                instructionLength = 2;
            } else {
                const ea1a = this.calculateEffectiveAddress(mod1a, rm1a, currentAddress);
                const addr1a = this.getMemoryAddress(this.getSegmentRegister('ds'), ea1a.address);
                srcVal1a = this.readMemory8(addr1a);
                instructionLength = 2 + ea1a.displacementSize;
            }
            const res1a = dstVal1a - srcVal1a - carry1a;
            this.setRegister8(reg8Names1a[reg1a], res1a & 0xFF);
            this.updateFlags8(res1a, dstVal1a, srcVal1a + carry1a, 'sub');
            break;
        }
        case 0x20: { // AND Eb, Gb (AND r/m8, r8)
            const modrm20 = this.readMemory8(currentAddress + 1);
            const reg20 = (modrm20 >> 3) & 0x7;
            const mod20 = (modrm20 >> 6) & 0x3;
            const rm20 = modrm20 & 0x7;
            const reg8Names20 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal20 = this.getRegister8(reg8Names20[reg20]);
            if (mod20 === 3) {
                const dstVal20 = this.getRegister8(reg8Names20[rm20]);
                const res20 = dstVal20 & srcVal20;
                this.setRegister8(reg8Names20[rm20], res20 & 0xFF);
                this.updateFlags8(res20, dstVal20, srcVal20, 'and');
                instructionLength = 2;
            } else {
                const ea20 = this.calculateEffectiveAddress(mod20, rm20, currentAddress);
                const addr20 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea20.address);
                const dstVal20 = this.readMemory8(addr20);
                const res20 = dstVal20 & srcVal20;
                this.writeMemory8(addr20, res20 & 0xFF);
                this.updateFlags8(res20, dstVal20, srcVal20, 'and');
                instructionLength = 2 + ea20.displacementSize;
            }
            break;
        }
        case 0x22: { // AND Gb, Eb (AND r8, r/m8)
            const modrm22 = this.readMemory8(currentAddress + 1);
            const reg22 = (modrm22 >> 3) & 0x7;
            const mod22 = (modrm22 >> 6) & 0x3;
            const rm22 = modrm22 & 0x7;
            const reg8Names22 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal22 = this.getRegister8(reg8Names22[reg22]);
            let srcVal22;
            if (mod22 === 3) {
                srcVal22 = this.getRegister8(reg8Names22[rm22]);
                instructionLength = 2;
            } else {
                const ea22 = this.calculateEffectiveAddress(mod22, rm22, currentAddress);
                const addr22 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea22.address);
                srcVal22 = this.readMemory8(addr22);
                instructionLength = 2 + ea22.displacementSize;
            }
            const res22 = dstVal22 & srcVal22;
            this.setRegister8(reg8Names22[reg22], res22 & 0xFF);
            this.updateFlags8(res22, dstVal22, srcVal22, 'and');
            break;
        }
        case 0x28: { // SUB Eb, Gb (SUB r/m8, r8)
            const modrm28 = this.readMemory8(currentAddress + 1);
            const reg28 = (modrm28 >> 3) & 0x7;
            const mod28 = (modrm28 >> 6) & 0x3;
            const rm28 = modrm28 & 0x7;
            const reg8Names28 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal28 = this.getRegister8(reg8Names28[reg28]);
            if (mod28 === 3) {
                const dstVal28 = this.getRegister8(reg8Names28[rm28]);
                const res28 = dstVal28 - srcVal28;
                this.setRegister8(reg8Names28[rm28], res28 & 0xFF);
                this.updateFlags8(res28, dstVal28, srcVal28, 'sub');
                instructionLength = 2;
            } else {
                const ea28 = this.calculateEffectiveAddress(mod28, rm28, currentAddress);
                const addr28 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea28.address);
                const dstVal28 = this.readMemory8(addr28);
                const res28 = dstVal28 - srcVal28;
                this.writeMemory8(addr28, res28 & 0xFF);
                this.updateFlags8(res28, dstVal28, srcVal28, 'sub');
                instructionLength = 2 + ea28.displacementSize;
            }
            break;
        }
        case 0x2a: { // SUB Gb, Eb (SUB r8, r/m8)
            const modrm2a = this.readMemory8(currentAddress + 1);
            const reg2a = (modrm2a >> 3) & 0x7;
            const mod2a = (modrm2a >> 6) & 0x3;
            const rm2a = modrm2a & 0x7;
            const reg8Names2a = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal2a = this.getRegister8(reg8Names2a[reg2a]);
            let srcVal2a;
            if (mod2a === 3) {
                srcVal2a = this.getRegister8(reg8Names2a[rm2a]);
                instructionLength = 2;
            } else {
                const ea2a = this.calculateEffectiveAddress(mod2a, rm2a, currentAddress);
                const addr2a = this.getMemoryAddress(this.getSegmentRegister('ds'), ea2a.address);
                srcVal2a = this.readMemory8(addr2a);
                instructionLength = 2 + ea2a.displacementSize;
            }
            const res2a = dstVal2a - srcVal2a;
            this.setRegister8(reg8Names2a[reg2a], res2a & 0xFF);
            this.updateFlags8(res2a, dstVal2a, srcVal2a, 'sub');
            break;
        }
        case 0x30: { // XOR Eb, Gb (XOR r/m8, r8)
            const modrm30 = this.readMemory8(currentAddress + 1);
            const reg30 = (modrm30 >> 3) & 0x7;
            const mod30 = (modrm30 >> 6) & 0x3;
            const rm30 = modrm30 & 0x7;
            const reg8Names30 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal30 = this.getRegister8(reg8Names30[reg30]);
            if (mod30 === 3) {
                const dstVal30 = this.getRegister8(reg8Names30[rm30]);
                const res30 = dstVal30 ^ srcVal30;
                this.setRegister8(reg8Names30[rm30], res30 & 0xFF);
                this.updateFlags8(res30, dstVal30, srcVal30, 'xor');
                instructionLength = 2;
            } else {
                const ea30 = this.calculateEffectiveAddress(mod30, rm30, currentAddress);
                const addr30 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea30.address);
                const dstVal30 = this.readMemory8(addr30);
                const res30 = dstVal30 ^ srcVal30;
                this.writeMemory8(addr30, res30 & 0xFF);
                this.updateFlags8(res30, dstVal30, srcVal30, 'xor');
                instructionLength = 2 + ea30.displacementSize;
            }
            break;
        }
        case 0x32: { // XOR Gb, Eb (XOR r8, r/m8)
            const modrm32 = this.readMemory8(currentAddress + 1);
            const reg32 = (modrm32 >> 3) & 0x7;
            const mod32 = (modrm32 >> 6) & 0x3;
            const rm32 = modrm32 & 0x7;
            const reg8Names32 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstVal32 = this.getRegister8(reg8Names32[reg32]);
            let srcVal32;
            if (mod32 === 3) {
                srcVal32 = this.getRegister8(reg8Names32[rm32]);
                instructionLength = 2;
            } else {
                const ea32 = this.calculateEffectiveAddress(mod32, rm32, currentAddress);
                const addr32 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea32.address);
                srcVal32 = this.readMemory8(addr32);
                instructionLength = 2 + ea32.displacementSize;
            }
            const res32 = dstVal32 ^ srcVal32;
            this.setRegister8(reg8Names32[reg32], res32 & 0xFF);
            this.updateFlags8(res32, dstVal32, srcVal32, 'xor');
            break;
        }
        case 0x33: { // XOR Gv, Ev (XOR r16, r/m16)
            const modrm33 = this.readMemory8(currentAddress + 1);
            const reg33 = (modrm33 >> 3) & 0x7;
            const mod33 = (modrm33 >> 6) & 0x3;
            const rm33 = modrm33 & 0x7;
            const regToName33 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const srcVal33 = this.readRM16(mod33, rm33, currentAddress);
            const dstVal33 = this.getRegister(regToName33[reg33]);
            const res33 = dstVal33 ^ srcVal33;
            this.setRegister(regToName33[reg33], res33);
            this.updateFlags16(res33, dstVal33, srcVal33, 'xor');
            if (mod33 === 3) {
                instructionLength = 2;
            } else {
                const ea33 = this.calculateEffectiveAddress(mod33, rm33, currentAddress);
                instructionLength = 2 + ea33.displacementSize;
            }
            break;
        }
        case 0x38: { // CMP Eb, Gb (CMP r/m8, r8)
            const modrm38 = this.readMemory8(currentAddress + 1);
            const reg38 = (modrm38 >> 3) & 0x7;
            const mod38 = (modrm38 >> 6) & 0x3;
            const rm38 = modrm38 & 0x7;
            const reg8Names38 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const srcVal38 = this.getRegister8(reg8Names38[reg38]);
            let dstVal38;
            if (mod38 === 3) {
                dstVal38 = this.getRegister8(reg8Names38[rm38]);
                instructionLength = 2;
            } else {
                const ea38 = this.calculateEffectiveAddress(mod38, rm38, currentAddress);
                const addr38 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea38.address);
                dstVal38 = this.readMemory8(addr38);
                instructionLength = 2 + ea38.displacementSize;
            }
            const res38 = dstVal38 - srcVal38;
            this.updateFlags8(res38, dstVal38, srcVal38, 'sub');
            break;
        }
        case 0x3b: { // CMP Gv, Ev (CMP r16, r/m16)
            const modrm3b = this.readMemory8(currentAddress + 1);
            const reg3b = (modrm3b >> 3) & 0x7;
            const mod3b = (modrm3b >> 6) & 0x3;
            const rm3b = modrm3b & 0x7;
            const regToName3b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const srcVal3b = this.readRM16(mod3b, rm3b, currentAddress);
            const dstVal3b = this.getRegister(regToName3b[reg3b]);
            const res3b = dstVal3b - srcVal3b;
            this.updateFlags16(res3b, dstVal3b, srcVal3b, 'sub');
            if (mod3b === 3) {
                instructionLength = 2;
            } else {
                const ea3b = this.calculateEffectiveAddress(mod3b, rm3b, currentAddress);
                instructionLength = 2 + ea3b.displacementSize;
            }
            break;
        }
        case 0x04: { // ADD AL, Ib
            const imm8 = this.readMemory8(currentAddress + 1);
            const al = this.getRegister('ax') & 0xff;
            const result = al + imm8;
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (result & 0xff));
            // 设置标志位
            this.updateFlags8(result, al, imm8);
            instructionLength = 2;
            break;
        }
        case 0x05: { // ADD AX, Iv
            const imm16 = this.readMemory16(currentAddress + 1);
            const ax = this.getRegister('ax');
            const result16 = ax + imm16;
            this.setRegister('ax', result16);
            // 设置标志位
            this.updateFlags16(result16, ax, imm16);
            instructionLength = 3;
            break;
        }
        case 0x13: { // ADC Gv, Ev (ADC r16, r/m16)
            const modrm13 = this.readMemory8(currentAddress + 1);
            const reg13 = (modrm13 >> 3) & 0x7;
            const mod13 = (modrm13 >> 6) & 0x3;
            const rm13 = modrm13 & 0x7;

            // 寄存器映射
            const regToName13 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源操作数值（支持所有寻址模式）
            const srcValue13 = this.readRM16(mod13, rm13, currentAddress);
            
            // 读取目标寄存器值
            const dstValue13 = this.getRegister(regToName13[reg13]);
            
            // 执行 ADC 操作
            const result13 = dstValue13 + srcValue13 + this.flags.cf;
            
            // 写回结果
            this.setRegister(regToName13[reg13], result13);
            
            // 更新标志位
            this.updateFlags16(result13, dstValue13, srcValue13 + this.flags.cf, 'add');
            
            // 计算指令长度
            if (mod13 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod13, rm13, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        }
        case 0x14: { // ADC AL, Ib
            const imm8adc = this.readMemory8(currentAddress + 1);
            const aladc = this.getRegister('ax') & 0xff;
            const result8adc = aladc + imm8adc + this.flags.cf;
            this.setRegister('ax', (this.getRegister('ax') & 0xff00) | (result8adc & 0xff));
            // 设置标志位
            this.updateFlags8(result8adc, aladc, imm8adc + this.flags.cf, 'add');
            instructionLength = 2;
            break;
        }
        case 0x15: { // ADC AX, Iv
            const imm16adc = this.readMemory16(currentAddress + 1);
            const axadc = this.getRegister('ax');
            const result16adc = axadc + imm16adc + this.flags.cf;
            this.setRegister('ax', result16adc);
            // 设置标志位
            this.updateFlags16(result16adc, axadc, imm16adc + this.flags.cf, 'add');
            instructionLength = 3;
            break;
        }
        case 0x19: { // SBB r/m16, r16
            const modrm19 = this.readMemory8(currentAddress + 1);
            const reg19 = (modrm19 >> 3) & 0x7;
            const mod19 = (modrm19 >> 6) & 0x3;
            const rm19 = modrm19 & 0x7;

            // 寄存器映射
            const regToName19 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源寄存器值
            const srcValue19 = this.getRegister(regToName19[reg19]);
            
            // 读取目标操作数值（支持所有寻址模式）
            const dstValue19 = this.readRM16(mod19, rm19, currentAddress);
            
            // 执行 SBB 操作
            const carry19 = this.flags.cf;
            const result19 = dstValue19 - srcValue19 - carry19;
            
            // 写回结果（支持所有寻址模式）
            this.writeRM16(mod19, rm19, currentAddress, result19);
            
            // 更新标志位
            this.updateFlags16(result19, dstValue19, srcValue19 + carry19, 'sub');
            
            // 计算指令长度
            if (mod19 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod19, rm19, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        }
        case 0x1b: { // SBB r16, r/m16
            const modrm1b = this.readMemory8(currentAddress + 1);
            const reg1b = (modrm1b >> 3) & 0x7;
            const mod1b = (modrm1b >> 6) & 0x3;
            const rm1b = modrm1b & 0x7;

            // 寄存器映射
            const regToName1b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源操作数值（支持所有寻址模式）
            const srcValue1b = this.readRM16(mod1b, rm1b, currentAddress);
            
            // 读取目标寄存器值
            const dstValue1b = this.getRegister(regToName1b[reg1b]);
            
            // 执行 SBB 操作
            const carry1b = this.flags.cf;
            const result1b = dstValue1b - srcValue1b - carry1b;
            
            // 写回结果
            this.setRegister(regToName1b[reg1b], result1b);
            
            // 更新标志位
            this.updateFlags16(result1b, dstValue1b, srcValue1b + carry1b, 'sub');
            
            // 计算指令长度
            if (mod1b === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod1b, rm1b, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        }
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
            this.setRegister('ax', result16sbb);
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
            this.setRegister('ax', resultsub16);
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
            
            // 读取源寄存器值
            const srcValue29 = this.getRegister(regToName29[reg29]);
            
            // 读取目标操作数值（支持所有寻址模式）
            const dstValue29 = this.readRM16(mod29, rm29, currentAddress);
            
            // 执行 SUB 操作
            const result29 = dstValue29 - srcValue29;
            
            // 写回结果（支持所有寻址模式）
            this.writeRM16(mod29, rm29, currentAddress, result29);
            
            // 更新标志位
            this.updateFlags16(result29, dstValue29, srcValue29, 'sub');
            
            // 计算指令长度
            if (mod29 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod29, rm29, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0x2b: // SUB r16, r/m16
            const modrm2b = this.readMemory8(currentAddress + 1);
            const reg2b = (modrm2b >> 3) & 0x7;
            const mod2b = (modrm2b >> 6) & 0x3;
            const rm2b = modrm2b & 0x7;

            // 寄存器映射
            const regToName2b = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源操作数值（支持所有寻址模式）
            const srcValue2b = this.readRM16(mod2b, rm2b, currentAddress);
            
            // 读取目标寄存器值
            const dstValue2b = this.getRegister(regToName2b[reg2b]);
            
            // 执行 SUB 操作
            const result2b = dstValue2b - srcValue2b;
            
            // 写回结果
            this.setRegister(regToName2b[reg2b], result2b);
            
            // 更新标志位
            this.updateFlags16(result2b, dstValue2b, srcValue2b, 'sub');
            
            // 计算指令长度
            if (mod2b === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod2b, rm2b, currentAddress);
                instructionLength = 2 + ea.displacementSize;
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
            this.setRegister('ax', resultand16);
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
            this.setRegister('ax', resultor16);
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
            this.setRegister('ax', resultxor16);
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
            
            // 读取源寄存器值
            const srcValue31 = this.getRegister(regToName31[reg31]);
            
            // 读取目标操作数值（支持所有寻址模式）
            const dstValue31 = this.readRM16(mod31, rm31, currentAddress);
            
            // 执行 XOR 操作
            const result31 = dstValue31 ^ srcValue31;
            
            // 写回结果（支持所有寻址模式）
            this.writeRM16(mod31, rm31, currentAddress, result31);
            
            // 更新标志位
            this.updateFlags16(result31, dstValue31, srcValue31);
            
            // 计算指令长度
            if (mod31 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod31, rm31, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0x87: // XCHG r/m16, r16
            const modrm87 = this.readMemory8(currentAddress + 1);
            const reg87 = (modrm87 >> 3) & 0x7;
            const mod87 = (modrm87 >> 6) & 0x3;
            const rm87 = modrm87 & 0x7;

            // 寄存器映射
            const regToName87 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const rmToName87 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

            if (mod87 === 3) {
                // 寄存器到寄存器 XCHG
                const srcValue87 = this.getRegister(regToName87[reg87]);
                const dstValue87 = this.getRegister(rmToName87[rm87]);
                this.setRegister(rmToName87[rm87], srcValue87);
                this.setRegister(regToName87[reg87], dstValue87);
                instructionLength = 2;
            } else {
                const ea87 = this.calculateEffectiveAddress(mod87, rm87, currentAddress);
                const addr87 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea87.address);
                const regVal87 = this.getRegister(regToName87[reg87]);
                const memVal87 = this.readMemory16(addr87);
                this.writeMemory16(addr87, regVal87);
                this.setRegister(regToName87[reg87], memVal87);
                instructionLength = 2 + ea87.displacementSize;
            }
            break;
        case 0x86: // XCHG r/m8, r8
            const modrm86 = this.readMemory8(currentAddress + 1);
            const reg86 = (modrm86 >> 3) & 0x7;
            const mod86 = (modrm86 >> 6) & 0x3;
            const rm86 = modrm86 & 0x7;

            // 8位寄存器映射
            const regToName86 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const rmToName86 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];

            if (mod86 === 3) {
                const srcValue86 = this.getRegister8(regToName86[reg86]);
                const dstValue86 = this.getRegister8(rmToName86[rm86]);
                this.setRegister8(rmToName86[rm86], srcValue86 & 0xff);
                this.setRegister8(regToName86[reg86], dstValue86 & 0xff);
                instructionLength = 2;
            } else {
                const ea86 = this.calculateEffectiveAddress(mod86, rm86, currentAddress);
                const addr86 = this.getMemoryAddress(this.getSegmentRegister('ds'), ea86.address);
                const regVal86 = this.getRegister8(regToName86[reg86]);
                const memVal86 = this.readMemory8(addr86);
                this.writeMemory8(addr86, regVal86);
                this.setRegister8(regToName86[reg86], memVal86);
                instructionLength = 2 + ea86.displacementSize;
            }
            break;
        case 0x21: // AND r/m16, r16
            const modrm21 = this.readMemory8(currentAddress + 1);
            const reg21 = (modrm21 >> 3) & 0x7;
            const mod21 = (modrm21 >> 6) & 0x3;
            const rm21 = modrm21 & 0x7;

            // 寄存器映射
            const regToName21 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源寄存器值
            const srcValue21 = this.getRegister(regToName21[reg21]);
            
            // 读取目标操作数值（支持所有寻址模式）
            const dstValue21 = this.readRM16(mod21, rm21, currentAddress);
            
            // 执行 AND 操作
            const result21 = dstValue21 & srcValue21;
            
            // 写回结果（支持所有寻址模式）
            this.writeRM16(mod21, rm21, currentAddress, result21);
            
            // 更新标志位
            this.updateFlags16(result21, dstValue21, srcValue21);
            
            // 计算指令长度
            if (mod21 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod21, rm21, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0x23: // AND r16, r/m16
            const modrm23 = this.readMemory8(currentAddress + 1);
            const reg23 = (modrm23 >> 3) & 0x7;
            const mod23 = (modrm23 >> 6) & 0x3;
            const rm23 = modrm23 & 0x7;

            // 寄存器映射
            const regToName23 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取目标寄存器值 (reg field = destination for 0x23)
            const dstValue23 = this.getRegister(regToName23[reg23]);
            
            // 读取源操作数值（r/m字段 = source）
            const srcValue23 = this.readRM16(mod23, rm23, currentAddress);
            
            // 执行 AND 操作
            const result23 = dstValue23 & srcValue23;
            
            // 写回结果到寄存器
            this.setRegister(regToName23[reg23], result23);
            
            // 更新标志位
            this.updateFlags16(result23, dstValue23, srcValue23);
            
            // 计算指令长度
            if (mod23 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod23, rm23, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0x09: // OR r/m16, r16
            const modrm09 = this.readMemory8(currentAddress + 1);
            const reg09 = (modrm09 >> 3) & 0x7;
            const mod09 = (modrm09 >> 6) & 0x3;
            const rm09 = modrm09 & 0x7;

            // 寄存器映射
            const regToName09 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源寄存器值
            const srcValue09 = this.getRegister(regToName09[reg09]);
            
            // 读取目标操作数值（支持所有寻址模式）
            const dstValue09 = this.readRM16(mod09, rm09, currentAddress);
            
            // 执行 OR 操作
            const result09 = dstValue09 | srcValue09;
            
            // 写回结果（支持所有寻址模式）
            this.writeRM16(mod09, rm09, currentAddress, result09);
            
            // 更新标志位
            this.updateFlags16(result09, dstValue09, srcValue09);
            
            // 计算指令长度
            if (mod09 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod09, rm09, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0x01: // ADD r/m16, r16
            const modrm01 = this.readMemory8(currentAddress + 1);
            const reg01 = (modrm01 >> 3) & 0x7;
            const mod01 = (modrm01 >> 6) & 0x3;
            const rm01 = modrm01 & 0x7;

            // 寄存器映射
            const regToName01 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            // 读取源寄存器值
            const srcValue01 = this.getRegister(regToName01[reg01]);
            
            // 读取目标操作数值（支持所有寻址模式）
            const dstValue01 = this.readRM16(mod01, rm01, currentAddress);
            
            // 执行 ADD 操作
            const result01 = dstValue01 + srcValue01;
            
            // 写回结果（支持所有寻址模式）
            this.writeRM16(mod01, rm01, currentAddress, result01);
            
            // 更新标志位
            this.updateFlags16(result01, dstValue01, srcValue01);
            
            // 计算指令长度
            if (mod01 === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod01, rm01, currentAddress);
                instructionLength = 2 + ea.displacementSize;
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
        case 0x8a: { // MOV Gb, Eb (Gb是目标，Eb是源) - 8位版本
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
        }
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
        case 0x89: { // MOV Ev, Gv (Gv是源，Ev是目标)
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
        }
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
        case 0xc2: // RET imm16 (near return with pop of imm16 bytes)
            {
                const imm16 = this.readMemory16(currentAddress + 1);
                const currentSP = this.getRegister('sp');
                if (currentSP === 0xfffe) {
                    // 没有调用过函数，执行完最后一条指令
                    return false;
                } else {
                    // 从堆栈弹出返回地址
                    const returnAddress = this.readMemory16(this.getMemoryAddress(this.getSegmentRegister('ss'), currentSP));
                    // SP = SP + 2 (弹出返回地址) + imm16 (清除参数)
                    this.setRegister('sp', currentSP + 2 + imm16);
                    this.ip = returnAddress;
                }
                // 对于RET指令，不需要再增加IP，因为已经设置了returnAddress
                instructionLength = 0;
            }
            break;
        case 0xc3: // RET
            const currentSP = this.getRegister('sp');
            if (currentSP === 0xfffe) {
                // 没有调用过函数，执行完最后一条指令
                // 保持SP为初始值，符合DOS行为
                // 设置IP为0xffff，表明无法继续执行
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
            if (!this.handleInterrupt(interruptNum)) {
                // 中断处理需要阻塞（如等待键盘输入），不推进IP
                return false;
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
        {
            const regInc = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][opcode - 0x40];
            const valueInc = this.registers[regInc];
            const resultInc = (valueInc + 1) & 0xFFFF;
            this.setRegister(regInc, resultInc);
            // INC updates OF, SF, ZF, AF, PF (preserves CF)
            this.flags.zf = (resultInc === 0) ? 1 : 0;
            this.flags.sf = (resultInc & 0x8000) ? 1 : 0;
            this.flags.of = (valueInc === 0x7FFF) ? 1 : 0;
            this.flags.af = ((valueInc & 0x0F) === 0x0F) ? 1 : 0;
            let parityInc = 0;
            let vpInc = resultInc & 0xff;
            for (let i = 0; i < 8; i++) { parityInc += vpInc & 1; vpInc >>= 1; }
            this.flags.pf = (parityInc % 2 === 0) ? 1 : 0;
            instructionLength = 1;
            break;
        }
        case 0x48: // DEC AX
        case 0x49: // DEC CX
        case 0x4a: // DEC DX
        case 0x4b: // DEC BX
        case 0x4c: // DEC SP
        case 0x4d: // DEC BP
        case 0x4e: // DEC SI
        case 0x4f: // DEC DI
        {
            const regDec = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][opcode - 0x48];
            const valueDec = this.registers[regDec];
            const resultDec = (valueDec - 1) & 0xFFFF;
            this.setRegister(regDec, resultDec);
            // DEC updates OF, SF, ZF, AF, PF (preserves CF)
            this.flags.zf = (resultDec === 0) ? 1 : 0;
            this.flags.sf = (resultDec & 0x8000) ? 1 : 0;
            this.flags.of = (valueDec === 0x8000) ? 1 : 0;
            this.flags.af = ((valueDec & 0x0F) === 0x00) ? 1 : 0;
            let parityDec = 0;
            let vpDec = resultDec & 0xff;
            for (let i = 0; i < 8; i++) { parityDec += vpDec & 1; vpDec >>= 1; }
            this.flags.pf = (parityDec % 2 === 0) ? 1 : 0;
            instructionLength = 1;
            break;
        }
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
        case 0x84: { // TEST r/m8, r8
            const modrm84 = this.readMemory8(currentAddress + 1);
            const reg84 = (modrm84 >> 3) & 0x7;
            const mod84 = (modrm84 >> 6) & 0x3;
            const rm84 = modrm84 & 0x7;
            
            const reg8Map84 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const reg16ToName84 = ['ax', 'cx', 'dx', 'bx', 'ax', 'cx', 'dx', 'bx'];
            const isHigh84 = [false, false, false, false, true, true, true, true];
            
            let op1, op2;
            
            if (mod84 === 3) {
                // 寄存器模式
                const base1 = reg16ToName84[rm84];
                const full1 = this.getRegister(base1);
                op1 = isHigh84[rm84] ? ((full1 >> 8) & 0xff) : (full1 & 0xff);
                
                const base2 = reg16ToName84[reg84];
                const full2 = this.getRegister(base2);
                op2 = isHigh84[reg84] ? ((full2 >> 8) & 0xff) : (full2 & 0xff);
                
                instructionLength = 2;
            } else {
                // 内存模式
                const ea = this.calculateEffectiveAddress(mod84, rm84, currentAddress);
                op1 = this.readMemory8(ea.address);
                
                const base2 = reg16ToName84[reg84];
                const full2 = this.getRegister(base2);
                op2 = isHigh84[reg84] ? ((full2 >> 8) & 0xff) : (full2 & 0xff);
                
                instructionLength = 2 + ea.displacementSize;
            }
            
            const result84 = op1 & op2;
            this.updateFlags8(result84, op1, op2, 'and');
            break;
        }
        case 0x85: { // TEST r/m16, r16
            const modrm85 = this.readMemory8(currentAddress + 1);
            const reg85 = (modrm85 >> 3) & 0x7;
            const mod85 = (modrm85 >> 6) & 0x3;
            const rm85 = modrm85 & 0x7;
            
            const rmToName85 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            
            let op1, op2;
            
            if (mod85 === 3) {
                // 寄存器模式
                op1 = this.getRegister(rmToName85[rm85]);
                op2 = this.getRegister(rmToName85[reg85]);
                instructionLength = 2;
            } else {
                // 内存模式
                const ea = this.calculateEffectiveAddress(mod85, rm85, currentAddress);
                op1 = this.readMemory16(ea.address);
                op2 = this.getRegister(rmToName85[reg85]);
                instructionLength = 2 + ea.displacementSize;
            }
            
            const result85 = op1 & op2;
            this.updateFlags16(result85, op1, op2, 'and');
            break;
        }
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
                    result = ((oldValue << 1) | carryOut);
                } else if (reg16 === 1) {
                    // ROR - 循环右移
                    carryOut = oldValue & 0x0001;
                    result = ((oldValue >> 1) | (carryOut << 15));
                } else if (reg16 === 4) {
                    // SHL
                    carryOut = (oldValue & 0x8000) >> 15;
                    result = (oldValue << 1);
                } else if (reg16 === 5) {
                    // SHR
                    carryOut = oldValue & 0x0001;
                    result = (oldValue >> 1);
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
        case 0xd2: // SHL/SHR/ROL/ROR r/m8, CL
            const modrm8cl = this.readMemory8(currentAddress + 1);
            const reg8cl = (modrm8cl >> 3) & 0x7; // 0=ROL, 1=ROR, 4=SHL, 5=SHR
            const mod8cl = (modrm8cl >> 6) & 0x3;
            const rm8cl = modrm8cl & 0x7;

            // 8位寄存器映射
            const rmToName8cl = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const isHighBytecl = [false, false, false, false, true, true, true, true];

            // 读取操作数值（支持所有寻址模式）
            let oldByteValue8;
            let oldValue8;
            let destReg8;
            
            if (mod8cl === 3) {
                // 寄存器模式
                destReg8 = rmToName8cl[rm8cl];
                oldValue8 = this.getRegister(destReg8);
                oldByteValue8 = isHighBytecl[rm8cl] ? (oldValue8 >> 8) & 0xff : oldValue8 & 0xff;
            } else {
                // 内存模式
                oldByteValue8 = this.readRM8(mod8cl, rm8cl, currentAddress);
            }
            
            const shiftCount8 = this.getRegister('cx') & 0xff;
            let result8 = oldByteValue8;
            let carryOut8 = 0;

            if (reg8cl === 0) {
                // ROL - 循环左移
                for (let i = 0; i < shiftCount8; i++) {
                    carryOut8 = (result8 & 0x80) >> 7;
                    result8 = ((result8 << 1) | carryOut8) & 0xff;
                }
            } else if (reg8cl === 1) {
                // ROR - 循环右移
                for (let i = 0; i < shiftCount8; i++) {
                    carryOut8 = result8 & 0x01;
                    result8 = ((result8 >> 1) | (carryOut8 << 7)) & 0xff;
                }
            } else if (reg8cl === 4) {
                // SHL
                for (let i = 0; i < shiftCount8; i++) {
                    carryOut8 = (result8 & 0x80) >> 7;
                    result8 = (result8 << 1) & 0xff;
                }
            } else if (reg8cl === 5) {
                // SHR
                for (let i = 0; i < shiftCount8; i++) {
                    carryOut8 = result8 & 0x01;
                    result8 = (result8 >> 1) & 0xff;
                }
            }

            // 写回结果（支持所有寻址模式）
            if (mod8cl === 3) {
                // 寄存器模式
                if (isHighBytecl[rm8cl]) {
                    this.setRegister(destReg8, (oldValue8 & 0x00ff) | (result8 << 8));
                } else {
                    this.setRegister(destReg8, (oldValue8 & 0xff00) | result8);
                }
            } else {
                // 内存模式
                this.writeRM8(mod8cl, rm8cl, currentAddress, result8);
            }
            
            // 设置标志位
            this.flags.cf = carryOut8;
            this.flags.zf = (result8 === 0) ? 1 : 0;
            this.flags.sf = (result8 & 0x80) ? 1 : 0;
            // 计算奇偶标志
            let paritycl = 0;
            let valuecl = result8;
            for (let i = 0; i < 8; i++) {
                paritycl += valuecl & 1;
                valuecl >>= 1;
            }
            this.flags.pf = (paritycl % 2 === 0) ? 1 : 0;
            
            // 计算指令长度
            if (mod8cl === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod8cl, rm8cl, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0xd3: // SHL/SHR/ROL/ROR r/m16, CL
            const modrm16cl = this.readMemory8(currentAddress + 1);
            const reg16cl = (modrm16cl >> 3) & 0x7; // 0=ROL, 1=ROR, 4=SHL, 5=SHR
            const mod16cl = (modrm16cl >> 6) & 0x3;
            const rm16cl = modrm16cl & 0x7;

            // 16位寄存器映射
            const rmToName16cl = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

            // 读取操作数值（支持所有寻址模式）
            let oldValue16cl;
            let destReg16cl;
            
            if (mod16cl === 3) {
                // 寄存器模式
                destReg16cl = rmToName16cl[rm16cl];
                oldValue16cl = this.getRegister(destReg16cl);
            } else {
                // 内存模式
                oldValue16cl = this.readRM16(mod16cl, rm16cl, currentAddress);
            }
            
            const shiftCount16cl = this.getRegister('cx') & 0xff;
            let result16cl = oldValue16cl;
            let carryOut16cl = 0;

            if (reg16cl === 0) {
                // ROL - 循环左移
                for (let i = 0; i < shiftCount16cl; i++) {
                    carryOut16cl = (result16cl & 0x8000) >> 15;
                    result16cl = ((result16cl << 1) | carryOut16cl);
                }
            } else if (reg16cl === 1) {
                // ROR - 循环右移
                for (let i = 0; i < shiftCount16cl; i++) {
                    carryOut16cl = result16cl & 0x0001;
                    result16cl = ((result16cl >> 1) | (carryOut16cl << 15));
                }
            } else if (reg16cl === 4) {
                // SHL
                for (let i = 0; i < shiftCount16cl; i++) {
                    carryOut16cl = (result16cl & 0x8000) >> 15;
                    result16cl = (result16cl << 1);
                }
            } else if (reg16cl === 5) {
                // SHR
                for (let i = 0; i < shiftCount16cl; i++) {
                    carryOut16cl = result16cl & 0x0001;
                    result16cl = (result16cl >> 1);
                }
            }

            // 写回结果（支持所有寻址模式）
            if (mod16cl === 3) {
                // 寄存器模式
                this.setRegister(destReg16cl, result16cl);
            } else {
                // 内存模式
                this.writeRM16(mod16cl, rm16cl, currentAddress, result16cl);
            }
            
            // 设置标志位
            this.flags.cf = carryOut16cl;
            this.flags.zf = (result16cl === 0) ? 1 : 0;
            this.flags.sf = (result16cl & 0x8000) ? 1 : 0;
            // 计算奇偶标志（基于低8位）
            let parity16cl = 0;
            let value16cl = result16cl & 0xff;
            for (let i = 0; i < 8; i++) {
                parity16cl += value16cl & 1;
                value16cl >>= 1;
            }
            this.flags.pf = (parity16cl % 2 === 0) ? 1 : 0;
            
            // 计算指令长度
            if (mod16cl === 3) {
                instructionLength = 2;
            } else {
                const ea = this.calculateEffectiveAddress(mod16cl, rm16cl, currentAddress);
                instructionLength = 2 + ea.displacementSize;
            }
            break;
        case 0x80: // ADD/OR/ADC/SBB/AND/SUB/XOR/CMP r/m8, imm8
        {
            const modrm80 = this.readMemory8(currentAddress + 1);
            const reg80 = (modrm80 >> 3) & 0x7;
            const mod80 = (modrm80 >> 6) & 0x3;
            const rm80 = modrm80 & 0x7;
            const imm80 = this.readMemory8(currentAddress + 2);

            const rmToName80 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const isHighByte80 = [false, false, false, false, true, true, true, true];

            let oldByteValue;
            let oldValue;
            let destReg;
            
            if (mod80 === 3) {
                destReg = rmToName80[rm80];
                oldValue = this.getRegister(destReg);
                oldByteValue = isHighByte80[rm80] ? (oldValue >> 8) & 0xff : oldValue & 0xff;
            } else {
                oldByteValue = this.readRM8(mod80, rm80, currentAddress);
            }
            
            let result;
            let isCmp80 = false;

            switch (reg80) {
                case 0: // ADD
                    result = oldByteValue + imm80;
                    this.updateFlags8(result, oldByteValue, imm80, 'add');
                    break;
                case 1: // OR
                    result = oldByteValue | imm80;
                    this.updateFlags8(result, oldByteValue, imm80, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 2: // ADC
                    result = oldByteValue + imm80 + this.flags.cf;
                    this.updateFlags8(result, oldByteValue, imm80 + this.flags.cf, 'add');
                    break;
                case 3: // SBB
                    result = oldByteValue - imm80 - this.flags.cf;
                    this.updateFlags8(result, oldByteValue, imm80 + this.flags.cf, 'sub');
                    break;
                case 4: // AND
                    result = oldByteValue & imm80;
                    this.updateFlags8(result, oldByteValue, imm80, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 5: // SUB
                    result = oldByteValue - imm80;
                    this.updateFlags8(result, oldByteValue, imm80, 'sub');
                    break;
                case 6: // XOR
                    result = oldByteValue ^ imm80;
                    this.updateFlags8(result, oldByteValue, imm80, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 7: // CMP
                    result = oldByteValue - imm80;
                    this.updateFlags8(result, oldByteValue, imm80, 'sub');
                    isCmp80 = true;
                    break;
            }

            if (!isCmp80) {
                const newByteValue = result & 0xff;
                if (mod80 === 3) {
                    if (isHighByte80[rm80]) {
                        this.setRegister(destReg, (oldValue & 0x00ff) | (newByteValue << 8));
                    } else {
                        this.setRegister(destReg, (oldValue & 0xff00) | newByteValue);
                    }
                } else {
                    this.writeRM8(mod80, rm80, currentAddress, newByteValue);
                }
            }
            
            if (mod80 === 3) {
                instructionLength = 3;
            } else {
                const ea = this.calculateEffectiveAddress(mod80, rm80, currentAddress);
                instructionLength = 3 + ea.displacementSize;
            }
            break;
        }
        case 0x81: // ADD/OR/ADC/SBB/AND/SUB/XOR/CMP r/m16, imm16
        {
            const modrm81 = this.readMemory8(currentAddress + 1);
            const reg81 = (modrm81 >> 3) & 0x7;
            const mod81 = (modrm81 >> 6) & 0x3;
            const rm81 = modrm81 & 0x7;
            const imm1681 = this.readMemory16(currentAddress + 2);

            const rmToName81 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

            let oldValue81;
            let destReg81;
            
            if (mod81 === 3) {
                destReg81 = rmToName81[rm81];
                oldValue81 = this.getRegister(destReg81);
            } else {
                oldValue81 = this.readRM16(mod81, rm81, currentAddress);
            }
            
            let result81;
            let isCmp81 = false;

            switch (reg81) {
                case 0: // ADD
                    result81 = oldValue81 + imm1681;
                    this.updateFlags16(result81, oldValue81, imm1681, 'add');
                    break;
                case 1: // OR
                    result81 = oldValue81 | imm1681;
                    this.updateFlags16(result81, oldValue81, imm1681, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 2: // ADC
                    result81 = oldValue81 + imm1681 + this.flags.cf;
                    this.updateFlags16(result81, oldValue81, imm1681 + this.flags.cf, 'add');
                    break;
                case 3: // SBB
                    result81 = oldValue81 - imm1681 - this.flags.cf;
                    this.updateFlags16(result81, oldValue81, imm1681 + this.flags.cf, 'sub');
                    break;
                case 4: // AND
                    result81 = oldValue81 & imm1681;
                    this.updateFlags16(result81, oldValue81, imm1681, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 5: // SUB
                    result81 = oldValue81 - imm1681;
                    this.updateFlags16(result81, oldValue81, imm1681, 'sub');
                    break;
                case 6: // XOR
                    result81 = oldValue81 ^ imm1681;
                    this.updateFlags16(result81, oldValue81, imm1681, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 7: // CMP
                    result81 = oldValue81 - imm1681;
                    this.updateFlags16(result81, oldValue81, imm1681, 'sub');
                    isCmp81 = true;
                    break;
            }

            if (!isCmp81) {
                if (mod81 === 3) {
                    this.setRegister(destReg81, result81 & 0xFFFF);
                } else {
                    this.writeRM16(mod81, rm81, currentAddress, result81 & 0xFFFF);
                }
            }
            
            if (mod81 === 3) {
                instructionLength = 4;
            } else {
                const ea = this.calculateEffectiveAddress(mod81, rm81, currentAddress);
                instructionLength = 4 + ea.displacementSize;
            }
            break;
        }
        case 0xf6: { // Group 3 r/m8
            const modrm = this.readMemory8(currentAddress + 1);
            const reg = (modrm >> 3) & 0x7;
            const mod = (modrm >> 6) & 0x3;
            const rm  = modrm & 0x7;
            
            let op8;
            let memAddr = null;
            
            if (mod === 3) {
                // 寄存器模式
                const regToName8 = ['ax','cx','dx','bx','ax','cx','dx','bx'];
                const isHigh     = [false,false,false,false,true,true,true,true];
                const base = regToName8[rm];
                const full = this.getRegister(base);
                op8 = isHigh[rm] ? ((full >> 8) & 0xff) : (full & 0xff);
            } else {
                // 内存模式
                const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                memAddr = ea.address;
                op8 = this.readMemory8(memAddr);
            }

            switch (reg) {
                case 2: { // NOT
                    const r = (~op8) & 0xff;
                    if (mod === 3) {
                        const regToName8 = ['ax','cx','dx','bx','ax','cx','dx','bx'];
                        const isHigh     = [false,false,false,false,true,true,true,true];
                        const base = regToName8[rm];
                        const full = this.getRegister(base);
                        const newFull = isHigh[rm] ? ((full & 0x00ff) | (r << 8))
                                            : ((full & 0xff00) | r);
                        this.setRegister(base, newFull);
                        instructionLength = 2;
                    } else {
                        this.writeMemory8(memAddr, r);
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 3: { // NEG
                    const r = (-op8) & 0xff;
                    if (mod === 3) {
                        const regToName8 = ['ax','cx','dx','bx','ax','cx','dx','bx'];
                        const isHigh     = [false,false,false,false,true,true,true,true];
                        const base = regToName8[rm];
                        const full = this.getRegister(base);
                        const newFull = isHigh[rm] ? ((full & 0x00ff) | (r << 8))
                                            : ((full & 0xff00) | r);
                        this.setRegister(base, newFull);
                        instructionLength = 2;
                    } else {
                        this.writeMemory8(memAddr, r);
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    this.updateFlags8(r, 0, op8, 'sub');
                    this.flags.cf = op8 !== 0 ? 1 : 0;
                    break;
                }
                case 4: { // MUL (AL * r/m8 -> AX)
                    const al = this.getRegister('ax') & 0xff;
                    const prod = al * op8;
                    const ax = prod;
                    this.setRegister('ax', ax);
                    const ah = (ax >> 8) & 0xff;
                    this.flags.cf = this.flags.of = ah !== 0 ? 1 : 0;
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 5: { // IMUL
                    let al = this.getRegister('ax') & 0xff;
                    let b  = op8;
                    if (al & 0x80) al -= 0x100;
                    if (b  & 0x80) b  -= 0x100;
                    const prod = al * b;
                    this.setRegister('ax', prod);
                    this.flags.cf = this.flags.of = (prod < -128 || prod > 127) ? 1 : 0;
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 6: { // DIV
                    const ax = this.getRegister('ax');
                    const d  = op8;
                    if (d === 0 || Math.floor(ax / d) > 0xff) {
                        console.error('执行错误: DIV 除法错误');
                        this.running = false;
                        return false;
                    }
                    const q = Math.floor(ax / d) & 0xff;
                    const r = (ax % d) & 0xff;
                    this.setRegister('ax', (r << 8) | q);
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 7: { // IDIV
                    let ax = this.getRegister('ax');
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
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
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
            
            let op16;
            let memAddr16 = null;
            
            if (mod === 3) {
                // 寄存器模式
                const rmToName = ['ax','cx','dx','bx','sp','bp','si','di'];
                const base = rmToName[rm];
                op16 = this.getRegister(base);
            } else {
                // 内存模式
                const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                memAddr16 = ea.address;
                op16 = this.readMemory16(memAddr16);
            }

            switch (reg) {
                case 2: { // NOT
                    const r = (~op16) & 0xffff;
                    if (mod === 3) {
                        const rmToName = ['ax','cx','dx','bx','sp','bp','si','di'];
                        const base = rmToName[rm];
                        this.setRegister(base, r);
                        instructionLength = 2;
                    } else {
                        this.writeMemory16(memAddr16, r);
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 3: { // NEG
                    const r = (-op16) & 0xffff;
                    if (mod === 3) {
                        const rmToName = ['ax','cx','dx','bx','sp','bp','si','di'];
                        const base = rmToName[rm];
                        this.setRegister(base, r);
                        instructionLength = 2;
                    } else {
                        this.writeMemory16(memAddr16, r);
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    this.updateFlags16(r, 0, op16, 'sub');
                    this.flags.cf = op16 !== 0 ? 1 : 0;
                    break;
                }
                case 4: { // MUL (AX * r/m16 -> DX:AX)
                    const ax = this.getRegister('ax');
                    const prod = ax * (op16);
                    const axr = prod;
                    const dxr = (prod >>> 16);
                    this.setRegister('ax', axr);
                    this.setRegister('dx', dxr);
                    this.flags.cf = this.flags.of = dxr !== 0 ? 1 : 0;
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 5: { // IMUL
                    let ax = this.getRegister('ax');
                    let b  = op16;
                    if (ax & 0x8000) ax -= 0x10000;
                    if (b  & 0x8000) b  -= 0x10000;
                    const prod = ax * b;
                    const axr = prod;
                    const dxr = (prod >> 16);
                    this.setRegister('ax', axr);
                    this.setRegister('dx', dxr);
                    this.flags.cf = this.flags.of = (prod < -32768 || prod > 32767) ? 1 : 0;
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 6: { // DIV (DX:AX / r/m16)
                    const ax = this.getRegister('ax');
                    const dx = this.getRegister('dx');
                    const dividend = (dx << 16) | ax;
                    const d = op16;
                    if (d === 0 || Math.floor(dividend / d) > 0xffff) {
                        console.error('执行错误: DIV 除法错误');
                        this.running = false;
                        return false;
                    }
                    const q = Math.floor(dividend / d);
                    const r = dividend % d;
                    this.setRegister('ax', q);
                    this.setRegister('dx', r);
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
                    break;
                }
                case 7: { // IDIV (有符号 DX:AX / r/m16)
                    let ax = this.getRegister('ax');
                    let dx = this.getRegister('dx');
                    let dividend = (dx << 16) | ax;
                    if (dx & 0x8000) dividend -= 0x100000000;
                    let d = op16;
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
                    this.setRegister('ax', q);
                    this.setRegister('dx', r);
                    if (mod === 3) {
                        instructionLength = 2;
                    } else {
                        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                        instructionLength = 2 + ea.displacementSize;
                    }
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
        case 0x56: // PUSH SI
            this.setRegister('sp', this.getRegister('sp') - 2);
            const stackAddress8 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(stackAddress8, this.getRegister('si'));
            instructionLength = 1;
            break;
        case 0x57: // PUSH DI
            this.setRegister('sp', this.getRegister('sp') - 2);
            const stackAddress9 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(stackAddress9, this.getRegister('di'));
            instructionLength = 1;
            break;
        case 0x16: // PUSH SS
            this.setRegister('sp', this.getRegister('sp') - 2);
            const stackAddress16 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(stackAddress16, this.getSegmentRegister('ss'));
            instructionLength = 1;
            break;
        case 0x5e: // POP SI
            const stackAddress10 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setRegister('si', this.readMemory16(stackAddress10));
            this.setRegister('sp', this.getRegister('sp') + 2);
            instructionLength = 1;
            break;
        case 0x5f: // POP DI
            const stackAddress11 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setRegister('di', this.readMemory16(stackAddress11));
            this.setRegister('sp', this.getRegister('sp') + 2);
            instructionLength = 1;
            break;
        case 0xf3: { // REP前缀
            // 读取下一个字节以确定是哪种串操作
            const nextByte = this.readMemory8(currentAddress + 1);
            if (nextByte === 0xa4) { // REP MOVSB
                while (this.getRegister('cx') > 0) {
                    const ds = this.getSegmentRegister('ds');
                    const es = this.getSegmentRegister('es');
                    const si = this.getRegister('si');
                    const di = this.getRegister('di');
                    const src = this.getMemoryAddress(ds, si);
                    const dst = this.getMemoryAddress(es, di);
                    const value = this.readMemory8(src);
                    this.writeMemory8(dst, value);
                    const delta = this.flags.df ? -1 : 1;
                    this.setRegister('si', (si + delta) & 0xFFFF);
                    this.setRegister('di', (di + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                }
                instructionLength = 2;
            } else if (nextByte === 0xa5) { // REP MOVSW
                while (this.getRegister('cx') > 0) {
                    const ds = this.getSegmentRegister('ds');
                    const es = this.getSegmentRegister('es');
                    const si = this.getRegister('si');
                    const di = this.getRegister('di');
                    const src = this.getMemoryAddress(ds, si);
                    const dst = this.getMemoryAddress(es, di);
                    const value = this.readMemory16(src);
                    this.writeMemory16(dst, value);
                    const delta = this.flags.df ? -2 : 2;
                    this.setRegister('si', (si + delta) & 0xFFFF);
                    this.setRegister('di', (di + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                }
                instructionLength = 2;
            } else if (nextByte === 0xaa) { // REP STOSB
                while (this.getRegister('cx') > 0) {
                    const es = this.getSegmentRegister('es');
                    const di = this.getRegister('di');
                    const dst = this.getMemoryAddress(es, di);
                    const al = this.getRegister('ax') & 0xFF;
                    this.writeMemory8(dst, al);
                    const delta = this.flags.df ? -1 : 1;
                    this.setRegister('di', (di + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                }
                instructionLength = 2;
            } else if (nextByte === 0xab) { // REP STOSW
                while (this.getRegister('cx') > 0) {
                    const es = this.getSegmentRegister('es');
                    const di = this.getRegister('di');
                    const dst = this.getMemoryAddress(es, di);
                    const ax = this.getRegister('ax');
                    this.writeMemory16(dst, ax);
                    const delta = this.flags.df ? -2 : 2;
                    this.setRegister('di', (di + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                }
                instructionLength = 2;
            } else if (nextByte === 0xac) { // REP LODSB
                while (this.getRegister('cx') > 0) {
                    const ds = this.getSegmentRegister('ds');
                    const si = this.getRegister('si');
                    const src = this.getMemoryAddress(ds, si);
                    const val = this.readMemory8(src);
                    this.setRegister('ax', (this.getRegister('ax') & 0xFF00) | val);
                    const delta = this.flags.df ? -1 : 1;
                    this.setRegister('si', (si + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                }
                instructionLength = 2;
            } else if (nextByte === 0xad) { // REP LODSW
                while (this.getRegister('cx') > 0) {
                    const ds = this.getSegmentRegister('ds');
                    const si = this.getRegister('si');
                    const src = this.getMemoryAddress(ds, si);
                    const val = this.readMemory16(src);
                    this.setRegister('ax', val);
                    const delta = this.flags.df ? -2 : 2;
                    this.setRegister('si', (si + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                }
                instructionLength = 2;
            } else if (nextByte === 0xae) { // REPE/REPZ SCASB
                while (this.getRegister('cx') > 0) {
                    const es = this.getSegmentRegister('es');
                    const di = this.getRegister('di');
                    const diAddr = this.getMemoryAddress(es, di);
                    const memVal = this.readMemory8(diAddr);
                    const al = this.getRegister('ax') & 0xFF;
                    const res = al - memVal;
                    this.updateFlags8(res, al, memVal, 'sub');
                    const delta = this.flags.df ? -1 : 1;
                    this.setRegister('di', (di + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                    // REPE: stop when not equal (ZF=0)
                    if (!this.flags.zf) break;
                }
                instructionLength = 2;
            } else if (nextByte === 0xaf) { // REPE/REPZ SCASW
                while (this.getRegister('cx') > 0) {
                    const es = this.getSegmentRegister('es');
                    const di = this.getRegister('di');
                    const diAddr = this.getMemoryAddress(es, di);
                    const memVal = this.readMemory16(diAddr);
                    const ax = this.getRegister('ax');
                    const res = ax - memVal;
                    this.updateFlags16(res, ax, memVal, 'sub');
                    const delta = this.flags.df ? -2 : 2;
                    this.setRegister('di', (di + delta) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                    if (!this.flags.zf) break;
                }
                instructionLength = 2;
            } else if (nextByte === 0xa6) { // REPE/REPZ CMPSB
                while (this.getRegister('cx') > 0) {
                    const ds = this.getSegmentRegister('ds');
                    const es = this.getSegmentRegister('es');
                    const si = this.getRegister('si');
                    const di = this.getRegister('di');
                    const srcVal = this.readMemory8(this.getMemoryAddress(ds, si));
                    const dstVal = this.readMemory8(this.getMemoryAddress(es, di));
                    const res = srcVal - dstVal;
                    this.updateFlags8(res, srcVal, dstVal, 'sub');
                    const inc = this.flags.df ? -1 : 1;
                    this.setRegister('si', (si + inc) & 0xFFFF);
                    this.setRegister('di', (di + inc) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                    if (!this.flags.zf) break;
                }
                instructionLength = 2;
            } else if (nextByte === 0xa7) { // REPE/REPZ CMPSW
                while (this.getRegister('cx') > 0) {
                    const ds = this.getSegmentRegister('ds');
                    const es = this.getSegmentRegister('es');
                    const si = this.getRegister('si');
                    const di = this.getRegister('di');
                    const srcVal = this.readMemory16(this.getMemoryAddress(ds, si));
                    const dstVal = this.readMemory16(this.getMemoryAddress(es, di));
                    const res = srcVal - dstVal;
                    this.updateFlags16(res, srcVal, dstVal, 'sub');
                    const inc = this.flags.df ? -2 : 2;
                    this.setRegister('si', (si + inc) & 0xFFFF);
                    this.setRegister('di', (di + inc) & 0xFFFF);
                    this.setRegister('cx', (this.getRegister('cx') - 1) & 0xFFFF);
                    if (!this.flags.zf) break;
                }
                instructionLength = 2;
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
            this.setRegister('si', (si + delta));
            this.setRegister('di', (di + delta));
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
            this.setRegister('si', (si + delta));
            this.setRegister('di', (di + delta));
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
            this.setRegister('di', (di + delta));
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
            this.setRegister('di', (di + delta));
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
            this.setRegister('si', (si + delta));
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
            this.setRegister('si', (si + delta));
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
            this.setRegister('di', (di + delta));
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
            this.setRegister('di', (di + delta));
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
            this.setRegister('si', (si + delta));
            this.setRegister('di', (di + delta));
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
            this.setRegister('si', (si + delta));
            this.setRegister('di', (di + delta));
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
            instructionLength = 0; // 不增加IP，因为已经手动设置了
            break;
        case 0x70: // JO short
            {
                const off = this.readMemory8(currentAddress + 1);
                const s = off > 0x7f ? off - 0x100 : off;
                if (this.flags.of) {
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
                    instructionLength = 0;
                } else {
                    instructionLength = 2;
                }
            }
            break;
        case 0x74: // JZ/JE short
            const offset8jz = this.readMemory8(currentAddress + 1);
            if (this.flags.zf === 1) {
                // 符号扩展
                const signedOffsetJz = offset8jz > 0x7f ? offset8jz - 0x100 : offset8jz;
                // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                this.ip = this.ip + 2 + signedOffsetJz;
                instructionLength = 0; // 不增加IP，因为已经手动设置了
            } else {
                instructionLength = 2;
            }
            break;
        case 0x75: // JNZ/JNE short
            const offset75 = this.readMemory8(currentAddress + 1);
            const signedOffset75 = offset75 > 0x7f ? offset75 - 0x100 : offset75;
            if (!this.flags.zf) {
                // ZF=0 时跳转
                this.ip = this.ip + 2 + signedOffset75;
                instructionLength = 0;
            } else {
                instructionLength = 2;
            }
            break;
        case 0x76: // JBE/JNA short
            {
                const off = this.readMemory8(currentAddress + 1);
                const s = off > 0x7f ? off - 0x100 : off;
                if (this.flags.cf || this.flags.zf) {
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
            this.flags.zf = ((resultcmp & 0xff) === 0) ? 1 : 0;
            this.flags.sf = (resultcmp & 0x80) ? 1 : 0;
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

        case 0x3d: // CMP AX, Iv
            const imm16cmp = this.readMemory16(currentAddress + 1);
            const axcmp = this.getRegister('ax');
            const result16cmp = axcmp - imm16cmp;
            // 设置标志位，但不修改寄存器
            this.flags.cf = (result16cmp < 0) ? 1 : 0;
            this.flags.zf = ((result16cmp & 0xffff) === 0) ? 1 : 0;
            this.flags.sf = (result16cmp & 0x8000) ? 1 : 0;
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
        case 0x39: { // CMP r/m16, r16
            const modrm39 = this.readMemory8(currentAddress + 1);
            const reg39 = (modrm39 >> 3) & 0x7;
            const mod39 = (modrm39 >> 6) & 0x3;
            const rm39 = modrm39 & 0x7;
            const regToName39 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const srcValue39 = this.getRegister(regToName39[reg39]);
            const dstValue39 = this.readRM16(mod39, rm39, currentAddress);
            const result39 = dstValue39 - srcValue39;
            this.updateFlags16(result39, dstValue39, srcValue39, 'sub');
            if (mod39 === 3) {
                instructionLength = 2;
            } else {
                const ea39 = this.calculateEffectiveAddress(mod39, rm39, currentAddress);
                instructionLength = 2 + ea39.displacementSize;
            }
            break;
        }
        case 0x3a: { // CMP r8, r/m8
            const modrm3a = this.readMemory8(currentAddress + 1);
            const reg3a = (modrm3a >> 3) & 0x7;
            const mod3a = (modrm3a >> 6) & 0x3;
            const rm3a = modrm3a & 0x7;
            const regToName3a = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
            const dstValue3a = this.getRegister8(regToName3a[reg3a]);
            let srcValue3a;
            if (mod3a === 3) {
                srcValue3a = this.getRegister8(regToName3a[rm3a]);
                instructionLength = 2;
            } else {
                const ea3a = this.calculateEffectiveAddress(mod3a, rm3a, currentAddress);
                const addr3a = this.getMemoryAddress(this.getSegmentRegister('ds'), ea3a.address);
                srcValue3a = this.readMemory8(addr3a);
                instructionLength = 2 + ea3a.displacementSize;
            }
            const result3a = dstValue3a - srcValue3a;
            this.updateFlags8(result3a, dstValue3a, srcValue3a, 'sub');
            break;
        }
        case 0xe0: // LOOPNZ/LOOPNE short
            {
                const off = this.readMemory8(currentAddress + 1);
                const s = off > 0x7f ? off - 0x100 : off;
                const cx = this.getRegister('cx');
                const newCx = (cx - 1);
                this.setRegister('cx', newCx);
                if (newCx !== 0 && this.flags.zf === 0) {
                    this.ip = (this.ip + 2 + s);
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
                const newCx = (cx - 1);
                this.setRegister('cx', newCx);
                if (newCx !== 0 && this.flags.zf === 1) {
                    this.ip = (this.ip + 2 + s);
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
                const newCx = (cx - 1);
                this.setRegister('cx', newCx);
                if (newCx !== 0) {
                    this.ip = (this.ip + 2 + s);
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
                    this.ip = (this.ip + 2 + s);
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
            this.ip = (this.ip + 2 + signedOffset);
            instructionLength = 0; // 不增加IP，因为已经手动设置了
            break;
        case 0xe9: // JMP near
            const offset16jmp = this.readMemory16(currentAddress + 1);
            // 符号扩展（16位有符号数）
            const signedOffset16 = offset16jmp > 0x7fff ? offset16jmp - 0x10000 : offset16jmp;
            // 跳转到目标地址：当前IP + 指令长度(3) + 偏移量
            this.ip = (this.ip + 3 + signedOffset16);
            instructionLength = 0; // 不增加IP，因为已经手动设置了
            break;
        case 0x7c: // JL short
            const offset8jl = this.readMemory8(currentAddress + 1);
            // JL: 小于跳转，条件是 SF !== OF
            if (this.flags.sf !== this.flags.of) {
                // 符号扩展
                const signedOffsetJl = offset8jl > 0x7f ? offset8jl - 0x100 : offset8jl;
                // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                this.ip = this.ip + 2 + signedOffsetJl;
                instructionLength = 0; // 不增加IP，因为已经手动设置了
            } else {
                instructionLength = 2;
            }
            break;
        case 0x7d: // JGE short
            const offset8jge = this.readMemory8(currentAddress + 1);
            // JGE: 大于等于跳转，条件是 SF === OF
            if (this.flags.sf === this.flags.of) {
                // 符号扩展
                const signedOffsetJge = offset8jge > 0x7f ? offset8jge - 0x100 : offset8jge;
                // 跳转到目标地址：当前IP + 指令长度 + 偏移量
                this.ip = this.ip + 2 + signedOffsetJge;
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
                instructionLength = 0; // 不增加IP，因为已经手动设置了
            } else {
                instructionLength = 2;
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
                const dstReg = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][rm8c];
                this.setRegister(dstReg, segmentValue);
                instructionLength = 2;
            } else {
                const ea8c = this.calculateEffectiveAddress(mod8c, rm8c, currentAddress);
                const addr8c = this.getMemoryAddress(this.getSegmentRegister('ds'), ea8c.address);
                this.writeMemory16(addr8c, segmentValue);
                instructionLength = 2 + ea8c.displacementSize;
            }
            break;
        case 0x8d: { // LEA r16, m
            const modrm8d = this.readMemory8(currentAddress + 1);
            const reg8d = (modrm8d >> 3) & 0x7;
            const mod8d = (modrm8d >> 6) & 0x3;
            const rm8d = modrm8d & 0x7;
            const regToName8d = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
            const dstReg8d = regToName8d[reg8d];
            if (mod8d === 3) {
                // LEA with register operand — just copy (uncommon but valid on some assemblers)
                this.setRegister(dstReg8d, this.getRegister(regToName8d[rm8d]));
                instructionLength = 2;
            } else {
                const ea8d = this.calculateEffectiveAddress(mod8d, rm8d, currentAddress);
                this.setRegister(dstReg8d, ea8d.address & 0xFFFF);
                instructionLength = 2 + ea8d.displacementSize;
            }
            break;
        }
        case 0x8e: { // MOV Sreg, r/m16 (从通用寄存器/内存到段寄存器)
            const modrm8e = this.readMemory8(currentAddress + 1);
            const reg8e = (modrm8e >> 3) & 0x7; // 段寄存器：0=ES, 1=CS, 2=SS, 3=DS
            const rm8e = modrm8e & 0x7;
            const mod8e = (modrm8e >> 6) & 0x3;

            // 段寄存器映射
            const sregToName8e = ['es', 'cs', 'ss', 'ds'];
            const dstSegment = sregToName8e[reg8e];

            if (mod8e === 3) {
                const srcReg = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'][rm8e];
                const srcValue = this.getRegister(srcReg);
                this.setSegmentRegister(dstSegment, srcValue);
                instructionLength = 2;
            } else {
                const ea8e = this.calculateEffectiveAddress(mod8e, rm8e, currentAddress);
                const addr8e = this.getMemoryAddress(this.getSegmentRegister('ds'), ea8e.address);
                const srcValue = this.readMemory16(addr8e);
                this.setSegmentRegister(dstSegment, srcValue);
                instructionLength = 2 + ea8e.displacementSize;
            }
            break;
        }
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
        case 0xFE: { // INC/DEC r/m8 (Group 4)
            const modrm = this.readMemory8(currentAddress + 1);
            const reg = (modrm >> 3) & 0x7;  // Extension opcode: 0=INC, 1=DEC
            const mod = (modrm >> 6) & 0x3;
            const rm  = modrm & 0x7;
            
            let op8, newOp8;
            
            if (mod === 3) {
                // 寄存器模式
                const reg16ToName = ['ax', 'cx', 'dx', 'bx', 'ax', 'cx', 'dx', 'bx'];
                const parentReg = reg16ToName[rm];
                const isHigh = rm >= 4;
                
                const full = this.getRegister(parentReg);
                op8 = isHigh ? ((full >> 8) & 0xff) : (full & 0xff);
                
                if (reg === 0) { // INC
                    newOp8 = (op8 + 1) & 0xff;
                } else if (reg === 1) { // DEC
                    newOp8 = (op8 - 1) & 0xff;
                } else {
                    console.error(`执行错误: 0xFE 不支持的扩展操作码 ${reg}`);
                    this.running = false;
                    return false;
                }
                
                const newFull = isHigh ? ((full & 0x00ff) | (newOp8 << 8)) : ((full & 0xff00) | newOp8);
                this.setRegister(parentReg, newFull);
                instructionLength = 2;
            } else {
                // 内存模式
                const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                const memAddr = ea.address;
                op8 = this.readMemory8(memAddr);
                
                if (reg === 0) { // INC
                    newOp8 = (op8 + 1) & 0xff;
                } else if (reg === 1) { // DEC
                    newOp8 = (op8 - 1) & 0xff;
                } else {
                    console.error(`执行错误: 0xFE 不支持的扩展操作码 ${reg}`);
                    this.running = false;
                    return false;
                }
                
                this.writeMemory8(memAddr, newOp8);
                instructionLength = 2 + ea.displacementSize;
            }
            
            // 更新标志位
            this.flags.zf = (newOp8 === 0) ? 1 : 0;
            this.flags.sf = (newOp8 & 0x80) ? 1 : 0;
            // 计算奇偶标志
            let parity = 0;
            let value = newOp8;
            for (let i = 0; i < 8; i++) {
                parity += value & 1;
                value >>= 1;
            }
            this.flags.pf = (parity % 2 === 0) ? 1 : 0;
            
            // 辅助进位标志（低4位溢出）
            if (reg === 0) { // INC
                this.flags.af = ((op8 & 0x0f) === 0x0f) ? 1 : 0;
            } else { // DEC
                this.flags.af = ((op8 & 0x0f) === 0) ? 1 : 0;
            }
            
            // 溢出标志
            if (reg === 0) { // INC
                this.flags.of = (op8 === 0x7f) ? 1 : 0;
            } else { // DEC
                this.flags.of = (op8 === 0x80) ? 1 : 0;
            }
            
            break;
        }
        case 0xFF: { // INC/DEC/CALL/JMP r/m16 (Group 5)
            const modrm = this.readMemory8(currentAddress + 1);
            const reg = (modrm >> 3) & 0x7;  // Extension opcode
            const mod = (modrm >> 6) & 0x3;
            const rm  = modrm & 0x7;
            
            let op16, newOp16;
            
            if (reg === 0 || reg === 1) { // INC or DEC
                if (mod === 3) {
                    // 寄存器模式
                    const reg16ToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
                    const regName = reg16ToName[rm];
                    op16 = this.getRegister(regName);
                    
                    if (reg === 0) { // INC
                        newOp16 = (op16 + 1) & 0xffff;
                    } else { // DEC
                        newOp16 = (op16 - 1) & 0xffff;
                    }
                    
                    this.setRegister(regName, newOp16);
                    instructionLength = 2;
                } else {
                    // 内存模式
                    const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
                    const memAddr = ea.address;
                    op16 = this.readMemory16(memAddr);
                    
                    if (reg === 0) { // INC
                        newOp16 = (op16 + 1) & 0xffff;
                    } else { // DEC
                        newOp16 = (op16 - 1) & 0xffff;
                    }
                    
                    this.writeMemory16(memAddr, newOp16);
                    instructionLength = 2 + ea.displacementSize;
                }
                
                // 更新标志位
                this.flags.zf = (newOp16 === 0) ? 1 : 0;
                this.flags.sf = (newOp16 & 0x8000) ? 1 : 0;
                // 计算奇偶标志（基于低8位）
                let parity = 0;
                let value = newOp16 & 0xff;
                for (let i = 0; i < 8; i++) {
                    parity += value & 1;
                    value >>= 1;
                }
                this.flags.pf = (parity % 2 === 0) ? 1 : 0;
                
                // 辅助进位标志（低4位溢出）
                if (reg === 0) { // INC
                    this.flags.af = ((op16 & 0x0f) === 0x0f) ? 1 : 0;
                } else { // DEC
                    this.flags.af = ((op16 & 0x0f) === 0) ? 1 : 0;
                }
                
                // 溢出标志
                if (reg === 0) { // INC
                    this.flags.of = (op16 === 0x7fff) ? 1 : 0;
                } else { // DEC
                    this.flags.of = (op16 === 0x8000) ? 1 : 0;
                }
            } else {
                console.error(`执行错误: 0xFF 暂不支持扩展操作码 ${reg}`);
                this.running = false;
                return false;
            }
            
            break;
        }
        case 0xf4: // HLT - Halt
            this.running = false;
            return false;

        // === 新增缺失指令 ===

        case 0x98: // CBW - Sign-extend AL into AX
        {
            const al = this.getRegister('ax') & 0xFF;
            if (al & 0x80) {
                this.setRegister('ax', 0xFF00 | al);
            } else {
                this.setRegister('ax', al);
            }
            instructionLength = 1;
            break;
        }
        case 0x99: // CWD - Sign-extend AX into DX:AX
        {
            const ax = this.getRegister('ax');
            if (ax & 0x8000) {
                this.setRegister('dx', 0xFFFF);
            } else {
                this.setRegister('dx', 0);
            }
            instructionLength = 1;
            break;
        }
        case 0x9e: // SAHF - Store AH into flags (SF ZF x AF x PF x CF)
        {
            const ah = (this.getRegister('ax') >> 8) & 0xFF;
            this.flags.sf = (ah >> 7) & 1;
            this.flags.zf = (ah >> 6) & 1;
            this.flags.af = (ah >> 4) & 1;
            this.flags.pf = (ah >> 2) & 1;
            this.flags.cf = ah & 1;
            instructionLength = 1;
            break;
        }
        case 0x9f: // LAHF - Load AH from flags
        {
            let ah = 0;
            ah |= (this.flags.sf << 7);
            ah |= (this.flags.zf << 6);
            ah |= (this.flags.af << 4);
            ah |= (this.flags.pf << 2);
            ah |= (1 << 1); // bit 1 is always 1
            ah |= this.flags.cf;
            const axLahf = this.getRegister('ax');
            this.setRegister('ax', (axLahf & 0x00FF) | (ah << 8));
            instructionLength = 1;
            break;
        }
        case 0x54: // PUSH SP
        {
            const spVal = this.getRegister('sp');
            this.setRegister('sp', (spVal - 2) & 0xFFFF);
            const ssAddr = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(ssAddr, spVal);
            instructionLength = 1;
            break;
        }
        case 0x55: // PUSH BP
        {
            const spVal55 = this.getRegister('sp') - 2;
            this.setRegister('sp', spVal55 & 0xFFFF);
            const ssAddr55 = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(ssAddr55, this.getRegister('bp'));
            instructionLength = 1;
            break;
        }
        case 0x5c: // POP SP
        {
            const ssAddrSp = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setRegister('sp', this.readMemory16(ssAddrSp));
            instructionLength = 1;
            break;
        }
        case 0x5d: // POP BP
        {
            const ssAddrBp = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setRegister('bp', this.readMemory16(ssAddrBp));
            this.setRegister('sp', (this.getRegister('sp') + 2) & 0xFFFF);
            instructionLength = 1;
            break;
        }
        case 0x06: // PUSH ES
        {
            const spES = this.getRegister('sp') - 2;
            this.setRegister('sp', spES & 0xFFFF);
            const ssES = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(ssES, this.getSegmentRegister('es'));
            instructionLength = 1;
            break;
        }
        case 0x07: // POP ES
        {
            const ssPopES = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setSegmentRegister('es', this.readMemory16(ssPopES));
            this.setRegister('sp', (this.getRegister('sp') + 2) & 0xFFFF);
            instructionLength = 1;
            break;
        }
        case 0x0e: // PUSH CS
        {
            const spCS = this.getRegister('sp') - 2;
            this.setRegister('sp', spCS & 0xFFFF);
            const ssCS = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(ssCS, this.getSegmentRegister('cs'));
            instructionLength = 1;
            break;
        }
        case 0x17: // POP SS
        {
            const ssPopSS = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setSegmentRegister('ss', this.readMemory16(ssPopSS));
            this.setRegister('sp', (this.getRegister('sp') + 2) & 0xFFFF);
            instructionLength = 1;
            break;
        }
        case 0x1e: // PUSH DS
        {
            const spDS = this.getRegister('sp') - 2;
            this.setRegister('sp', spDS & 0xFFFF);
            const ssDS = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.writeMemory16(ssDS, this.getSegmentRegister('ds'));
            instructionLength = 1;
            break;
        }
        case 0x1f: // POP DS
        {
            const ssPopDS = this.getMemoryAddress(this.getSegmentRegister('ss'), this.getRegister('sp'));
            this.setSegmentRegister('ds', this.readMemory16(ssPopDS));
            this.setRegister('sp', (this.getRegister('sp') + 2) & 0xFFFF);
            instructionLength = 1;
            break;
        }
        case 0x83: // Group: ADD/OR/ADC/SBB/AND/SUB/XOR/CMP r/m16, imm8 (sign-extended)
        {
            const modrm83 = this.readMemory8(currentAddress + 1);
            const reg83 = (modrm83 >> 3) & 0x7;
            const mod83 = (modrm83 >> 6) & 0x3;
            const rm83 = modrm83 & 0x7;
            let imm83 = this.readMemory8(currentAddress + 2);
            // Sign-extend imm8 to 16-bit
            if (imm83 & 0x80) imm83 = imm83 | 0xFF00;
            
            const rmToName83 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];

            let oldValue83;
            let destReg83;
            
            if (mod83 === 3) {
                destReg83 = rmToName83[rm83];
                oldValue83 = this.getRegister(destReg83);
            } else {
                oldValue83 = this.readRM16(mod83, rm83, currentAddress);
            }
            
            let result83;
            let isCmp83 = false;

            switch (reg83) {
                case 0: // ADD
                    result83 = oldValue83 + imm83;
                    this.updateFlags16(result83, oldValue83, imm83, 'add');
                    break;
                case 1: // OR
                    result83 = oldValue83 | imm83;
                    this.updateFlags16(result83, oldValue83, imm83, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 2: // ADC
                    result83 = oldValue83 + imm83 + this.flags.cf;
                    this.updateFlags16(result83, oldValue83, imm83 + this.flags.cf, 'add');
                    break;
                case 3: // SBB
                    result83 = oldValue83 - imm83 - this.flags.cf;
                    this.updateFlags16(result83, oldValue83, imm83 + this.flags.cf, 'sub');
                    break;
                case 4: // AND
                    result83 = oldValue83 & imm83;
                    this.updateFlags16(result83, oldValue83, imm83, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 5: // SUB
                    result83 = oldValue83 - imm83;
                    this.updateFlags16(result83, oldValue83, imm83, 'sub');
                    break;
                case 6: // XOR
                    result83 = oldValue83 ^ imm83;
                    this.updateFlags16(result83, oldValue83, imm83, 'and');
                    this.flags.cf = 0; this.flags.of = 0;
                    break;
                case 7: // CMP
                    result83 = oldValue83 - imm83;
                    this.updateFlags16(result83, oldValue83, imm83, 'sub');
                    isCmp83 = true;
                    break;
            }

            if (!isCmp83) {
                if (mod83 === 3) {
                    this.setRegister(destReg83, result83 & 0xFFFF);
                } else {
                    this.writeRM16(mod83, rm83, currentAddress, result83 & 0xFFFF);
                }
            }
            
            if (mod83 === 3) {
                instructionLength = 3;
            } else {
                const ea = this.calculateEffectiveAddress(mod83, rm83, currentAddress);
                instructionLength = 3 + ea.displacementSize;
            }
            break;
        }
        case 0xF2: // REPNE/REPNZ prefix
        {
            const nextOp = this.readMemory8(currentAddress + 1);
            const cx = this.getRegister('cx');
            if (cx === 0) {
                instructionLength = 2;
                break;
            }
            switch (nextOp) {
                case 0xAE: // REPNE SCASB
                {
                    let cxVal = cx;
                    while (cxVal > 0) {
                        const diAddr = this.getMemoryAddress(this.getSegmentRegister('es'), this.getRegister('di'));
                        const memVal = this.readMemory8(diAddr);
                        const al = this.getRegister('ax') & 0xFF;
                        const res = al - memVal;
                        this.updateFlags8(res, al, memVal, 'sub');
                        this.setRegister('di', this.flags.df ? 
                            (this.getRegister('di') - 1) & 0xFFFF : 
                            (this.getRegister('di') + 1) & 0xFFFF);
                        cxVal--;
                        if (this.flags.zf) break; // Stop if equal
                    }
                    this.setRegister('cx', cxVal);
                    instructionLength = 2;
                    break;
                }
                case 0xAF: // REPNE SCASW
                {
                    let cxVal = cx;
                    while (cxVal > 0) {
                        const diAddr = this.getMemoryAddress(this.getSegmentRegister('es'), this.getRegister('di'));
                        const memVal = this.readMemory16(diAddr);
                        const ax = this.getRegister('ax');
                        const res = ax - memVal;
                        this.updateFlags16(res, ax, memVal, 'sub');
                        this.setRegister('di', this.flags.df ? 
                            (this.getRegister('di') - 2) & 0xFFFF : 
                            (this.getRegister('di') + 2) & 0xFFFF);
                        cxVal--;
                        if (this.flags.zf) break;
                    }
                    this.setRegister('cx', cxVal);
                    instructionLength = 2;
                    break;
                }
                case 0xA6: // REPNE CMPSB
                {
                    let cxVal = cx;
                    while (cxVal > 0) {
                        const siAddr = this.getMemoryAddress(this.getSegmentRegister('ds'), this.getRegister('si'));
                        const diAddr = this.getMemoryAddress(this.getSegmentRegister('es'), this.getRegister('di'));
                        const srcVal = this.readMemory8(siAddr);
                        const dstVal = this.readMemory8(diAddr);
                        const res = srcVal - dstVal;
                        this.updateFlags8(res, srcVal, dstVal, 'sub');
                        const inc = this.flags.df ? -1 : 1;
                        this.setRegister('si', (this.getRegister('si') + inc) & 0xFFFF);
                        this.setRegister('di', (this.getRegister('di') + inc) & 0xFFFF);
                        cxVal--;
                        if (this.flags.zf) break;
                    }
                    this.setRegister('cx', cxVal);
                    instructionLength = 2;
                    break;
                }
                default:
                    console.error(`执行错误: 不支持的REPNE指令 0x${nextOp.toString(16)}`);
                    this.running = false;
                    return false;
            }
            break;
        }

        default:
            // 所有未实现的指令都报非法指令错误
            console.error(`执行错误: 遇到非法指令 0x${opcode.toString(16).padStart(2, '0')}`);
            this.running = false;
            return false;
    }

    // 更新指令指针（某些指令已经设置了IP，instructionLength会设为0）
    if (instructionLength > 0) {
        this.ip += instructionLength;
    }

    return true;
}

// 运行
CPU8086.prototype.run = function() {
    this.running = true;
    let instructionCount = 0;
    const maxInstructions = 10000; // 最大执行指令数，防止无限循环

    while (this.running && instructionCount < maxInstructions) {
        // 执行前检查是否在断点处（第一条指令不检查，避免还没开始就停住）
        if (instructionCount > 0 && this.isAtBreakpoint()) {
            this.running = false;
            break;
        }

        // 执行前累积内存操作到高亮集合，然后清除
        if (instructionCount > 0) {
            findSegmentOperationAddresses();
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
CPU8086.prototype.pause = function() {
    this.running = false;
}

// 获取当前指令地址
CPU8086.prototype.getCurrentAddress = function() {
    return this.getMemoryAddress(this.getSegmentRegister('cs'), this.ip);
}

CPU8086.prototype.handleInterrupt = function(interruptNum) {
    if (interruptNum === 0x21) {
        return this.handleInt21();
    } else if (interruptNum === 0x16) {
        return this.handleInt16();
    } else {
        console.warn(`未实现的中断: INT ${interruptNum.toString(16).padStart(2, '0')}`);
        return true;
    }
};
