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
    }
}
