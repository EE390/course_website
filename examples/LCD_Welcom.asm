ORG 0000H
EN       EQU P2.7
RS       EQU P2.6
RW       EQU P2.5
LCD_DATA EQU P0
CLR RW ; LCD Write Mode Selected
LCALL WELCOME
XXX: SJMP XXX
SEND_DATA: ; Excute the Data ready on LCD_DATA pins
	SETB EN
	MOV B,#5H
	LCALL DELAY_B_mS ; Wait 5mS for data processing in LCD 
	CLR EN
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
WELCOME:
	LCALL CLEAR_LCD
	MOV DPTR,#TEXT_WELCOME
	AGAIN_WELCOME:
		CLR A
		MOVC A,@A+DPTR
		JZ FINISH_WELCOME
		MOV LCD_DATA,A
		LCALL SEND_DATA
		INC DPTR
		SJMP AGAIN_WELCOME
	FINISH_WELCOME:
	RET
DELAY_B_mS:
	MOV TMOD,#01H
	CLR TF0
	CLR TR0
	B_mS:
		MOV TH0,#0FCH ; For 1mS
		MOV TL0,#67H  ; For 1mS
		SETB TR0
		TF0_WAIT:
			JNB TF0,TF0_WAIT
		CLR TF0
		CLR TR0
		DJNZ B,B_mS  ; B value will decide how many mS
	RET
TEXT_WELCOME: DB 'WELCOME!',00H
END