; 屏幕输入输出测试程序
; 测试基本的输入输出功能

        MOV AH, 02h         ; DOS功能号02h：显示单个字符
        MOV DL, 41h         ; DL = 'A' (ASCII码)
        INT 21h             ; 调用DOS中断21h

        MOV AH, 02h         ; 再次显示字符
        MOV DL, 42h         ; DL = 'B' (ASCII码)
        INT 21h

        MOV AH, 02h         ; 再次显示字符
        MOV DL, 43h         ; DL = 'C' (ASCII码)
        INT 21h

        ; 显示换行符
        MOV AH, 02h
        MOV DL, 0Dh         ; 回车符
        INT 21h

        MOV AH, 02h
        MOV DL, 0Ah         ; 换行符
        INT 21h

        ; 显示字符串 "Hello"
        MOV CX, 5            ; 字符串长度
        MOV SI, msg          ; SI指向字符串地址
        MOV AH, 02h         ; 显示字符功能
display_loop:
        MOV DL, [SI]        ; 读取字符
        INT 21h
        INC SI              ; SI递增
        DEC CX              ; CX递减
        JNZ display_loop    ; 如果CX不为0，继续循环

        ; 程序结束
        MOV AH, 4Ch         ; DOS功能号4Ch：程序结束
        MOV AL, 00h         ; 返回码
        INT 21h

msg     DB 'Hello'         ; 字符串定义
