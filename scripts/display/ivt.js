// 中断向量表 (IVT) 显示模块
// IVT 位于 0000:0000 ~ 0000:03FF, 共256个条目, 每条目4字节 (偏移低, 偏移高, 段低, 段高)

// 已知中断说明
const IVT_DESCRIPTIONS = {
    0x00: '除法错误',
    0x01: '单步调试',
    0x02: 'NMI 不可屏蔽中断',
    0x03: '断点 (INT 3)',
    0x04: '溢出 (INTO)',
    0x05: '打印屏幕',
    0x08: '定时器 (IRQ0)',
    0x09: '键盘 (IRQ1)',
    0x0A: 'IRQ2 级联',
    0x0B: 'COM2 (IRQ3)',
    0x0C: 'COM1 (IRQ4)',
    0x0D: 'LPT2 (IRQ5)',
    0x0E: '软盘 (IRQ6)',
    0x0F: 'LPT1 (IRQ7)',
    0x10: 'BIOS 显示服务',
    0x11: 'BIOS 设备列表',
    0x12: 'BIOS 内存大小',
    0x13: 'BIOS 磁盘服务',
    0x14: 'BIOS 串口服务',
    0x15: 'BIOS 系统服务',
    0x16: 'BIOS 键盘服务',
    0x17: 'BIOS 打印服务',
    0x19: 'BIOS 引导',
    0x1A: 'BIOS 时间/日期',
    0x1C: '用户定时器钩子',
    0x20: 'DOS 程序终止',
    0x21: 'DOS 功能调用',
    0x22: 'DOS 终止地址',
    0x23: 'DOS Ctrl+C 处理',
    0x24: 'DOS 严重错误',
    0x25: 'DOS 绝对磁盘读',
    0x26: 'DOS 绝对磁盘写',
    0x27: 'DOS TSR 驻留',
    0x28: 'DOS 空闲',
    0x2F: 'DOS 多路复用',
    0x33: '鼠标服务',
    0x70: 'RTC (IRQ8)',
    0x71: 'IRQ9 重定向',
    0x72: 'IRQ10',
    0x73: 'IRQ11',
    0x74: '鼠标 (IRQ12)',
    0x75: '协处理器 (IRQ13)',
    0x76: '硬盘 (IRQ14)',
    0x77: 'IRQ15',
};

// 上一次的 IVT 快照（用于高亮变化）
let _prevIvtSnapshot = null;

// 重置 IVT 快照（加载文件/复位时调用，避免首次显示误标为变化）
function resetIvtSnapshot() {
    _prevIvtSnapshot = null;
}

// 读取 IVT 快照
function readIvtSnapshot() {
    const entries = [];
    for (let i = 0; i < 256; i++) {
        const addr = i * 4;
        const offset = memory.read16(addr);
        const segment = memory.read16(addr + 2);
        entries.push({ intNum: i, segment, offset });
    }
    return entries;
}

// 更新 IVT 显示
function updateIvtDisplay() {
    const grid = document.getElementById('ivt-grid');
    if (!grid) return;

    const entries = readIvtSnapshot();

    // 首次或结构变化时重建
    let tbody = grid.querySelector('.ivt-table-body');
    if (!tbody) {
        grid.innerHTML = '';

        const table = document.createElement('div');
        table.className = 'ivt-table';

        // 表头
        const header = document.createElement('div');
        header.className = 'ivt-table-header';
        header.innerHTML = `
            <div class="ivt-cell ivt-num">中断号</div>
            <div class="ivt-cell ivt-addr">IVT 地址</div>
            <div class="ivt-cell ivt-vector">向量地址</div>
            <div class="ivt-cell ivt-desc">说明</div>
        `;
        table.appendChild(header);

        tbody = document.createElement('div');
        tbody.className = 'ivt-table-body';

        for (let i = 0; i < 256; i++) {
            const row = document.createElement('div');
            row.className = 'ivt-table-row';
            row.dataset.intNum = i;

            const numCell = document.createElement('div');
            numCell.className = 'ivt-cell ivt-num';
            numCell.textContent = 'INT ' + i.toString(16).toUpperCase().padStart(2, '0') + 'H';

            const addrCell = document.createElement('div');
            addrCell.className = 'ivt-cell ivt-addr';
            addrCell.textContent = '0000:' + (i * 4).toString(16).toUpperCase().padStart(4, '0');

            const vecCell = document.createElement('div');
            vecCell.className = 'ivt-cell ivt-vector';

            const descCell = document.createElement('div');
            descCell.className = 'ivt-cell ivt-desc';
            descCell.textContent = IVT_DESCRIPTIONS[i] || '';

            row.appendChild(numCell);
            row.appendChild(addrCell);
            row.appendChild(vecCell);
            row.appendChild(descCell);
            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        grid.appendChild(table);
    }

    // 更新向量值和高亮
    const rows = tbody.querySelectorAll('.ivt-table-row');
    for (let i = 0; i < 256; i++) {
        const e = entries[i];
        const segHex = e.segment.toString(16).toUpperCase().padStart(4, '0');
        const offHex = e.offset.toString(16).toUpperCase().padStart(4, '0');
        const vecText = segHex + ':' + offHex;

        const row = rows[i];
        const vecCell = row.querySelector('.ivt-vector');
        vecCell.textContent = vecText;

        // 高亮变化的条目
        if (_prevIvtSnapshot) {
            const prev = _prevIvtSnapshot[i];
            if (prev.segment !== e.segment || prev.offset !== e.offset) {
                row.classList.add('ivt-changed');
            } else {
                row.classList.remove('ivt-changed');
            }
        } else {
            row.classList.remove('ivt-changed');
        }

        // 高亮有 BIOS 处理函数的条目
        if (cpu && cpu.biosHandlers && cpu.biosHandlers[e.offset] && e.segment === cpu.biosHandlerBase) {
            row.classList.add('ivt-has-handler');
        } else {
            row.classList.remove('ivt-has-handler');
        }
    }

    _prevIvtSnapshot = entries;
}
