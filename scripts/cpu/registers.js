CPU8086.prototype.getRegister = function(name) {
    const regName = name.toLowerCase();
    const value = this.registers[regName] || 0;
    if (!this.registerOperations.has(regName) || this.registerOperations.get(regName).type !== 'write') {
        this.registerOperations.set(regName, { type: 'read', value });
    }
    return value;
};

CPU8086.prototype.getRegister8 = function(name) {
    const regName = name.toLowerCase();
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
        return (value16 >> 8) & 0xff;
    } else {
        return value16 & 0xff;
    }
};

CPU8086.prototype.setRegister8 = function(name, value) {
    const regName = name.toLowerCase();
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
        this.setRegister(parentReg, (value16 & 0x00ff) | (newValue8 << 8));
    } else {
        this.setRegister(parentReg, (value16 & 0xff00) | newValue8);
    }
};

CPU8086.prototype.setRegister = function(name, value) {
    const regName = name.toLowerCase();

    if (regName === 'ip') {
        const oldValue = this.ip;
        this.ip = value & 0xffff;
        this.registerOperations.set(regName, { type: 'write', value: this.ip, oldValue });
        return;
    }

    if (this.registers.hasOwnProperty(regName)) {
        const oldValue = this.registers[regName];
        this.registers[regName] = value & 0xffff;
        this.registerOperations.set(regName, { type: 'write', value: this.registers[regName], oldValue });
    }
};

CPU8086.prototype.getSegmentRegister = function(name) {
    const regName = name.toLowerCase();
    const value = this.segmentRegisters[regName] || 0;
    this.registerOperations.set(regName, { type: 'read', value });
    return value;
};

CPU8086.prototype.setSegmentRegister = function(name, value) {
    const regName = name.toLowerCase();
    if (this.segmentRegisters.hasOwnProperty(regName)) {
        const oldValue = this.segmentRegisters[regName];
        this.segmentRegisters[regName] = value & 0xffff;
        this.registerOperations.set(regName, { type: 'write', value: this.segmentRegisters[regName], oldValue });
    }
};

CPU8086.prototype.getFlag = function(name) {
    return this.flags[name.toLowerCase()] || 0;
};

CPU8086.prototype.setFlag = function(name, value) {
    name = name.toLowerCase();
    if (this.flags.hasOwnProperty(name)) {
        this.flags[name] = value ? 1 : 0;
    }
};

CPU8086.prototype.getFlags = function() {
    let flags = 0;

    flags |= (this.flags.cf & 1) << 0;
    flags |= 1 << 1;
    flags |= (this.flags.pf & 1) << 2;
    flags |= (this.flags.af & 1) << 4;
    flags |= (this.flags.zf & 1) << 6;
    flags |= (this.flags.sf & 1) << 7;
    flags |= (this.flags.tf & 1) << 8;
    flags |= (this.flags.if & 1) << 9;
    flags |= (this.flags.df & 1) << 10;
    flags |= (this.flags.of & 1) << 11;

    return flags & 0xffff;
};

CPU8086.prototype.setFlags = function(flags) {
    if (typeof flags === 'object') {
        if (flags.cf !== undefined) this.flags.cf = flags.cf ? 1 : 0;
        if (flags.pf !== undefined) this.flags.pf = flags.pf ? 1 : 0;
        if (flags.af !== undefined) this.flags.af = flags.af ? 1 : 0;
        if (flags.zf !== undefined) this.flags.zf = flags.zf ? 1 : 0;
        if (flags.sf !== undefined) this.flags.sf = flags.sf ? 1 : 0;
        if (flags.tf !== undefined) this.flags.tf = flags.tf ? 1 : 0;
        if (flags.if !== undefined) this.flags.if = flags.if ? 1 : 0;
        if (flags.df !== undefined) this.flags.df = flags.df ? 1 : 0;
        if (flags.of !== undefined) this.flags.of = flags.of ? 1 : 0;
    } else {
        this.flags.cf = (flags >> 0) & 1;
        this.flags.pf = (flags >> 2) & 1;
        this.flags.af = (flags >> 4) & 1;
        this.flags.zf = (flags >> 6) & 1;
        this.flags.sf = (flags >> 7) & 1;
        this.flags.tf = (flags >> 8) & 1;
        this.flags.if = (flags >> 9) & 1;
        this.flags.df = (flags >> 10) & 1;
        this.flags.of = (flags >> 11) & 1;
    }
};

CPU8086.prototype.getLowByte = function(reg) {
    return this.getRegister(reg) & 0xff;
};

CPU8086.prototype.getHighByte = function(reg) {
    return (this.getRegister(reg) >> 8) & 0xff;
};

CPU8086.prototype.setLowByte = function(reg, value) {
    const oldValue = this.getRegister(reg);
    this.setRegister(reg, (oldValue & 0xff00) | (value & 0xff));
};

CPU8086.prototype.setHighByte = function(reg, value) {
    const oldValue = this.getRegister(reg);
    this.setRegister(reg, (oldValue & 0x00ff) | ((value & 0xff) << 8));
};

CPU8086.prototype.clearRegisterOperations = function() {
    this.registerOperations.clear();
};

CPU8086.prototype.getRegisterOperations = function() {
    return this.registerOperations;
};
