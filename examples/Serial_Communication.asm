ORG 0000H
MOV TMOD,#20H ; Timer 1 Mode 2 for serial baud rate
MOV TH1,#0FDH ; baud rate of 9600
MOV SCON,#50H ; 8-bit data + 1 stop bit + 1 start bit
SETB TR1 ; start timer 1
MOV DPTR,#TEXT_SELECT_MODE ; Selecting the text in ROM to be displayed through serial
LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
CJNE A,#'R',CHECK_AGAIN ; Check the selected mode 
LJMP READ_MODE ; Go to Read mode
CHECK_AGAIN: CJNE A,#'W',ERROR; Check the selected mode 
LJMP WRITE_MODE ; Go to write mode

ERROR: ; If the input is not R nor W, this mode just display error message and reset the program
	MOV DPTR,#TEXT_INVALID_TRY_AGAIN ; Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	LJMP RESET ; reset the program without affecting the saved data

WRITE_MODE:
	MOV DPTR,#TEXT_ASK_FOR_ADDRESS ;Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
	LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
	LCALL ASCII_TO_NUMBER ; The Received data is in ASCII so it is needed to be converted into hex number
	SWAP A ; Because the Received data is for the High nibble
	MOV B,A ; temporarily save it in B
	LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
	LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
	LCALL ASCII_TO_NUMBER ; The Received data is in ASCII so it is needed to be converted into hex number
	ORL A,B ; Merging the Received data low nibble with the previous high nibble
	MOV R0,A ; Save the Received address into R0 to be used as pointer in RAM [Indirect addressing]
	MOV DPTR,#TEXT_ASK_FOR_DATA ; Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
	LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
	LCALL ASCII_TO_NUMBER ; The Received data is in ASCII so it is needed to be converted into hex number
	SWAP A ; Because the Received data is for the High nibble
	MOV B,A ; temporarily save it in B
	LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
	LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
	LCALL ASCII_TO_NUMBER ; The Received data is in ASCII so it is needed to be converted into hex number
	ORL A,B ; Merging the Received data low nibble with the previous high nibble
	MOV @R0,A ; Save the Received DATA into the selected address before
	MOV DPTR,#TEXT_TRANSMIT_DONE ; Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	LJMP RESET
READ_MODE:
	MOV DPTR,#TEXT_ASK_FOR_ADDRESS ; Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
	LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
	LCALL ASCII_TO_NUMBER ; The Received data is in ASCII so it is needed to be converted into hex number
	SWAP A ; Because the Received data is for the High nibble
	MOV B,A ; temporarily save it in B
	LCALL RECEIVE_SERIAL ; Receive the incoming 8-bit data through serial
	LCALL TRANSMIT_SERIAL ; Transmit the Received data through serial for confirmation 
	LCALL ASCII_TO_NUMBER ; The Received data is in ASCII so it is needed to be converted into hex number
	ORL A,B ; Merging the Received data low nibble with the previous high nibble
	MOV R0,A ; Save the Received address into R0 to be used as pointer in RAM [Indirect addressing]
	MOV DPTR,#TEXT_RESULT_DATA ; Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	MOV A,@R0 ; Acquire the DATA from the address given
	SWAP A 
	ANL A,#0FH ; Choose only the 4-bit high nibble from the data
	LCALL NUMBER_TO_ASCII ; Convert it in ASCII to be displayed correctly
	LCALL TRANSMIT_SERIAL ; Transmit the first data [High 4-bit]
	MOV A,@R0 ; Acquire the DATA from the address given
	ANL A,#0FH; Choose only the 4-bit low nibble from the data
	LCALL NUMBER_TO_ASCII ; Convert it in ASCII to be displayed correctly
	LCALL TRANSMIT_SERIAL ; Transmit the second data [Low 4-bit]
	MOV DPTR,#TEXT_TRANSMIT_DONE ; Selecting the text in ROM to be displayed through serial
	LCALL TRANSMIT_MESSAGE ; Transimt the text through serial
	LJMP RESET
	
TRANSMIT_MESSAGE: ; Transmit the text selected in ROM by DPTR and stop transmitting once received 00H from ROM
	CLR A
	MOVC A,@A+DPTR
	LCALL TRANSMIT_SERIAL
	INC DPTR
	JNZ TRANSMIT_MESSAGE
	RET

TRANSMIT_SERIAL:
	MOV SBUF,A ; Save the value of A into Serial Buffer Register for transmission
	AGAIN_TRANSMIT_SERIAL:
		JNB TI,AGAIN_TRANSMIT_SERIAL ; Wait until the transmission is complete
	CLR TI ; Clear the transmission complete bit
	RET

RECEIVE_SERIAL:
	JNB RI,RECEIVE_SERIAL ; Wait until the data is Received 
	MOV A,SBUF ; Save the Received data from SBUF into A
	CLR RI ; Cleat the Received data compelte bit 
	RET
	
NUMBER_TO_ASCII: ; This converts the value in A into it's ASCII character
	CJNE A,#10,CONTINUE
	CONTINUE:
		JC NUMBER
		ADD A,#37H
	SJMP FINISH_NUMBER_TO_ASCII
	NUMBER:
		ADD A,#30H
	FINISH_NUMBER_TO_ASCII:
	RET
	
ASCII_TO_NUMBER: ; This converts the ASCII in A into it's HEX number
	CJNE A,#3AH,CONTINUE2
	CONTINUE2:
		JC NUMBER2
		CLR C
		SUBB A,#37H
	SJMP FINISH_NUMBER_TO_ASCII2
	NUMBER2:
		CLR C
		SUBB A,#30H
	FINISH_NUMBER_TO_ASCII2:
	RET
	
TEXT_RESULT_DATA:
	DB 0AH, 'THE STORED DATA IS :', 00H
TEXT_SELECT_MODE:
	DB 0AH, 'PLEASE SELECT READ OR WRITE BY TYPING R OR W',00H
TEXT_INVALID_TRY_AGAIN:
	DB 0AH, 'INVALID INPUT PLEASE TRY AGAIN', 00H
TEXT_ASK_FOR_DATA:
	DB 0AH ,'PLEASE ENTER DATA:', 00H
TEXT_ASK_FOR_ADDRESS:
	DB 0AH,'PLEASE ENTER ADDRESS:', 00H
TEXT_TRANSMIT_DONE:
	DB 0AH,'DONE!!!', 00H			
END
	