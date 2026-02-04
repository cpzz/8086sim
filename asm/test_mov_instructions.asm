; ============================================================================
; MOV指令综合测试程序
; 测试所有MOV指令格式：寄存器-寄存器、寄存器-内存、寄存器-立即数
; ============================================================================

.MODEL SMALL
.STACK 100h

.DATA
    ; 测试数据区
    byte_val    DB  0AAh           ; 8位测试值
    word_val    DW  1234h          ; 16位测试值
    buffer      DB  10 DUP(0)      ; 缓冲区
    
.CODE
MAIN PROC
    ; 初始化数据段
    MOV AX, @DATA
    MOV DS, AX
    
    ; ==================== 8位寄存器立即数MOV ====================
    MOV AL, 55h                  ; AL = 55h
    MOV AH, 0AAh                 ; AH = AAh, AX = 0AA55h
    MOV BL, 11h                  ; BL = 11h
    MOV BH, 22h                  ; BH = 22h, BX = 2211h
    MOV CL, 33h                  ; CL = 33h
    MOV CH, 44h                  ; CH = 44h, CX = 4433h
    MOV DL, 66h                  ; DL = 66h
    MOV DH, 77h                  ; DH = 77h, DX = 7766h
    
    ; ==================== 16位寄存器立即数MOV ====================
    MOV AX, 1111h                ; AX = 1111h
    MOV BX, 2222h                ; BX = 2222h
    MOV CX, 3333h                ; CX = 3333h
    MOV DX, 4444h                ; DX = 4444h
    MOV SI, 5555h                ; SI = 5555h
    MOV DI, 6666h                ; DI = 6666h
    MOV BP, 7777h                ; BP = 7777h
    
    ; ==================== 8位寄存器之间MOV ====================
    MOV AL, BL                   ; AL = BL = 22h
    MOV AH, BH                   ; AH = BH = 22h
    MOV BL, CL                   ; BL = CL = 33h
    MOV BH, CH                   ; BH = CH = 44h
    MOV CL, DL                   ; CL = DL = 44h
    MOV CH, DH                   ; CH = DH = 44h
    MOV DL, AL                   ; DL = AL = 22h
    MOV DH, AH                   ; DH = AH = 22h
    
    ; ==================== 16位寄存器之间MOV ====================
    MOV AX, BX                   ; AX = BX = 4433h
    MOV BX, CX                   ; BX = CX = 4444h
    MOV CX, DX                   ; CX = DX = 2222h
    MOV DX, AX                   ; DX = AX = 4433h
    MOV SI, DI                   ; SI = DI = 6666h
    MOV DI, BP                   ; DI = BP = 7777h
    
    ; ==================== 寄存器到内存（直接寻址）====================
    MOV [byte_val], AL           ; [byte_val] = AL = 33h
    MOV [word_val], AX           ; [word_val] = AX = 4433h
    
    ; ==================== 内存到寄存器（直接寻址）====================
    MOV BL, [byte_val]           ; BL = [byte_val] = 33h
    MOV BX, [word_val]           ; BX = [word_val] = 4433h
    
    ; ==================== 寄存器间接寻址 ====================
    MOV SI, OFFSET buffer        ; SI = buffer的偏移地址
    MOV [SI], AL                 ; [SI] = AL = 33h
    MOV BL, [SI]                 ; BL = [SI] = 33h
    
    MOV DI, OFFSET buffer        ; DI = buffer的偏移地址
    MOV [DI], AH                 ; [DI] = AH = 44h
    MOV BH, [DI]                 ; BH = [DI] = 44h
    
    ; ==================== 基址寄存器寻址 ====================
    MOV BX, OFFSET buffer        ; BX = buffer的偏移地址
    MOV [BX], CL                 ; [BX] = CL = 22h
    MOV DL, [BX]                 ; DL = [BX] = 22h
    
    ; ==================== 基址+变址寻址 ====================
    MOV BX, OFFSET buffer        ; BX = buffer的偏移地址
    MOV SI, 0                    ; SI = 0
    MOV [BX+SI], AL              ; [BX+SI] = AL = 33h
    MOV CL, [BX+SI]              ; CL = [BX+SI] = 33h
    
    MOV DI, 1                    ; DI = 1
    MOV [BX+DI], AH              ; [BX+DI] = AH = 44h
    MOV CH, [BX+DI]              ; CH = [BX+DI] = 44h
    
    ; ==================== 基址+变址+偏移寻址 ====================
    MOV BX, OFFSET buffer        ; BX = buffer的偏移地址
    MOV SI, 2                    ; SI = 2
    MOV [BX+SI+5], AL            ; [BX+SI+5] = AL = 33h
    MOV DL, [BX+SI+5]            ; DL = [BX+SI+5] = 33h
    
    ; ==================== 16位寄存器到内存（基址+变址）====================
    MOV AX, 1234h                ; AX = 1234h
    MOV BX, OFFSET buffer        ; BX = buffer的偏移地址
    MOV SI, 0                    ; SI = 0
    MOV [BX+SI], AX              ; [BX+SI] = AX = 1234h
    MOV CX, [BX+SI]              ; CX = [BX+SI] = 1234h
    
    ; ==================== 带偏移量的寻址 ====================
    MOV BX, OFFSET buffer        ; BX = buffer的偏移地址
    MOV [BX+4], AL               ; [BX+4] = AL = 33h
    MOV DH, [BX+4]               ; DH = [BX+4] = 33h
    
    MOV SI, 8                    ; SI = 8
    MOV [SI+2], AH               ; [SI+2] = AH = 44h
    MOV DL, [SI+2]               ; DL = [SI+2] = 44h
    
    ; ==================== BP基址寻址 ====================
    MOV BP, OFFSET buffer        ; BP = buffer的偏移地址
    MOV [BP], AL                 ; [BP] = AL = 33h
    MOV BL, [BP]                 ; BL = [BP] = 33h
    
    MOV SI, 3                    ; SI = 3
    MOV [BP+SI], AH              ; [BP+SI] = AH = 44h
    MOV BH, [BP+SI]              ; BH = [BP+SI] = 44h
    
    ; ==================== 测试完成 ====================
    MOV AX, 4C00h                ; AH = 4Ch (退出功能), AL = 00h (返回码)
    INT 21h                      ; 调用DOS中断退出程序

MAIN ENDP
END MAIN
