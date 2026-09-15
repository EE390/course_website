ORG 0000H
MOV R0,#20H
CLR A
MOV R7,#08H

AGAIN: ; Filling data of 0-7 in RAM locations 20H-27H
MOV @R0,A
INC A
INC R0
DJNZ R7,AGAIN

MOV DPTR,#0100H ; Location in ROM with Segments are saved

RESTART: 
MOV P2,#00H ; Selecting First Digit
MOV R0,#20H ; Pointing to the first number which is 0

REPEAT:
	MOV A,@R0 ; Grab the number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	ACALL DELAY_1ms ; Delay
	INC R0  ; Point to the next number
	MOV A,P2  ; Take the value of digit selection
	ADD A,#04H ; Make it point to the next one
	JB ACC.5 , RESTART ; Check if it reached the end
	MOV P2,A ; Apply the newly pointed digit selection
	SJMP REPEAT
DELAY_1ms:
	MOV TMOD,#01H
	MOV TH0,#0FCH ; For 1mS
	MOV TL0,#67H  ; For 1mS
	SETB TR0
	TF0_WAIT:
		JNB TF0,TF0_WAIT
	CLR TR0
	CLR TF0
	RET
	
ORG 100H
SEGMENTS:
DB 3FH, 06H, 5BH, 4FH, 66H, 6DH, 7DH, 07H, 7FH, 6FH, 77H, 7CH, 39H, 5EH, 79H, 71H
   ;0   ;1   ;2   ;3   ;4   ;5   ;6   ;7   ;8   ;9   ;A   ;b   ;C   ;d   ;E   ;F
END