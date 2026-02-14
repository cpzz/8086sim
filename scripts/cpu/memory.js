CPU8086.prototype.getMemoryAddress = function(segment, offset) {
    return (segment << 4) + offset;
};

// 检查物理地址属于哪个段，更新该段的最后访问地址
CPU8086.prototype._trackSegmentAccess = function(address) {
    const segments = ['cs', 'ds', 'ss', 'es'];
    for (const seg of segments) {
        const base = this.segmentRegisters[seg] << 4;
        if (address >= base && address < base + 65536) {
            this.lastSegmentAccessAddress[seg] = address;
        }
    }
};

CPU8086.prototype.readMemory16 = function(address) {
    const value = this.memory.read16(address);
    this.memoryOperations.set(address, { type: 'read', value });
    this.memoryOperations.set(address + 1, { type: 'read', value: (value >> 8) & 0xff });
    this._trackSegmentAccess(address);
    return value;
};

CPU8086.prototype.writeMemory16 = function(address, value) {
    this.memory.write16(address, value);
    this.memoryOperations.set(address, { type: 'write', value: value & 0xff });
    this.memoryOperations.set(address + 1, { type: 'write', value: (value >> 8) & 0xff });
    this._trackSegmentAccess(address);
};

CPU8086.prototype.readMemory8 = function(address) {
    const value = this.memory.read8(address);
    this.memoryOperations.set(address, { type: 'read', value });
    this._trackSegmentAccess(address);
    return value;
};

CPU8086.prototype.writeMemory8 = function(address, value) {
    this.memory.write8(address, value);
    this.memoryOperations.set(address, { type: 'write', value });
    this._trackSegmentAccess(address);
};

CPU8086.prototype.clearMemoryOperations = function() {
    this.memoryOperations.clear();
};

CPU8086.prototype.getMemoryOperations = function() {
    return this.memoryOperations;
};
