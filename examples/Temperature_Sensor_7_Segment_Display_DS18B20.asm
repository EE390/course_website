TEMP_DATA_PIN EQU P3.7

ORG 0000H
	MOV DPTR,#0300H ; Location in ROM where Segments are saved
	MOV P2,#00H ; Selecting First Digit
	MOV P0,#00H ; Turn OFF all Segments
	
REPEAT: 	
	MOV P2,#00000000B ; Selecting 1st Digit in 7-segmeent
	MOV P0,#00H ; Turn OFF all Segments
	LCALL DS18B20_Take_TEMP_Data ;  ACC will have the 4-bit decimal point TEMP value and B will have the 8-bit TEMP value
	LCALL HEX_TO_DEC_R0_R3 ; Convert the B value into decimal stored in R0-R3
	LCALL Decimal_Point_Translation
	LCALL HEX_TO_DEC_R4_R7 ; Convert the ACC value into decimal points stored in R4-R7
	
	MOV P2,#00011100B ; Selecting 1st Digit in 7-segmeent
	MOV A,R0 ; Grab the 1st number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00011000B ; Selecting 2nd Digit in 7-segmeent
	MOV A,R1 ; Grab the 2nd number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00010100B ; Selecting 3rd Digit in 7-segmeent
	MOV A,R2 ; Grab the 3rd number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00010000B ; Selecting 4th Digit in 7-segmeent
	MOV A,R3 ; Grab the 4th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	CPL ACC.7
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00001100B ; Selecting 5th Digit in 7-segmeent
	MOV A,R4 ; Grab the 5th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00001000B ; Selecting 6th Digit in 7-segmeent
	MOV A,R5 ; Grab the 6th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00000100B ; Selecting 7th Digit in 7-segmeent
	MOV A,R6 ; Grab the 7th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	MOV P2,#00000000B ; Selecting 8th Digit in 7-segmeent
	MOV A,R7 ; Grab the 8th number
	MOVC A,@A+DPTR ; Convert it into its Segments form
	MOV P0,A ; Display the Segments
	LCALL DELAY_1mS
	SJMP REPEAT
	
DS18B20_Initialize:
	CLR TEMP_DATA_PIN ; Send LOW to Data pin for 480uS [Minimum is 480uS] 
	LCALL DELAY_480uS
	SETB TEMP_DATA_PIN ; Send HIGH to Data pin waiting for acknowledge from DS18B20
	LCALL DELAY_15uS ; 15uS delay to give DS18B20 time to respond
	JNB TEMP_DATA_PIN,OK_1 ; If the Data pin is LOW, Then DS18B20 is responding
	LCALL DELAY_15uS
	JNB TEMP_DATA_PIN,OK_1 ; Try again after 30uS
	LCALL DELAY_15uS
	JNB TEMP_DATA_PIN,OK_1 ; Try again after 45uS
	LCALL DELAY_15uS
	JNB TEMP_DATA_PIN,OK_1 ; Try again after 60uS
	LJMP RESET ; If there is no reponse, then reset the whole program
	OK_1:
		LCALL DELAY_60uS  ; 60uS delay to give DS18B20 time to respond by keeping LOW
		JB TEMP_DATA_PIN,OK_2
		LCALL DELAY_60uS ; Try again after 120uS
		JB TEMP_DATA_PIN,OK_2
		LCALL DELAY_60uS ; Try again after 180uS
		JB TEMP_DATA_PIN,OK_2
		LCALL DELAY_60uS ; Try again after 240uS
		JB TEMP_DATA_PIN,OK_2
		LJMP RESET ; If there is no reponse, then reset the whole program
		OK_2:
			RET
		
DS18B20_Send_Command: ; Send the ACC data to DS18B20 to issue a command
	MOV R7,#08H
	AGAIN_DS18B20_Send_Command:
		CLR TEMP_DATA_PIN ; Send LOW to DATA pin for 1uS before writing a bit of data.
		MOV C,ACC.0
		MOV TEMP_DATA_PIN,C ; Send the data bit [Starting from LSB]
		LCALL DELAY_60uS ; Wait 60uS for the DS18B20 to receive the data bit [Minimum is 60uS]
		SETB TEMP_DATA_PIN ; Send HIGH to DATA pin for 1uS before writing the next bit of data.
		RR A
		DJNZ R7,AGAIN_DS18B20_Send_Command
	RET
	
DS18B20_Read_Data: ; Save the received data from DS18B20 to ACC
	MOV R7,#08H
	AGAIN_DS18B20_Read_Data:
		CLR TEMP_DATA_PIN ; Send LOW to DATA pin for 1uS before reading the next bit of data.
		SETB TEMP_DATA_PIN ; Send HIGH to DATA pin for 1uS to indicate the end of reading the current bit.
		NOP
		NOP
		NOP
		NOP
		NOP
		NOP ; Gives 6uS delay to wait for the data stability
		MOV C,TEMP_DATA_PIN
		MOV ACC.7,C ; Read the data bit [Starting from LSB]
		LCALL DELAY_60uS ; Wait 60uS before reading the next data bit [Minimum is 60uS]
		RR A
		DJNZ R7,AGAIN_DS18B20_Read_Data
	RL A
	RET

DS18B20_Measure_TEMP: ; tells the DS18B20 to measure the temperature
	LCALL DS18B20_Initialize
	MOV A,#0CCH ; Command to skip addressing confirmation code
	LCALL DS18B20_Send_Command
	MOV A,#44H ; Command to measure the temperature [Result is stored in DS18B20]
	LCALL DS18B20_Send_Command
	RET

DS18B20_Read_Command: ; tells the DS18B20 to be ready for its data to be read
	LCALL DS18B20_Initialize
	MOV A,#0CCH ; Command to skip addressing confirmation code
	LCALL DS18B20_Send_Command
	MOV A,#0BEH ; Command to Enable the DS18B20 contents to be read
	LCALL DS18B20_Send_Command 
	RET

DS18B20_Take_TEMP_Data: ; Acquire the 16-bit temp data from DS18B20 and save into ACC and B
	LCALL DS18B20_Measure_TEMP ; tells the DS18B20 to measure the temperature
	LCALL DS18B20_Read_Command ; tells the DS18B20 to be ready for its data to be read
	LCALL DS18B20_Read_Data ; Save the received data from DS18B20 to ACC
	MOV B,A ; The first 8-bit data received from DS18B20 is the the high byte first and its bit-15 to bit-11 are for sign
	LCALL DS18B20_Read_Data ; Save the received data from DS18B20 to ACC [Thats the low byte which is in A] [bit-3 to bit-0 are for decimal point]
	XCH A,B
	MOV R7,A ; temporarily Copy ACC into R7
	SWAP A
	ANL A,#0FH
	XCH A,B
	SWAP A
	ANL A,#0F0H
	ORL A,B
	MOV B,A
	MOV A,R7
	ANL A,#0FH ; After this ACC will have the 4-bit decimal point TEMP value and B will have the 8-bit TEMP value	
	RET



DELAY_1mS:
	PUSH 40H
	PUSH 41H
	MOV 40H,#2
	MOV 41H,#195
	AGAIN_DELAY_1mS:
		DJNZ 41H,AGAIN_DELAY_1mS
		DJNZ 40H,AGAIN_DELAY_1mS
		POP 41H
		POP 40H
	RET

DELAY_480uS:
	NOP
	PUSH 40H
	MOV 40H,#216
	AGAIN_DELAY_480uS:
		DJNZ 40H,AGAIN_DELAY_480uS
		POP 40H
	RET
	
DELAY_60uS:
	PUSH 40H
	MOV 40H,#23
	AGAIN_DELAY_60uS:
		DJNZ 40H,AGAIN_DELAY_60uS
		POP 40H
	RET
	
DELAY_15uS:
	PUSH 40H
	MOV 40H,#2
	AGAIN_DELAY_15uS:
		DJNZ 40H,AGAIN_DELAY_15uS
		POP 40H
	RET

Decimal_Point_Translation:
	MOV B,A
	MOV 50H,#00H
	MOV 51H,#00H
	FIRST_DP: JNB B.3, SECOND_DP
		MOV A,51H
		ADD A,#88H ; Adding 5000
		MOV 51H,A
		MOV A,50H
		ADDC A,#13H
		MOV 50H,A
	SECOND_DP: JNB B.2, THIRD_DP
		MOV A,51H
		ADD A,#0C4H ; Adding 2500
		MOV 51H,A
		MOV A,50H
		ADDC A,#09H
		MOV 50H,A
	THIRD_DP: JNB B.1, FORTH_DP
		MOV A,51H
		ADD A,#0E2H ; Adding 1250
		MOV 51H,A
		MOV A,50H
		ADDC A,#04H
		MOV 50H,A
	FORTH_DP: JNB B.0, ZERO_DP
		MOV A,51H
		ADD A,#71H ; Adding 0625
		MOV 51H,A
		MOV A,50H
		ADDC A,#2H
		MOV 50H,A
	ZERO_DP:
		MOV B,50H
		MOV A,51H
	RET
	
HEX_TO_DEC_R0_R3: ; The results will be stored in R0-R3
	MOV 47H,A ; Temporarily store ACC into 47H for the current data protection
	JNB B.7, Positive ; Check if the reading is negative or positive value
	MOV R0,#11H ; Put negative sign into display
	XCH A,B
	CPL A
	ADD A,#01H
	XCH A,B ; The above procedure is to find the 2nd complement of the data since it was negative
	SJMP SKIP
	Positive: ; The data is postive
		MOV R0,#10H ; This will put no sign into display
	SKIP:
		MOV R1,#00H ; initializing the counts for every 1, 10, 100
		MOV R2,#00H
		MOV R3,#00H 
		MOV 20H,B
		CLR C
	AGAIN_100:
		MOV A,20H
		SUBB A,#100 ; Subtracting 100 from the result result
		MOV 20H,A
		JC FINISH_100 ; See if it reached negative number
		INC R1 ; Count how many 100 in the number
		SJMP AGAIN_100
	FINISH_100:
		MOV A,20H ; Fix the Temp negative result by adding 100	
		ADD A,#100
		MOV 20H,A
	CLR C
	AGAIN_10:
		MOV A,20H ; Subtracting 10 from the ADC result
		SUBB A,#10
		MOV 20H,A
		JC FINISH_10 ; See if it reached negative number
		INC R2 ; Count how many 10 in the number
		SJMP AGAIN_10
	FINISH_10:
		MOV A,20H ; Fix the Temp negative result by adding 10
		ADD A,#10
		MOV 20H,A
	MOV R3,20H ;  How many 1 in the remaining number
	MOV A,47H ; Return the value stored Temporarily from 47H to ACC
	RET

HEX_TO_DEC_R4_R7: ; The results will be stored in R4-R7
	MOV R4,#00H ; initializing the counts for every 1, 10, 100, 1000
	MOV R5,#00H
	MOV R6,#00H
	MOV R7,#00H 
	MOV 20H,B
	MOV 21H,A
	MOV 30H,#03H
	MOV 31H,#0E8H ; Decimal 1000 to subtract from TEMP result
	CLR C
	AGAIN1000:
		LCALL SUBTRACT ; Subtracting 1000 from the TEMP result
		JC FINISH1000 ; See if it reached negative number
		INC R4 ; Count how many 1000 in the number
		SJMP AGAIN1000
	FINISH1000:
		LCALL ADDITION ; Fix the TEMP negative result by adding 1000
	MOV 30H,#00H
	MOV 31H,#100 ; Decimal 100 to subtract from previous result
	CLR C
	AGAIN100:
		LCALL SUBTRACT ; Subtracting 100 from the TEMP result
		JC FINISH100 ; See if it reached negative number
		INC R5 ; Count how many 100 in the number
		SJMP AGAIN100
	FINISH100:
		LCALL ADDITION	 ; Fix the TEMP negative result by adding 100
	MOV 30H,#00H	
	MOV 31H,#10 ; Decimal 10 to subtract from previous result
	CLR C
	AGAIN10:
		LCALL SUBTRACT ; Subtracting 10 from the ADTEMPC result
		JC FINISH10 ; See if it reached negative number
		INC R6 ; Count how many 10 in the number
		SJMP AGAIN10
	FINISH10:
		LCALL ADDITION ; Fix the TEMP negative result by adding 10
	MOV R7,21H ;  How many 1 in the remaining number
	RET
SUBTRACT: ;  Subtracting Two 16-bit numbers
	MOV A,21H
	SUBB A,31H
	MOV 21H,A
	MOV A,20H
	SUBB A,30H
	MOV 20H,A
	RET
ADDITION: ;  Adding Two 16-bit numbers
	MOV A,21H
	ADD A,31H
	MOV 21H,A
	MOV A,20H
	ADDC A,30H
	MOV 20H,A
	RET
	

ORG 0300H
DB 3FH, 06H, 5BH, 4FH, 66H, 6DH, 7DH, 07H, 7FH, 6FH, 77H, 7CH, 39H, 5EH, 79H, 71H, 00H, 40H
   ;0   ;1   ;2   ;3   ;4   ;5   ;6   ;7   ;8   ;9   ;A   ;b   ;C   ;d   ;E   ;F ,  + ,  -


END
