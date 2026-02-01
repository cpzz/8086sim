.MODEL small
.STACK 100h

.DATA
    num dw 1234h     ; 定义字变量num，初始值为1234h
    arr db 10 dup(0) ; 定义字节数组arr，10个元素，初始值均为0
    msg db 'Hello, World!', 0dh, 0ah, '$' ; 定义字符串msg

.CODE
main proc
    mov ax, @data    ; 设置AX = 数据段地址
    mov ds, ax       ; 设置DS = AX，初始化数据段寄存器
    
    ; 测试内存读取（立即数到内存）
    mov num, 5678h   ; 设置内存地址num处的值为5678h
    
    ; 测试内存读取（内存到寄存器）
    mov ax, num      ; 从内存地址num处读取值到AX，AX = 5678h
    
    ; 测试内存写入（寄存器到内存）
    mov bx, 9abch    ; 设置BX = 9abch
    mov num, bx      ; 将BX的值写入内存地址num处，num = 9abch
    
    ; 测试内存数组访问
    mov si, 0        ; 设置SI = 0（数组索引）
    mov arr[si], 1   ; 设置arr[0] = 1
    inc si           ; SI = SI + 1 = 1
    mov arr[si], 2   ; 设置arr[1] = 2
    
    ; 测试 LEA 指令
    lea si, arr      ; 设置SI = arr的偏移地址
    
    ; 测试 MOV 指令（标签到寄存器）
    lea dx, msg      ; 设置DX = msg的偏移地址
    
    ; 测试内存访问（基址+变址）
    mov si, 0        ; 设置SI = 0
    mov al, arr[si]  ; 从arr[0]读取值到AL，AL = 1
    
    ; 退出程序
    mov ah, 4Ch      ; 设置AH = 4Ch（退出功能）
    int 21h          ; 调用DOS中断，退出程序
main endp

end main