CPU8086.prototype.addBreakpoint = function(address) {
    this.breakpoints.add(address);
};

CPU8086.prototype.removeBreakpoint = function(address) {
    this.breakpoints.delete(address);
};

CPU8086.prototype.isAtBreakpoint = function() {
    return this.breakpoints.has(this.ip);
};
