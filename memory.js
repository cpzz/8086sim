class Memory {
    constructor() {
        // 8086有1MB内存空间 (0x00000 - 0xFFFFF)
        this.size = 1024 * 1024; // 1MB
        this.memory = new Uint8Array(this.size);
        // 初始化内存为随机值，模拟真实环境中的垃圾数据
        this.initRandom();
    }
    
    // 初始化内存为随机值，模拟真实环境中的垃圾数据
    initRandom() {
        for (let i = 0; i < this.size; i++) {
            this.memory[i] = Math.floor(Math.random() * 256);
        }
    }
    
    // 读取8位内存
    read8(address) {
        address = address & 0xfffff; // 确保20位地址
        return this.memory[address];
    }
    
    // 写入8位内存
    write8(address, value) {
        address = address & 0xfffff; // 确保20位地址
        value = value & 0xff; // 确保8位值
        this.memory[address] = value;
    }
    
    // 读取16位内存（低地址为低字节，高地址为高字节）
    read16(address) {
        address = address & 0xfffff; // 确保20位地址
        const lowByte = this.memory[address];
        const highByte = this.memory[address + 1];
        return (highByte << 8) | lowByte;
    }
    
    // 写入16位内存（低地址为低字节，高地址为高字节）
    write16(address, value) {
        address = address & 0xfffff; // 确保20位地址
        value = value & 0xffff; // 确保16位值
        this.memory[address] = value & 0xff; // 低字节
        this.memory[address + 1] = (value >> 8) & 0xff; // 高字节
    }
    
    // 读取连续的内存字节
    readBytes(address, length) {
        address = address & 0xfffff; // 确保20位地址
        const result = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            result[i] = this.memory[address + i];
        }
        return result;
    }
    
    // 写入连续的内存字节
    writeBytes(address, bytes) {
        address = address & 0xfffff; // 确保20位地址
        for (let i = 0; i < bytes.length; i++) {
            this.memory[address + i] = bytes[i] & 0xff;
        }
    }
    
    // 初始化内存为零
    clear() {
        this.memory.fill(0);
    }
    
    // 从数组初始化内存
    initFromArray(data, startAddress = 0) {
        startAddress = startAddress & 0xfffff; // 确保20位地址
        for (let i = 0; i < data.length; i++) {
            if (startAddress + i < this.size) {
                this.memory[startAddress + i] = data[i] & 0xff;
            }
        }
    }
    
    // 从十六进制字符串初始化内存
    initFromHexString(hexString, startAddress = 0) {
        startAddress = startAddress & 0xfffff; // 确保20位地址
        // 移除所有非十六进制字符
        const cleanHex = hexString.replace(/[^0-9a-fA-F]/g, '');
        // 确保字符数为偶数
        if (cleanHex.length % 2 !== 0) {
            throw new Error('Hex string must have even length');
        }
        // 转换为字节数组
        const bytes = [];
        for (let i = 0; i < cleanHex.length; i += 2) {
            bytes.push(parseInt(cleanHex.substr(i, 2), 16));
        }
        // 写入内存
        this.initFromArray(bytes, startAddress);
    }
    
    // 获取内存区域的内容（用于显示）
    getMemoryDump(startAddress, length) {
        startAddress = startAddress & 0xfffff; // 确保20位地址
        length = Math.min(length, this.size - startAddress);
        const dump = [];
        
        for (let i = 0; i < length; i += 16) {
            const rowAddress = startAddress + i;
            const rowBytes = [];
            const rowAscii = [];
            
            for (let j = 0; j < 16; j++) {
                if (i + j < length) {
                    const byte = this.memory[rowAddress + j];
                    rowBytes.push(byte.toString(16).toUpperCase().padStart(2, '0'));
                    // 转换为ASCII字符，非可打印字符显示为.
                    const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
                    rowAscii.push(char);
                } else {
                    rowBytes.push('  ');
                    rowAscii.push(' ');
                }
            }
            
            dump.push({
                address: rowAddress,
                bytes: rowBytes,
                ascii: rowAscii.join('')
            });
        }
        
        return dump;
    }
    
    // 检查内存地址是否有效
    isValidAddress(address) {
        return address >= 0 && address < this.size;
    }
    
    // 获取内存大小
    getSize() {
        return this.size;
    }
}
