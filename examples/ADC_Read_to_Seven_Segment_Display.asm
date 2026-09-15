DIN      EQU  P3.4 ; ADC DIN   Pin
CS       EQU  P3.5 ; ADC CS    Pin
CLK      EQU  P3.6 ; ADC DCLK  Pin
DOUT     EQU  P3.7 ; ADC DOUT  Pin
SEGMENTS EQU  P0   ; 7-Segment Shape


ORG 0000H
	LCALL SPI_START ; Reset the ADC chip
	MOV TMOD,#01H ; Timer 0 Mode 1
	MOV DPTR,#0300H ; Location in ROM where Segments are saved
	MOV P2,#00H ; Selecting First Digit
	MOV P0,#00H ; Turn OFF all Segments
	
REPEAT: 
	MOV P2,#00000000B ; Selecting 1st Digit in 7-segmeent
	MOV P0,#00H ; Turn OFF all Segments
	LCALL READ_ADC_DATA ; Aquire the Analog 12-bit data into [B = Highest 4-bits] and [A = Remaining 8-bits] registers
	LCALL HEX_TO_DEC ; Convert the Hex values in A and B into Decimal values, The results will be stored in R2-R5
	MOV A,R5 ; Grab the 1st number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00000100B ; Selecting 2nd Digit in 7-segmeent
	MOV A,R4 ; Grab the 2nd number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00001000B ; Selecting 3rd Digit in 7-segmeent
	MOV A,R3 ; Grab the 3rd number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00001100B ; Selecting 4th Digit in 7-segmeent
	MOV A,R2 ; Grab the 4th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	SJMP REPEAT


SPI_START: ; Reset procedure for the ADC chip
	CLR  CLK
	SETB CS
	SETB DIN
	SETB CLK
	CLR  CS ; Enable ADC Chip
	RET

SPI_WRITE: ;Assuming A has the data to be written through SPI to ADC
	CLR CLK
	MOV R7,#08H
	AGAIN_SPI_WRITE:
		MOV C,ACC.7
		MOV DIN,C
		RL A
		CLR CLK
		SETB CLK ; Generating Positive Edge to write the next bit
		DJNZ R7,AGAIN_SPI_WRITE ; Repeat 8 times for one Byte
	RET

SPI_READ: ; The output will be in B as 4 bit high and A as 8 bit low for 12bit ADC
	CLR CLK
	MOV R7,#04H
	CLR A
	MOV B,A
	AGAIN0_SPI_READ:
		RL A
		MOV C,DOUT
		MOV ACC.0,C
		SETB CLK
		CLR CLK ; Generating Negative Edge to read the next bit
		DJNZ R7,AGAIN0_SPI_READ ; Repeat 8 times for one Byte
		MOV B,A ; Move the read data to B as 4 bit high
	CLR A
	MOV R7,#08H
	AGAIN1_SPI_READ:
		RL A
		MOV C,DOUT
		MOV ACC.0,C
		SETB CLK
		CLR CLK ; Generating Negative Edge to read the next bit
		DJNZ R7,AGAIN1_SPI_READ ; Repeat 8 times for one Byte
	RET
READ_ADC_DATA: ; Aquire the Analog 12-bit data into [B = Highest 4-bits] and [A = Remaining 8-bits] registers
	CLR CLK
	CLR CS ; Enable ADC Chip
	MOV A,#94H ; Read the Potentiometer Command.	#A4 to Read Photosensor.	#D4 to Read NTC.	#E4 to Read External Analog Signal in J52 pin IN3.
	LCALL SPI_WRITE ; Use the command in A to send it to ADC
	NOP
	NOP
	NOP
	NOP
	NOP
	NOP ; Waiting for the ADC to finish Processing
	CLR CLK
	NOP
	NOP
	SETB CLK ; Generating one positive Edge before reading the incoming data
	NOP
	NOP
	LCALL SPI_READ; Read the ADC 12bit data output and save it in A and B
	SETB CS ; Disable ADC Chip
	RET	
HEX_TO_DEC: ; The results will be stored in R2-R5
	MOV R2,#00H
	MOV R3,#00H
	MOV R4,#00H
	MOV R5,#00H 
	MOV 20H,B
	MOV 21H,A
	MOV R6,#03H
	MOV R7,#0E8H ; Decimal 1000 to subtract from ADC result
	CLR C
	AGAIN1000:
		LCALL SUBTRACT ; Subtracting 1000 from the ADC result
		JC FINISH1000 ; See if it reached negative number
		INC R2 ; Count how many 1000 in the number
		SJMP AGAIN1000
	FINISH1000:
		LCALL ADDITION ; Fix the ADC negative result by adding 1000
	MOV R6,#00H
	MOV R7,#64H ; Decimal 100 to subtract from previous result
	CLR C
	AGAIN100:
		LCALL SUBTRACT ; Subtracting 100 from the ADC result
		JC FINISH100 ; See if it reached negative number
		INC R3 ; Count how many 100 in the number
		SJMP AGAIN100
	FINISH100:
		LCALL ADDITION	 ; Fix the ADC negative result by adding 100
	MOV R6,#00H	
	MOV R7,#0AH ; Decimal 10 to subtract from previous result
	CLR C
	AGAIN10:
		LCALL SUBTRACT ; Subtracting 10 from the ADC result
		JC FINISH10 ; See if it reached negative number
		INC R4 ; Count how many 10 in the number
		SJMP AGAIN10
	FINISH10:
		LCALL ADDITION ; Fix the ADC negative result by adding 10
	MOV R5,21H ;  How many 1 in the remaining number
	RET
SUBTRACT: ;  Subtracting Two 16-bit numbers
	MOV A,21H
	SUBB A,R7
	MOV 21H,A
	MOV A,20H
	SUBB A,R6
	MOV 20H,A
	RET
ADDITION: ;  Adding Two 16-bit numbers
	MOV A,21H
	ADD A,R7
	MOV 21H,A
	MOV A,20H
	ADDC A,R6
	MOV 20H,A
	RET
DELAY_1mS:
	MOV TMOD,#01H
	CLR TF0
	CLR TR0
	MOV TH0,#0FCH ; For 1mS
	MOV TL0,#67H  ; For 1mS
	SETB TR0
	TF0_WAIT:
		JNB TF0,TF0_WAIT
	CLR TF0
	CLR TR0
	RET
ORG 0300H
DB 3FH, 06H, 5BH, 4FH, 66H, 6DH, 7DH, 07H, 7FH, 6FH, 77H, 7CH, 39H, 5EH, 79H, 71H
   ;0   ;1   ;2   ;3   ;4   ;5   ;6   ;7   ;8   ;9   ;A   ;b   ;C   ;d   ;E   ;F


END