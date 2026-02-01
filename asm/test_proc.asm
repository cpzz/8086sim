; Test multiple subroutine definition methods
.MODEL small
.STACK 100h

.DATA
    msg1 db 'Method 1: Colon Label', 0dh, 0ah, '$'
    msg2 db 'Method 2: PROC Directive', 0dh, 0ah, '$'
    msg3 db 'Method 3: PROC with Comments', 0dh, 0ah, '$'
    msg4 db 'Method 4: PROC Multi-line', 0dh, 0ah, '$'
    msg5 db 'Method 5: PROC Nested Call', 0dh, 0ah, '$'

.CODE
; Method 1: Colon label (traditional syntax)
print_msg1:
    mov ah, 09h
    lea dx, msg1
    int 21h
    ret

; Method 2: PROC directive (standard syntax)
print_msg2 proc
    mov ah, 09h
    lea dx, msg2
    int 21h
    ret
print_msg2 endp

; Method 3: PROC directive (with comments)
; Using comments to explain functionality
print_msg3 proc
    mov ah, 09h      ; DOS display function
    lea dx, msg3     ; Load message address
    int 21h          ; Call DOS interrupt
    ret              ; Return
print_msg3 endp

; Method 4: PROC directive (multi-line code)
print_msg4 proc
    ; Prepare display parameters
    mov ah, 09h
    mov dx, offset msg4
    ; Call interrupt to display
    int 21h
    ; Return to caller
    ret
print_msg4 endp

; Method 5: PROC nested call (calls other subroutines)
print_msg5 proc
    mov ah, 09h
    lea dx, msg5
    int 21h
    ; Nested call to Method 1 subroutine
    call print_msg1
    ret
print_msg5 endp

main proc
    mov ax, @data
    mov ds, ax

    ; Test calling subroutines defined with different methods
    call print_msg1     ; Method 1: Colon label
    call print_msg2     ; Method 2: PROC directive
    call print_msg3     ; Method 3: PROC with comments
    call print_msg4     ; Method 4: PROC multi-line
    call print_msg5     ; Method 5: Nested call

    ; Exit program
    mov ah, 4Ch
    int 21h
main endp

end main
