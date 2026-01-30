; CALL指令测试程序
; 测试CALL和RET指令的功能

        MOV AX, 1000h      ; AX = 1000h
        MOV BX, 2000h      ; BX = 2000h
        MOV CX, 0000h      ; CX = 0000h
        MOV DX, 0000h      ; DX = 0000h

        ; 测试CALL指令
        CALL subroutine1     ; 调用子程序1

        ; 主程序继续
        MOV CX, AX          ; CX应该被设置为1200h（子程序1和2修改后的值）
        JMP end             ; 跳转到程序结束

subroutine1:
        ; 子程序1
        ADD AX, 0100h      ; AX = 1100h
        MOV BX, 3000h      ; BX = 3000h
        CALL subroutine2     ; 子程序1调用子程序2
        CALL subroutine3     ; 子程序1调用子程序3
        ADD DX, 0050h      ; DX = 0050h（子程序2执行后）
        RET                 ; 返回，从栈弹出返回地址

subroutine2:
        ; 子程序2（被子程序1调用）
        ADD AX, 0100h      ; AX = 1200h
        MOV CX, 0001h      ; CX = 0001h（测试子程序2中的寄存器操作）
        RET                 ; 返回到子程序1

subroutine3:
        ; 子程序3（被子程序1调用）
        ADD AX, 0050h      ; AX = AX + 0050h
        ADD BX, 0050h      ; BX = BX + 0050h
        RET                 ; 返回到子程序1

end:
        ; 程序结束
        NOP
