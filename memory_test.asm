; 内存操作测试程序

start:
    ; 测试内存写入
    mov ax, 0x1234    ; AX = 0x1234
    mov bx, 0x0000    ; BX = 0x0000 (偏移地址)
    mov [bx], ax      ; 将AX写入内存 DS:BX
    
    ; 测试内存读取
    mov cx, [bx]      ; 从内存 DS:BX 读取值到 CX
    
    ; 测试修改内存值
    add ax, 0x5678    ; AX = AX + 0x5678 = 0x68AC
    mov [bx], ax      ; 将新的AX值写入内存 DS:BX
    
    ; 再次读取验证
    mov dx, [bx]      ; 从内存 DS:BX 读取值到 DX
    
    ; 测试结束
    ret
