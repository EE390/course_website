ORG 0000H
DIN      EQU  P3.4 ; ADC DIN   Pin
CS       EQU  P3.5 ; ADC CS    Pin
CLK      EQU  P3.6 ; ADC DCLK  Pin
DOUT     EQU  P3.7 ; ADC DOUT  Pin
EN       EQU  P2.7 ; LCD E     Pin
RS       EQU  P2.6 ; LCD RS    Pin
RW       EQU  P2.5 ; LCD R/W   Pin
LCD_DATA EQU  P0   ; LCD D7-D0 Pins

CLR RW ; LCD Write Mode Selected

LCALL SPI_START ; Reset the ADC chip

REPEAT:
LCALL READ_ADC_DATA ; Aquire the Analog 12-bit data into [B = Highest 4-bits] and [A = Remaining 8-bits] registers
LCALL HEX_TO_DEC ; Convert the Hex values in A and B into Decimal values, The results will be stored in R2-R5
LCALL NUMBER_TO_ASCII ; This converts the values in R2-R5 into Their's ASCII characters
LCALL CLEAR_LCD ; Clear the LCD
MOV LCD_DATA,R2
LCALL SEND_DATA ; Display the R2 register content into LCD
MOV LCD_DATA,R3
LCALL SEND_DATA ; Display the R3 register content into LCD
MOV LCD_DATA,R4
LCALL SEND_DATA ; Display the R4 register content into LCD
MOV LCD_DATA,R5
LCALL SEND_DATA ; Display the R5 register content into LCD
MOV R7,#255
LCALL DELAY_R7_mS ; 255ms Delay before reading the next value
SJMP REPEAT

SPI_START: ; Reset the ADC chip
	CLR  CLK
	SETB CS
	SETB DIN
	SETB CLK
	CLR  CS
	RET

SPI_WRITE: ;Assuming A has the data to be written through SPI to ADC
	CLR CLK
	MOV R7,#08H
	AGAIN_SPI_WRITE:
		MOV C,ACC.7
		MOV DIN,C
		RL A
		CLR CLK
		SETB CLK
		DJNZ R7,AGAIN_SPI_WRITE
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
		CLR CLK
		DJNZ R7,AGAIN0_SPI_READ
		MOV B,A
	CLR A
	MOV R7,#08H
	AGAIN1_SPI_READ:
		RL A
		MOV C,DOUT
		MOV ACC.0,C
		SETB CLK
		CLR CLK
		DJNZ R7,AGAIN1_SPI_READ
	RET
READ_ADC_DATA: ; Aquire the Analog 12-bit data into [B = Highest 4-bits] and [A = Remaining 8-bits] registers
	CLR CLK
	CLR CS
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
	SETB CLK
	NOP
	NOP
	LCALL SPI_READ; Read the ADC 12bit data output and save it in A and B
	SETB CS
	RET
CLEAR_LCD:
	CLR RS
	MOV LCD_DATA,#01H ; Clear display screen
	LCALL SEND_DATA
	MOV LCD_DATA,#0FH ; Display on, cursor blinking
	LCALL SEND_DATA
	MOV LCD_DATA,#38H ; 2 lines and 5×7 matrix Mode
	LCALL SEND_DATA
	MOV LCD_DATA,#80H ; Force cursor to the beginning ( 1st line)
	LCALL SEND_DATA
	SETB RS
	RET
SEND_DATA: ; Excute the Data ready on LCD_DATA pins
	SETB EN
	MOV R7,#5H
	LCALL DELAY_R7_mS ; Wait 5mS for data processing in LCD 
	CLR EN
	RET
DELAY_R7_mS:  ; R7 value will decide how many mS of Delay
	MOV TMOD,#01H
	CLR TF0
	CLR TR0
	R7_mS:
		MOV TH0,#0FCH ; For 1mS
		MOV TL0,#67H  ; For 1mS
		SETB TR0
		TF0_WAIT:
			JNB TF0,TF0_WAIT
		CLR TF0
		CLR TR0
		DJNZ R7,R7_mS  ; R7 value will decide how many mS
	RET
NUMBER_TO_ASCII: ; This converts the values in R2-R5 into Their's ASCII characters
	MOV R0,#02H
	MOV R7,#04H
	AGAIN_NUMBER_TO_ASCII:
		MOV A,@R0
		CJNE A,#10,CONTINUE
		CONTINUE:
			JC NUMBER
			ADD A,#37H
			MOV @R0,A
			SJMP FINISH_NUMBER_TO_ASCII
			NUMBER:
				ADD A,#30H
				MOV @R0,A
			FINISH_NUMBER_TO_ASCII:
				INC R0
				DJNZ R7,AGAIN_NUMBER_TO_ASCII
	RET	
HEX_TO_DEC: ; The results will be stored in R2-R5
	MOV R2,#00H
	MOV R3,#00H
	MOV R4,#00H
	MOV R5,#00H
	MOV R0,B
	MOV R1,A
	MOV R6,#03H
	MOV R7,#0E8H
	CLR C
	AGAIN1000:
		LCALL SUBTRACT
		JC FINISH1000
		INC R2
		SJMP AGAIN1000
	FINISH1000:
		LCALL ADDITION
	MOV R6,#00H
	MOV R7,#64H
	CLR C
	AGAIN100:
		LCALL SUBTRACT
		JC FINISH100
		INC R3
		SJMP AGAIN100
	FINISH100:
		LCALL ADDITION	
	MOV R6,#00H	
	MOV R7,#0AH
	CLR C
	AGAIN10:
		LCALL SUBTRACT
		JC FINISH10
		INC R4
		SJMP AGAIN10
	FINISH10:
		LCALL ADDITION
	MOV 5H,R1
	RET
SUBTRACT:
	MOV A,R1
	SUBB A,R7
	MOV R1,A
	MOV A,R0
	SUBB A,R6
	MOV R0,A
	RET
ADDITION:
	MOV A,R1
	ADD A,R7
	MOV R1,A
	MOV A,R0
	ADDC A,R6
	MOV R0,A
	RET





END