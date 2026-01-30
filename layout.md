页面整体结构：

# 浏览器窗口 - 最外层的浏览器窗口

## body - 页面主体，设置了 overflow: hidden，没有滚动条
主要容器：

- container - 白色背景的主容器，填满整个视口
- main-content - 左右布局的主内容区，位于container内，h1标题下方

### 左侧区域（left-panel）：

左侧面板（left-panel） - 左侧的大面板区域
    左侧tabs（left-tabs） - 左侧面板顶部的标签按钮："用户界面"、"寄存器"、"内存"
    左侧tab内容（left-tab-content） - 每个tab对应的内容区域，有 overflow: auto，会显示内部滚动条
    用户界面tab - 包含DOS 80x25显示网格
    寄存器tab - 包含通用寄存器表格、指针/索引寄存器、标志位、段寄存器
    内存tab - 包含内存面板
        内存面板（memory-panel） - 内存tab的内容
        内存段选择tabs（memory-segment-tabs） - "代码段(CS)"、"数据段(DS)"、"堆栈段(SS)"、"附加段(ES)"
        内存控制区（memory-controls） - 地址输入框和"前往"按钮
        内存网格（memory-grid） - 显示内存地址和字节的表格

### 右侧区域（right-panel）：

右侧面板（right-panel） - 右侧的大面板区域
    代码面板（code-panel） - 右侧的代码显示面板
        代码控制头部（code-control-header） - 包含"代码"标题、状态指示器、控制按钮
        指令面板（instructions-panel） - 指令列表区域
            指令表格（instructions-table） - 显示指令的表格
                指令表格头部（instructions-table-header） - "偏移地址"、"机器码"、"汇编指令"、"注释"
                指令表格体（instructions-table-body） - 指令行列表，有 overflow-y: auto