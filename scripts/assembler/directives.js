Assembler.prototype.getDirectiveType = function(line) {
    const lowerLine = line.trim().toLowerCase();

    if (lowerLine.startsWith('.data')) {
        return 'data';
    } else if (lowerLine.startsWith('.code')) {
        return 'code';
    } else if (lowerLine.startsWith('.model') ||
               lowerLine.startsWith('.stack') ||
               lowerLine.startsWith('.startup') ||
               lowerLine.startsWith('.exit')) {
        return 'other';
    } else if (lowerLine.startsWith('.end') || lowerLine.startsWith('end ')) {
        return 'other';
    }

    if (lowerLine.startsWith('assume ')) {
        return 'other';
    } else if (lowerLine.endsWith(' segment')) {
        const parts = lowerLine.split(/\s+/).filter(Boolean);
        const segmentName = parts[0].toLowerCase();
        if (segmentName === 'data') {
            return 'data';
        } else if (segmentName === 'code') {
            return 'code';
        }
        return 'other';
    } else if (lowerLine.endsWith(' ends')) {
        return 'other';
    }

    return null;
};

Assembler.prototype.parseDirective = function(line) {
    const lowerLine = line.trim().toLowerCase();

    if (lowerLine.startsWith('.model')) {
        const parts = lowerLine.split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
            this.model = parts[1];
        }
    } else if (lowerLine.startsWith('.stack')) {
        const parts = lowerLine.split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
            this.stackSize = this.parseImmediate(parts[1]);
        }
    } else if (lowerLine.startsWith('.end') || lowerLine.startsWith('end ')) {
        const parts = lowerLine.split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
            this.entryPoint = parts[1];
        }
    } else if (lowerLine.includes(' proc ')) {
        const parts = lowerLine.split(/\s+/).filter(Boolean);
        if (parts.length > 0) {
            const procName = parts[0];
        }
    } else if (lowerLine.includes(' endp ')) {
    } else if (lowerLine.endsWith(' segment')) {
        const parts = lowerLine.split(/\s+/).filter(Boolean);
        const segmentName = parts[0].toLowerCase();
    } else if (lowerLine.endsWith(' ends')) {
    }
};

Assembler.prototype.isDirective = function(line) {
    return this.getDirectiveType(line) !== null;
};