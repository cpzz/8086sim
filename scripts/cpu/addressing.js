CPU8086.prototype.calculateEffectiveAddress = function(mod, rm, currentAddress) {
    let offset = 0;
    let address = 0;
    
    switch (mod) {
        case 0:
            if (rm === 6) {
                address = this.readMemory16(currentAddress + 2);
                return { address, displacementSize: 2 };
            }
            break;
        case 1:
            offset = this.readMemory8(currentAddress + 2);
            if (offset > 127) {
                offset -= 256;
            }
            return { offset, displacementSize: 1 };
        case 2:
            offset = this.readMemory16(currentAddress + 2);
            return { offset, displacementSize: 2 };
        case 3:
            return { registerMode: true };
    }
    
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
    
    address += offset;
    
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
