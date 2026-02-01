.MODEL small
.STACK 100h

.DATA
    msg1 db 'Hello, World!', 0dh, 0ah, '$'      ; 定义字符串msg1
    msg2 db 'This is a test of the screen display.', 0dh, 0ah, '$' ; 定义字符串msg2
    msg3 db 'Testing line 3...', 0dh, 0ah, '$'  ; 定义字符串msg3
    msg4 db 'Testing line 4...', 0dh, 0ah, '$'  ; 定义字符串msg4
    msg5 db 'Testing line 5...', 0dh, 0ah, '$'  ; 定义字符串msg5
    msg6 db 'Testing line 6...', 0dh, 0ah, '$'  ; 定义字符串msg6
    msg7 db 'Testing line 7...', 0dh, 0ah, '$'  ; 定义字符串msg7
    msg8 db 'Testing line 8...', 0dh, 0ah, '$'  ; 定义字符串msg8
    msg9 db 'Testing line 9...', 0dh, 0ah, '$'  ; 定义字符串msg9
    msg10 db 'Testing line 10...', 0dh, 0ah, '$' ; 定义字符串msg10
    msg11 db 'Testing line 11...', 0dh, 0ah, '$' ; 定义字符串msg11
    msg12 db 'Testing line 12...', 0dh, 0ah, '$' ; 定义字符串msg12
    msg13 db 'Testing line 13...', 0dh, 0ah, '$' ; 定义字符串msg13
    msg14 db 'Testing line 14...', 0dh, 0ah, '$' ; 定义字符串msg14
    msg15 db 'Testing line 15...', 0dh, 0ah, '$' ; 定义字符串msg15
    msg16 db 'Testing line 16...', 0dh, 0ah, '$' ; 定义字符串msg16
    msg17 db 'Testing line 17...', 0dh, 0ah, '$' ; 定义字符串msg17
    msg18 db 'Testing line 18...', 0dh, 0ah, '$' ; 定义字符串msg18
    msg19 db 'Testing line 19...', 0dh, 0ah, '$' ; 定义字符串msg19
    msg20 db 'Testing line 20...', 0dh, 0ah, '$' ; 定义字符串msg20
    msg21 db 'Testing line 21...', 0dh, 0ah, '$' ; 定义字符串msg21
    msg22 db 'Testing line 22...', 0dh, 0ah, '$' ; 定义字符串msg22
    msg23 db 'Testing line 23...', 0dh, 0ah, '$' ; 定义字符串msg23
    msg24 db 'Testing line 24...', 0dh, 0ah, '$' ; 定义字符串msg24
    msg25 db 'Testing line 25...', 0dh, 0ah, '$' ; 定义字符串msg25
    msg26 db 'Testing line 26...', 0dh, 0ah, '$' ; 定义字符串msg26

.CODE
main proc
    mov ax, @data    ; 设置AX = 数据段地址
    mov ds, ax       ; 设置DS = AX，初始化数据段寄存器
    
    ; 测试屏幕显示（超过25行，测试滚动功能）
    mov ah, 09h      ; 设置AH = 09h（显示字符串功能）
    lea dx, msg1     ; 设置DX = msg1的偏移地址
    int 21h          ; 调用DOS中断，显示"Hello, World!"
    
    lea dx, msg2     ; 设置DX = msg2的偏移地址
    int 21h          ; 调用DOS中断，显示"This is a test of the screen display."
    
    lea dx, msg3     ; 设置DX = msg3的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 3..."
    
    lea dx, msg4     ; 设置DX = msg4的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 4..."
    
    lea dx, msg5     ; 设置DX = msg5的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 5..."
    
    lea dx, msg6     ; 设置DX = msg6的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 6..."
    
    lea dx, msg7     ; 设置DX = msg7的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 7..."
    
    lea dx, msg8     ; 设置DX = msg8的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 8..."
    
    lea dx, msg9     ; 设置DX = msg9的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 9..."
    
    lea dx, msg10    ; 设置DX = msg10的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 10..."
    
    lea dx, msg11    ; 设置DX = msg11的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 11..."
    
    lea dx, msg12    ; 设置DX = msg12的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 12..."
    
    lea dx, msg13    ; 设置DX = msg13的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 13..."
    
    lea dx, msg14    ; 设置DX = msg14的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 14..."
    
    lea dx, msg15    ; 设置DX = msg15的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 15..."
    
    lea dx, msg16    ; 设置DX = msg16的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 16..."
    
    lea dx, msg17    ; 设置DX = msg17的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 17..."
    
    lea dx, msg18    ; 设置DX = msg18的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 18..."
    
    lea dx, msg19    ; 设置DX = msg19的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 19..."
    
    lea dx, msg20    ; 设置DX = msg20的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 20..."
    
    lea dx, msg21    ; 设置DX = msg21的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 21..."
    
    lea dx, msg22    ; 设置DX = msg22的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 22..."
    
    lea dx, msg23    ; 设置DX = msg23的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 23..."
    
    lea dx, msg24    ; 设置DX = msg24的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 24..."
    
    lea dx, msg25    ; 设置DX = msg25的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 25..."
    
    lea dx, msg26    ; 设置DX = msg26的偏移地址
    int 21h          ; 调用DOS中断，显示"Testing line 26..."（此时屏幕应该滚动）
    
    ; 退出程序
    mov ah, 4Ch      ; 设置AH = 4Ch（退出功能）
    int 21h          ; 调用DOS中断，退出程序
main endp

end main