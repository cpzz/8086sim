
// 更新寄存器显示
function updateRegistersDisplay(registerOperations = new Map()) {
    // 获取当前寄存器值（直接从内部属性获取，避免调用getRegister方法干扰操作跟踪）
    const currentValues = {
        ax: cpu.registers.ax || 0,
        bx: cpu.registers.bx || 0,
        cx: cpu.registers.cx || 0,
        dx: cpu.registers.dx || 0,
        ah: (cpu.registers.ax >> 8) & 0xff,
        al: cpu.registers.ax & 0xff,
        bh: (cpu.registers.bx >> 8) & 0xff,
        bl: cpu.registers.bx & 0xff,
        ch: (cpu.registers.cx >> 8) & 0xff,
        cl: cpu.registers.cx & 0xff,
        dh: (cpu.registers.dx >> 8) & 0xff,
        dl: cpu.registers.dx & 0xff,
        si: cpu.registers.si || 0,
        di: cpu.registers.di || 0,
        sp: cpu.registers.sp || 0,
        bp: cpu.registers.bp || 0,
        cs: cpu.segmentRegisters.cs || 0,
        ds: cpu.segmentRegisters.ds || 0,
        ss: cpu.segmentRegisters.ss || 0,
        es: cpu.segmentRegisters.es || 0,
        ip: cpu.ip
    };
    
    // 更新通用寄存器
    updateRegisterDisplay('ax', currentValues.ax, '', 4, registerOperations);
    updateRegisterDisplay('bx', currentValues.bx, '', 4, registerOperations);
    updateRegisterDisplay('cx', currentValues.cx, '', 4, registerOperations);
    updateRegisterDisplay('dx', currentValues.dx, '', 4, registerOperations);
    
    // 更新8位寄存器
    updateRegisterDisplay('ah', currentValues.ah, '', 2, registerOperations);
    updateRegisterDisplay('al', currentValues.al, '', 2, registerOperations);
    updateRegisterDisplay('bh', currentValues.bh, '', 2, registerOperations);
    updateRegisterDisplay('bl', currentValues.bl, '', 2, registerOperations);
    updateRegisterDisplay('ch', currentValues.ch, '', 2, registerOperations);
    updateRegisterDisplay('cl', currentValues.cl, '', 2, registerOperations);
    updateRegisterDisplay('dh', currentValues.dh, '', 2, registerOperations);
    updateRegisterDisplay('dl', currentValues.dl, '', 2, registerOperations);
    
    // 更新索引和指针寄存器
    updateRegisterDisplay('si', currentValues.si, '', 4, registerOperations);
    updateRegisterDisplay('di', currentValues.di, '', 4, registerOperations);
    updateRegisterDisplay('sp', currentValues.sp, '', 4, registerOperations);
    updateRegisterDisplay('bp', currentValues.bp, '', 4, registerOperations);
    
    // 更新段寄存器
    updateRegisterDisplay('cs', currentValues.cs, '', 4, registerOperations);
    updateRegisterDisplay('ds', currentValues.ds, '', 4, registerOperations);
    updateRegisterDisplay('ss', currentValues.ss, '', 4, registerOperations);
    updateRegisterDisplay('es', currentValues.es, '', 4, registerOperations);
    
    // 更新指令指针
    updateRegisterDisplay('ip', currentValues.ip, '', 4, registerOperations);
    
    // 更新标志位
    document.getElementById('cf').textContent = cpu.getFlag('cf');
    document.getElementById('pf').textContent = cpu.getFlag('pf');
    document.getElementById('af').textContent = cpu.getFlag('af');
    document.getElementById('zf').textContent = cpu.getFlag('zf');
    document.getElementById('sf').textContent = cpu.getFlag('sf');
    document.getElementById('tf').textContent = cpu.getFlag('tf');
    document.getElementById('if').textContent = cpu.getFlag('if');
    document.getElementById('df').textContent = cpu.getFlag('df');
    document.getElementById('of').textContent = cpu.getFlag('of');
    
    // 存储当前值作为下一次的比较基准（只在执行指令后更新）
    if (registerOperations.size > 0) {
        previousRegisterValues = currentValues;
    }
}

// 更新单个寄存器显示
function updateRegisterDisplay(id, value, suffix, padding, registerOperations = new Map()) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with id "${id}" not found`);
        return;
    }

    let registerNameElement = null;

    // 查找前面的寄存器名称元素
    let sibling = element.previousElementSibling;
    while (sibling) {
        if (sibling.classList.contains('register-name')) {
            registerNameElement = sibling;
            break;
        }
        sibling = sibling.previousElementSibling;
    }

    // 检查是否有写入操作（只从registerOperations中检查）
    let hasChanged = false;

    // 只从registerOperations中检查写入操作
    if (registerOperations.has(id)) {
        const operation = registerOperations.get(id);
        hasChanged = operation.type === 'write' && operation.oldValue !== undefined;
    }

    // 更新文本内容（HTML中已硬编码H后缀）
    element.textContent = value.toString(16).toUpperCase().padStart(padding, '0') + suffix;

    // 添加或移除高亮
    if (hasChanged) {
        element.classList.add('register-changed');
    } else {
        element.classList.remove('register-changed');
    }

    // 添加或移除changed类到寄存器名称元素
    if (registerNameElement) {
        if (hasChanged) {
            registerNameElement.classList.add('changed');
        } else {
            registerNameElement.classList.remove('changed');
        }
    }
}

// 高亮IP寄存器
function highlightIPRegister() {
    const ipElement = document.getElementById('ip');
    if (ipElement) {
        ipElement.classList.add('register-changed');
    }
}

// 高亮寄存器值改变
function highlightRegisterChanges(registerOperations) {
    registerOperations.forEach((operation, registerName) => {
        // 只处理写入操作，不检查值是否变化
        if (operation.type === 'write' && operation.oldValue !== undefined) {
            // 获取寄存器值的元素
            const valueElement = document.getElementById(registerName);
            if (valueElement) {
                valueElement.classList.add('register-changed');
            }
        }
    });
}

// 清除寄存器高亮
function clearRegisterHighlights() {
    // 移除所有寄存器值的高亮
    const registerValues = document.querySelectorAll('#ax, #ah, #al, #bx, #bh, #bl, #cx, #ch, #cl, #dx, #dh, #dl, #sp, #bp, #ip, #si, #di, #cs, #ds, #ss, #es');
    registerValues.forEach(value => {
        value.classList.remove('register-changed');
    });
}
