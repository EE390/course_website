ORG 0000H

CLK 	 EQU  P3.6 ; SCLK pin for DS1302
I_O 	 EQU  P3.4 ; I/O  pin for DS1302
CE  	 EQU  P3.5 ; CE   pin for DS1302
EN       EQU  P2.7 ; LCD E     Pin
RS       EQU  P2.6 ; LCD RS    Pin
RW       EQU  P2.5 ; LCD R/W   Pin
LCD_DATA EQU  P0   ; LCD D7-D0 Pins

CLR RW ; LCD Write Mode Selected

; Saving Required time here in this order:
; Seconds - Minutes - Hours - Day - Month - DayName - Year (only the first two numbers like: 23 for 2023)
MOV 20H,#50H ; Seconds
MOV 21H,#59H ; Minutes
MOV 22H,#12H ; Hours
MOV 23H,#27H ; Day
MOV 24H,#08H ; Month
MOV 25H,#01H ; DayName (Sunday)
MOV 26H,#23H ; Year


MOV A,#8EH ; The command is 8E which is for write protect options
MOV B,#00H ; the data is 00 which is enable writing to the DS1302
LCALL WRITE_DATA ; The command should be in A and the data should be in B


;80H Write Command for Seconds
;82H Write Command for Minutes
;84H Write Command for Hours
;86H Write Command for Day
;88H Write Command for Month
;8AH Write Command for DayName
;8CH Write Command for Year
MOV R1,#80H ; Write Command for Seconds
MOV R0,#20H ; Pointing to the start of the time and date data
MOV 50H,#07H ; Repeat 7 times to input all data

WRITING_TIME_AND_DATE:
MOV A,R1
MOV B,@R0
LCALL WRITE_DATA ; The command should be in A and the data should be in B
INC R0
INC R1
INC R1
DJNZ 50H,WRITING_TIME_AND_DATE

MOV A,#8EH ; The command is 8E which is for write protect options
MOV B,#80H ; the data is 80 which is disable writing to the DS1302
LCALL WRITE_DATA ; The command should be in A and the data should be in B

;81H Read Command for Seconds
;83H Read Command for Minutes
;85H Read Command for Hours
;87H Read Command for Day
;89H Read Command for Month
;8BH Read Command for DayName
;8DH Read Command for Year

REPEAT:
	MOV R1,#81H ; Read Command for Seconds
	MOV R0,#20H ; Pointing to the start of the time and date to save data
	MOV 50H,#07H ; Repeat 7 times to save all data

	READING_TIME_AND_DATE:
		MOV A,R1
		LCALL READ_DATA
		MOV @R0,A
		INC R0
		INC R1
		INC R1
		DJNZ 50H,READING_TIME_AND_DATE
		
	LCALL CLEAR_LCD ; Clear the LCD
	DEC R0 ; Go back to point to the Year Data which was saved last
	
	MOV LCD_DATA,#'D'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'A'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'T'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'E'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#' '
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'2'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'0'
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Year Data
	SWAP A ; Take the 10s number to be displayed first
	ANL A,#0FH ; Take the 10s number to be displayed first
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Year Data
	ANL A,#0FH ; Take the 1s number to be displayed secondly
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	DEC R0
	DEC R0 ; Skip the Day name
	MOV LCD_DATA,#'/'
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Month Data
	SWAP A ; Take the 10s number to be displayed first
	ANL A,#0FH ; Take the 10s number to be displayed first
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Month Data
	ANL A,#0FH ; Take the 1s number to be displayed secondly
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	DEC R0
	MOV LCD_DATA,#'/'
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Day Data
	SWAP A ; Take the 10s number to be displayed first
	ANL A,#0FH ; Take the 10s number to be displayed first
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Day Data
	ANL A,#0FH ; Take the 1s number to be displayed secondly
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	DEC R0
	LCALL LCD_SECOND_LINE ; Move LCD to Second Line
	MOV LCD_DATA,#'T'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'I'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'M'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#'E'
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#' '
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Hour Data
	SWAP A ; Take the 10s number to be displayed first
	ANL A,#0FH ; Take the 10s number to be displayed first
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Hour Data
	ANL A,#0FH ; Take the 1s number to be displayed secondly
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	DEC R0
	MOV LCD_DATA,#':'
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Minute Data
	SWAP A ; Take the 10s number to be displayed first
	ANL A,#0FH ; Take the 10s number to be displayed first
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Minute Data
	ANL A,#0FH ; Take the 1s number to be displayed secondly
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	DEC R0
	MOV LCD_DATA,#':'
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Seconds Data
	SWAP A ; Take the 10s number to be displayed first
	ANL A,#0FH ; Take the 10s number to be displayed first
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV A,@R0 ; Grab the Seconds Data
	ANL A,#0FH ; Take the 1s number to be displayed secondly
	ADD A,#30H ; Convert the number into ASCII
	MOV LCD_DATA,A
	LCALL SEND_LCD_DATA
	MOV R7,#250
	LCALL DELAY_R7_mS
	MOV R7,#250
	LCALL DELAY_R7_mS ; 500ms Delay before reading the next value
	LJMP REPEAT
	
WRITE_DATA: ; The command should be in A and the data should be in B
	CLR CE
	NOP
	CLR CLK
	NOP
	SETB CE
	NOP
	LCALL SEND_DATA
	MOV A,B
	LCALL SEND_DATA
	CLR CE
	NOP
	RET
READ_DATA: ; The command should be in A and the result will be in A
	CLR CE
	NOP
	CLR CLK
	NOP
	SETB CE
	NOP
	LCALL SEND_DATA
	LCALL RECEIVE_DATA
	CLR CE
	NOP
	SETB CLK ;The following is the stabilization time of DS1302 reset, which is necessary.
	NOP
	CLR I_O
	NOP
	SETB I_O
	NOP
	RET	



SEND_DATA:
	MOV R7,#08H
	AGAIN_SEND_DATA:
		MOV C,ACC.0
		MOV I_O,C
		RR A
		SETB CLK
		NOP
		CLR CLK
		NOP
		DJNZ R7,AGAIN_SEND_DATA
	RET
RECEIVE_DATA:
	MOV R7,#08H
	CLR A
	AGAIN_RECEIVE_DATA:
		MOV C,I_O
		MOV ACC.0,C
		RR A
		SETB CLK
		NOP
		CLR CLK
		NOP
		DJNZ R7,AGAIN_RECEIVE_DATA
	RET
CLEAR_LCD:
	CLR RS
	MOV LCD_DATA,#01H ; Clear display screen
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#0FH ; Display on, cursor blinking
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#38H ; 2 lines and 5 7 matrix Mode
	LCALL SEND_LCD_DATA
	MOV LCD_DATA,#80H ; Force cursor to the beginning ( 1st line)
	LCALL SEND_LCD_DATA
	SETB RS
	RET
LCD_SECOND_LINE:
	CLR RS
	MOV LCD_DATA,#0C0H ; Force cursor to the beginning ( 2nd line)
	LCALL SEND_LCD_DATA
	SETB RS
	RET
SEND_LCD_DATA: ; Excute the Data ready on LCD_DATA pins
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
END