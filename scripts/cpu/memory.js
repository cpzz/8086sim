CPU8086.prototype.getMemoryAddress = function(segment, offset) {
    return (segment << 4) + offset;
};

CPU8086.prototype.readMemory16 = function(address) {
    const value = this.memory.read16(address);
    this.memoryOperations.set(address, { type: 'read', value });
    this.memoryOperations.set(address + 1, { type: 'read', value: (value >> 8) & 0xff });
    return value;
};

CPU8086.prototype.writeMemory16 = function(address, value) {
    this.memory.write16(address, value);
    this.memoryOperations.set(address, { type: 'write', value: value & 0xff });
    this.memoryOperations.set(address + 1, { type: 'write', value: (value >> 8) & 0xff });
};

CPU8086.prototype.readMemory8 = function(address) {
    const value = this.memory.read8(address);
    this.memoryOperations.set(address, { type: 'read', value });
    return value;
};

CPU8086.prototype.writeMemory8 = function(address, value) {
    this.memory.write8(address, value);
    this.memoryOperations.set(address, { type: 'write', value });
};

CPU8086.prototype.clearMemoryOperations = function() {
    this.memoryOperations.clear();
};

CPU8086.prototype.getMemoryOperations = function() {
    return this.memoryOperations;
};
