CPU8086.prototype.calculateEffectiveAddress = function(mod, rm, currentAddress) {
    let offset = 0;
    let address = 0;
    let segment = 'ds';  // 默认使用 DS 段
    
    switch (mod) {
        case 0:
            if (rm === 6) {
                // 直接寻址：[disp16]
                offset = this.readMemory16(currentAddress + 2);
                address = this.getMemoryAddress(this.getSegmentRegister(segment), offset);
                return { address, displacementSize: 2 };
            }
            break;
        case 1:
            offset = this.readMemory8(currentAddress + 2);
            if (offset > 127) {
                offset -= 256;
            }
            break;
        case 2:
            offset = this.readMemory16(currentAddress + 2);
            break;
        case 3:
            return { registerMode: true };
    }
    
    let baseOffset = 0;
    switch (rm) {
        case 0:
            baseOffset = this.getRegister('bx') + this.getRegister('si');
            segment = 'ds';
            break;
        case 1:
            baseOffset = this.getRegister('bx') + this.getRegister('di');
            segment = 'ds';
            break;
        case 2:
            baseOffset = this.getRegister('bp') + this.getRegister('si');
            segment = 'ss'; // BP 默认使用 SS 段
            break;
        case 3:
            baseOffset = this.getRegister('bp') + this.getRegister('di');
            segment = 'ss'; // BP 默认使用 SS 段
            break;
        case 4:
            baseOffset = this.getRegister('si');
            segment = 'ds';
            break;
        case 5:
            baseOffset = this.getRegister('di');
            segment = 'ds';
            break;
        case 6:
            baseOffset = this.getRegister('bp');
            segment = 'ss'; // BP 默认使用 SS 段
            break;
        case 7:
            baseOffset = this.getRegister('bx');
            segment = 'ds';
            break;
    }
    
    baseOffset = (baseOffset + offset) & 0xffff;
    address = this.getMemoryAddress(this.getSegmentRegister(segment), baseOffset);
    
    return { address, displacementSize: mod === 0 ? 0 : (mod === 1 ? 1 : 2) };
};

CPU8086.prototype.readRM8 = function(mod, rm, currentAddress) {
    if (mod === 3) {
        const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
        const isHighByte = [false, false, false, false, true, true, true, true];
        const regName = rmToName[rm];
        const value = this.getRegister(regName);
        return isHighByte[rm] ? (value >> 8) & 0xff : value & 0xff;
    } else {
        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
        return this.readMemory8(ea.address);
    }
};

CPU8086.prototype.readRM16 = function(mod, rm, currentAddress) {
    if (mod === 3) {
        const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
        return this.getRegister(rmToName[rm]);
    } else {
        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
        return this.readMemory16(ea.address);
    }
};

CPU8086.prototype.writeRM8 = function(mod, rm, currentAddress, value) {
    if (mod === 3) {
        const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
        const isHighByte = [false, false, false, false, true, true, true, true];
        const regName = rmToName[rm];
        const oldValue = this.getRegister(regName);
        const newValue = isHighByte[rm] ? 
            (oldValue & 0x00ff) | ((value & 0xff) << 8) : 
            (oldValue & 0xff00) | (value & 0xff);
        this.setRegister(regName, newValue);
    } else {
        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
        this.writeMemory8(ea.address, value);
    }
};

CPU8086.prototype.writeRM16 = function(mod, rm, currentAddress, value) {
    if (mod === 3) {
        const rmToName = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
        this.setRegister(rmToName[rm], value & 0xffff);
    } else {
        const ea = this.calculateEffectiveAddress(mod, rm, currentAddress);
        this.writeMemory16(ea.address, value);
    }
};
