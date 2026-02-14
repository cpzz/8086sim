class CPU8086 {
    constructor(memory) {
        this.memory = memory;
        
        this.registers = {
            ax: 0,
            bx: 0x0000,
            cx: 0,
            dx: 0,
            si: 0,
            di: 0,
            sp: 0xfffe,
            bp: 0
        };
        
        this.segmentRegisters = {
            cs: 0x1000,
            ds: 0x2000,
            ss: 0x3000,
            es: 0x4000
        };
        
        this.ip = 0x0000;
        
        this.flags = {
            cf: 0,
            pf: 0,
            af: 0,
            zf: 0,
            sf: 0,
            tf: 0,
            if: 1,
            df: 0,
            of: 0
        };
        
        this.breakpoints = new Set();

        this.running = false;
        this.currentInstruction = null;

        this.memoryOperations = new Map();

        this.registerOperations = new Map();

        this.outputBuffer = '';

        this.keyboardBuffer = [];

        this.waitingForKey = false;

        this.updateOutputDisplay = null;

        this.waitForKeyPress = null;

        // 跟踪各段最后一次内存访问的物理地址
        this.lastSegmentAccessAddress = { cs: -1, ds: -1, ss: -1, es: -1 };

        // 中断架构
        this.pendingInterrupts = []; // 硬件中断队列
        this.biosHandlerBase = 0xF000; // BIOS ROM 段地址
        this.biosHandlers = {};       // { 偏移地址: 处理函数 }
    }

    // 初始化中断向量表和BIOS存根
    initInterruptSystem() {
        // 注册内置BIOS中断处理函数
        // 每个处理器在 F000:00xx 处放一条 IRET (0xCF)
        // 当 CPU 执行到这些地址时，先调用 JS 处理函数，再执行 IRET
        const handlers = [
            { intNum: 0x10, handler: () => true },         // INT 10H 显示服务（暫留）
            { intNum: 0x16, handler: () => this.handleInt16() }, // INT 16H 键盘服务
            { intNum: 0x21, handler: () => this.handleInt21() }, // INT 21H DOS服务
        ];

        for (const { intNum, handler } of handlers) {
            const stubOffset = intNum * 2; // 每个存根占 1 字节 (IRET)
            const stubPhysical = (this.biosHandlerBase << 4) + stubOffset;

            // 写入 IRET 指令到存根地址
            this.memory.write8(stubPhysical, 0xCF); // IRET

            // 设置 IVT: 每个条目 4 字节 [offset_lo, offset_hi, segment_lo, segment_hi]
            const ivtAddr = intNum * 4;
            this.memory.write16(ivtAddr, stubOffset);           // 偏移地址
            this.memory.write16(ivtAddr + 2, this.biosHandlerBase); // 段地址

            // 注册 JS 处理函数映射
            this.biosHandlers[stubOffset] = handler;
        }

        // 其余未实现的中断向量指向一个通用存根（只有 IRET）
        const defaultStubOffset = 0x01FF; // 通用存根偏移
        const defaultStubPhysical = (this.biosHandlerBase << 4) + defaultStubOffset;
        this.memory.write8(defaultStubPhysical, 0xCF);
        for (let i = 0; i < 256; i++) {
            const ivtAddr = i * 4;
            // 跳过已注册处理器的条目（上面已写入）
            const existingOffset = this.memory.read16(ivtAddr);
            const existingSeg = this.memory.read16(ivtAddr + 2);
            if (existingSeg === this.biosHandlerBase && this.biosHandlers[existingOffset]) {
                continue; // 已注册的处理器，保留不覆盖
            }
            // 其余全部指向默认存根
            this.memory.write16(ivtAddr, defaultStubOffset);
            this.memory.write16(ivtAddr + 2, this.biosHandlerBase);
        }
    }}
