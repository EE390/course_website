SRCLK EQU P3.6 ; Clock for serial input 74H595
RCLK  EQU P3.5 ; Convert the serial data stored into parallel for output 74H595
SER   EQU P3.4 ; Data serial input 74H595

ORG 0000H

MOV R0,#20H ; Pointing to RAM Locations where we will store Column Selections
MOV R7,#08H
MOV A,#0FEH

FILL_P0_LED_LOCATION: ; For Column Selection, Active LOW
	MOV @R0,A
	RL A
	INC R0
	DJNZ R7,FILL_P0_LED_LOCATION

MOV DPTR,#0300H ; Pointing to ROM where LED Matrix is Stored
MOV R2,#03H ; For DPH
MOV R3,#00H ; For DPL
MOV R4,#22
REPEAT:
	MOV 40H,#100 ; This is for Delay to keep showing the full shape long enough before showing the next one
	
NEXT_DISPLAY:
	MOV 50H,#08H
	MOV R0,#20H ; Pointing to RAM Locations where we will store Column Selections
	MOV DPL,R3 ; Updating the ROM location for the shape
	MOV DPH,R2 ; Updating the ROM location for the shape
	LED_MATRIX_DISPLAY:
		CLR A
		MOVC A,@A+DPTR ; Takes the column line (Top to Bottom)
		LCALL SEND_SERIAL ; Send it to LED Matrix 
		MOV P0,@R0 ; Column selection
		LCALL DELAY500US ; Delay to give LEDs time to glow
		INC DPTR ; Go to next column line
		INC R0 ; Go to next column (From Right to Left)
		DJNZ 50H,LED_MATRIX_DISPLAY
	DJNZ 40H,NEXT_DISPLAY

MOV A,R3
ADD A,#08H ; Updating the ROM location to select the next shape
MOV R3,A; Updating the ROM location [DPL] to select the next shape
DJNZ R4, REPEAT

SJMP RESET

SEND_SERIAL: ; Sends the value in A into 74H595
	MOV R7,#08H
	SETB SRCLK
	SETB RCLK
	AGAIN_SEND_SERIAL:
		MOV C,ACC.7 ; Takes tae data
		MOV SER,C 
		RL A
		CLR SRCLK
		NOP
		NOP
		SETB SRCLK ; Gives Positive Edge for data entry
		DJNZ R7,AGAIN_SEND_SERIAL
	CLR RCLK
	NOP
	NOP
	SETB RCLK ; Gives Positive Edge for excution
	RET

DELAY500US:
	MOV 30H,#5
	MOV 31H,#72
	NEXT:
		DJNZ 31H,NEXT
		DJNZ 30H,NEXT
	RET



















 ; Some 8x8 LED MAtrix shape examples, the first byte is for the most right column
 ; and the data Satrt from MSB which is the TOP LED and End with LSB which is the Bottom LED
ORG 0300H
SMILE: DB 00H , 04H , 72H , 02H , 02H , 72H , 04H , 00H
Angry: DB 7EH , 9AH , 52H , 79H , 79H , 52H , 9AH , 7EH
Heart: DB 30H , 78H , 7CH , 3EH , 3EH , 7CH , 78H , 30H
Time:  DB 00H , 42H , 66H , 7eH , 7eH , 66H , 42H , 00H
UP:    DB 00H , 10H , 30H , 7FH , 0FFH, 7FH , 30H , 10H
SAD:   DB 3CH , 42H , 0A5H, 89H , 89H , 0A5H, 42H , 3CH
NUM_0: DB 00H , 3EH , 7FH , 51H , 49H , 7FH , 3EH , 00H
NUM_1: DB 00H , 01H , 01H , 7FH , 7FH , 11H , 01H , 00H
NUM_2: DB 00H , 31H , 79H , 49H , 45H , 67H , 23H , 00H
NUM_3: DB 00H , 36H , 7FH , 49H , 49H , 63H , 22H , 00H
NUM_4: DB 00H , 04H , 7FH , 7FH , 24H , 14H , 0CH , 00H
NUM_5: DB 00H , 4EH , 5FH , 51H , 51H , 73H , 72H , 00H
NUM_6: DB 00H , 26H , 6FH , 49H , 49H , 7FH , 3EH , 00H
NUM_7: DB 00H , 60H , 78H , 5FH , 47H , 60H , 60H , 00H
NUM_8: DB 00H , 36H , 7FH , 49H , 49H , 7FH , 36H , 00H
NUM_9: DB 00H , 3EH , 7FH , 49H , 49H , 7BH , 32H , 00H
NUM_A: DB 00H , 3FH , 7FH , 48H , 48H , 7FH , 3FH , 00H
NUM_B: DB 00H , 36H , 7FH , 49H , 49H , 7FH , 7FH , 00H
NUM_C: DB 00H , 22H , 63H , 41H , 41H , 7FH , 3EH , 00H
NUM_D: DB 00H , 3EH , 7FH , 41H , 41H , 7FH , 7FH , 00H
NUM_E: DB 00H , 41H , 49H , 49H , 49H , 7FH , 7FH , 00H
NUM_F: DB 00H , 40H , 48H , 48H , 48H , 7FH , 7FH , 00H

END