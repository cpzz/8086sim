; 测试实现的指令

.code
start:
    ; 测试 SHR 指令
    mov dl, 0F0h  ; DL = 11110000b
    mov cl, 4     ; CL = 4
    shr dl, cl    ; DL = 00001111b = 0Fh
    
    ; 测试 AND 指令
    and dl, 0Fh   ; DL = 00001111b & 00001111b = 0Fh
    
    ; 测试 CMP 指令
    cmp dl, 0Ah   ; 比较 DL (0Fh) 和 0Ah
    
    ; 测试 ADD 指令
    add dl, 07h   ; DL = 0Fh + 07h = 16h
    add dl, 30h   ; DL = 16h + 30h = 46h = 'F'
    
    ; 测试其他寄存器的支持
    mov al, 0AAh  ; AL = 10101010b
    mov cl, 1     ; CL = 1
    shr al, cl    ; AL = 01010101b = 55h
    
    and al, 0Fh   ; AL = 01010101b & 00001111b = 05h
    
    cmp al, 0Ah   ; 比较 AL (05h) 和 0Ah
    
    add al, 07h   ; AL = 05h + 07h = 0Ch
    add al, 30h   ; AL = 0Ch + 30h = 3Ch
    
    ; 测试 16位寄存器
    mov ax, 0F000h
    mov cl, 8
    shr ax, cl    ; AX = 00F0h
    
    and ax, 00FFh ; AX = 00F0h & 00FFh = 00F0h
    
    cmp ax, 0080h ; 比较 AX (00F0h) 和 0080h
    
    add ax, 0010h ; AX = 00F0h + 0010h = 0100h
    
    ; 程序结束
    hlt
