IR_IN EQU P3.2 ; IR Data Pin

ORG 0000H
	LJMP MAIN
ORG 0003H ; External 0 interrupt Vector Address
	LCALL Check_9000us ; Check the First 9ms LOW signal as a start for a data streaming 
	JNB B.0, EXIT ; If failed to recceive 9ms LOW signal then Exit this subroutine
	LCALL Check_4500us ; Check the Second 4.5ms HIGH signal as next step for data streaming 
	JNB B.0, EXIT ; If failed to recceive 4.5ms HIGH signal then Exit this subroutine

	MOV R1,#20H ; Locations in RAM to save the 4 bytes that will be received through IR
	MOV 51H,#04H ; 4 Bytes

	Next_Byte:
		MOV 50H,#08H ; A single byte has 8 bits
	Next_Bit:
		RR A
		LCALL Check_IR_LOW ; The Logic starts with a 560us LOW first
		JNB B.0, EXIT ; If failed to recceive 560us LOW signal then Exit this subroutine
		LCALL Check_IR_HIGH ; Then The signal will be HIGH, if HIGH for 560us then it is LOGIC 0 if HIGH for 1680us then it is LOGIC 1
		JNB B.0, EXIT; If failed to recceive either 560us or 1680us HIGH signal then Exit this subroutine
		DJNZ 50H,Next_Bit ; Go to the next Bit
		MOV @R1,A ; Save the byte in RAM
		INC R1 ; Point to next Location in RAM
		DJNZ 51H,Next_Byte ; Go to the next Byte
		
	MOV R1,#20H ; Source Byte
	MOV R0,#40H ; Destination Nibble
	MOV 50H,#04H ; 4 Bytes to be converted
	
	DATA_ARRANGE: ; This convert the 4 Bytes into 8 Nibbles saved separately
		MOV A,@R1
		ANL A,#0FH
		MOV @R0,A
		INC R0
		MOV A,@R1
		SWAP A
		ANL A,#0FH
		MOV @R0,A
		INC R0
		INC R1
		DJNZ 50H,DATA_ARRANGE
	EXIT:
		RETI
	
MAIN:
	MOV DPTR,#0500H ; Location in ROM where Segments are saved
	MOV IE,#81H ; Enable the External 0 interrupt which is the IR signal going from HIGH to LOW which indicates that a signal is received
	
	REPEAT:
	MOV P2,#00011100B ; Selecting 8th Digit in 7-segmeent
	MOV A,40H ; Grab the 1st number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00011000B ; Selecting 7th Digit in 7-segmeent
	MOV A,41H ; Grab the 2nd number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00010100B ; Selecting 6th Digit in 7-segmeent
	MOV A,42H ; Grab the 3rd number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00010000B ; Selecting 5th Digit in 7-segmeent
	MOV A,43H ; Grab the 4th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00001100B ; Selecting 4th Digit in 7-segmeent
	MOV A,44H ; Grab the 5th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00001000B ; Selecting 3rd Digit in 7-segmeent
	MOV A,45H ; Grab the 6th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00000100B ; Selecting 2nd Digit in 7-segmeent
	MOV A,46H ; Grab the 7th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00000000B ; Selecting 1st Digit in 7-segmeent
	MOV A,47H ; Grab the 8th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	SJMP REPEAT

Check_IR_LOW:
	MOV R0,#00H
	AGAIN_Check_IR_LOW:
		LCALL DELAY_100uS_LOW 
		INC R0; Count at every interval of 100us
		JNB IR_IN,AGAIN_Check_IR_LOW ; Stop the count once the IR signal Changes 
		NEXT_IR_LOW_0: CJNE R0,#6,NEXT_IR_LOW_1 ; Check if it lasted around 560us with a margin of error
		SJMP Count_IR_LOW_OK ; Passed
		NEXT_IR_LOW_1: CJNE R0,#7,ERROR_IR_LOW ; Check if it lasted around 560us with a margin of error
		Count_IR_LOW_OK: ; Passed
			SETB B.0 ; Passed
	RET
		ERROR_IR_LOW: ; Failed
			CLR B.0 ; Failed
	RET

Check_IR_HIGH:
	MOV R0,#00H
	AGAIN_Check_IR_HIGH:
		LCALL DELAY_100uS_HIGH
		INC R0
		JB IR_IN,AGAIN_Check_IR_HIGH
		NEXT_IR_HIGH_0: CJNE R0,#4,NEXT_IR_HIGH_1 ; Check if it lasted around 560us with a margin of error
		SJMP Count_IR_HIGH_ZERO ; Passed with Logic 0
		NEXT_IR_HIGH_1: CJNE R0,#5,NEXT_IR_HIGH_2 ; Check if it lasted around 560us with a margin of error
		SJMP Count_IR_HIGH_ZERO ; Passed with Logic 0
		NEXT_IR_HIGH_2: CJNE R0,#6,NEXT_IR_HIGH_3 ; Check if it lasted around 560us with a margin of error
		SJMP Count_IR_HIGH_ZERO ; Passed with Logic 0
		NEXT_IR_HIGH_3: CJNE R0,#7,NEXT_IR_HIGH_4 ; Check if it lasted around 560us with a margin of error
		Count_IR_HIGH_ZERO: ; Passed with Logic 0
			SETB B.0 ; Passed with Logic 0
			CLR ACC.7 ; Passed with Logic 0
	RET
		NEXT_IR_HIGH_4: CJNE R0,#15,NEXT_IR_HIGH_5 ; Check if it lasted around 1680us with a margin of error
		SJMP Count_IR_HIGH_ONE ; Passed with Logic 1
		NEXT_IR_HIGH_5: CJNE R0,#16,NEXT_IR_HIGH_6 ; Check if it lasted around 1680us with a margin of error
		SJMP Count_IR_HIGH_ONE ; Passed with Logic 1
		NEXT_IR_HIGH_6: CJNE R0,#17,NEXT_IR_HIGH_7 ; Check if it lasted around 1680us with a margin of error
		SJMP Count_IR_HIGH_ONE ; Passed with Logic 1
		NEXT_IR_HIGH_7: CJNE R0,#18,ERROR_IR_HIGH  ; Check if it lasted around 1680us with a margin of error
		Count_IR_HIGH_ONE: ; Passed with Logic 1
			SETB B.0 ; Passed with Logic 1
			SETB ACC.7 ; Passed with Logic 1
	RET
		ERROR_IR_HIGH: ; Failed
			CLR B.0 ; Failed
	RET
	
Check_4500us:
	MOV R0,#00H
	AGAIN_Check_4500us:
		LCALL DELAY_100uS_HIGH
		INC R0; Count at every interval of 100us
		JB IR_IN,AGAIN_Check_4500us ; Stop the count once the IR signal Changes 
		NEXT_4500us_0: CJNE R0,#43,NEXT_4500us_1 ; Check if it lasted around 4.5ms with a margin of error
		SJMP Count_4500us_OK ; Passed
		NEXT_4500us_1: CJNE R0,#44,ERROR_4500us ; Check if it lasted around 4.5ms with a margin of error
		Count_4500us_OK: ; Passed
			SETB B.0 ; Passed
	RET
		ERROR_4500us: ; Failed
			CLR B.0 ; Failed
	RET
	
Check_9000us:
	MOV R0,#00H
	AGAIN_Check_9000us:
		LCALL DELAY_100uS_LOW
		INC R0; Count at every interval of 100us
		JNB IR_IN,AGAIN_Check_9000us ; Stop the count once the IR signal Changes 
		NEXT_9000us_0: CJNE R0,#91,NEXT_9000us_1 ; Check if it lasted around 9ms with a margin of error
		SJMP Count_9000us_OK ; Passed
		NEXT_9000us_1: CJNE R0,#90,NEXT_9000us_2 ; Check if it lasted around 9ms with a margin of error
		SJMP Count_9000us_OK ; Passed
		NEXT_9000us_2: CJNE R0,#89,NEXT_9000us_3 ; Check if it lasted around 9ms with a margin of error
		SJMP Count_9000us_OK ; Passed
		NEXT_9000us_3: CJNE R0,#88,ERROR_9000us ; Check if it lasted around 9ms with a margin of error
		Count_9000us_OK: ; Passed
			SETB B.0 ; Passed
	RET
		ERROR_9000us: ; Failed
			CLR B.0 ; Failed
	RET

DELAY_100uS_LOW: ; A 100us with a condition that the IR signal is LOW break if it is HIGH
	NOP
	NOP
	MOV 30H,#21
	NEXT_DELAY_100uS_LOW:
		JB IR_IN,EXIT_DELAY_100uS_LOW
		DJNZ 30H,NEXT_DELAY_100uS_LOW
	EXIT_DELAY_100uS_LOW:
	RET

DELAY_100uS_HIGH: ; A 100us with a condition that the IR signal is HIGH break if it is LOW
	NOP
	NOP
	MOV 30H,#21
	NEXT_DELAY_100uS_HIGH:
		JNB IR_IN,EXIT_DELAY_100uS_HIGH
		DJNZ 30H,NEXT_DELAY_100uS_HIGH
	EXIT_DELAY_100uS_HIGH:
	RET

DELAY_1mS: ; A 100ms Delay
	MOV 30H,#2
	MOV 31H,#199
	NEXT_DELAY_1mS:
		DJNZ 31H,NEXT_DELAY_1mS
		DJNZ 30H,NEXT_DELAY_1mS
	RET


ORG 0500H
DB 3FH, 06H, 5BH, 4FH, 66H, 6DH, 7DH, 07H, 7FH, 6FH, 77H, 7CH, 39H, 5EH, 79H, 71H, 00H, 40H
   ;0   ;1   ;2   ;3   ;4   ;5   ;6   ;7   ;8   ;9   ;A   ;b   ;C   ;d   ;E   ;F ,  + ,  -



END