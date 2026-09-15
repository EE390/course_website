ORG 0000H
	LJMP MAIN
ORG 000BH ; Timer 0 Interrupt Vector Address
	MOV B,A ; Temporarily Store A into B
	CLR TF0
	CLR TR0
	MOV TH0,R0 ; The Timer duration will be decided by R0 and R1
	MOV TL0,R1 ; R0 and R1 values will be selected from 4x4 Keypad
	SETB TR0
	CPL P2.5 ; Complement the Passive Buzzer value to make it Oscillate and Generate sound with different frequency
	MOV A,B ; Retrieve the A value from B
	RETI
ORG 0030H
MAIN:
	MOV IE,#82H ; Enable Timer 0 Interrupt
	MOV TMOD,#01H ; Timer 0 Mode 1
	MOV A,#0FFH
	MOV P2,A ; P2 as Input
	SETB TF0 ; Force Timer 0 Interrupt to make the timer running  
		AGAIN:
			MOV P1, #0FFH
			CLR P1.7 ; Send signal to 1st Row
			JB P1.3,NEXT1 ; Check 1st Column
			MOV R0,#0E0H
			MOV R1,#00H
		NEXT1: JB P1.2, NEXT2 ; Check 2nd Column
			MOV R0,#0F0H
			MOV R1,#00H
		NEXT2: JB P1.1, NEXT3 ; Check 3rd Column
			MOV R0,#0F1H
			MOV R1,#00H
		NEXT3: JB P1.0, NEXTA ; Check 4th Column
			MOV R0,#0F2H
			MOV R1,#00H
		NEXTA: SETB P1.7
			CLR P1.6 ; Send signal to 2nd Row
			JB P1.3,NEXT4 ; Check 1st Column
			MOV R0,#0F3H
			MOV R1,#00H
		NEXT4: JB P1.2, NEXT5 ; Check 2nd Column
			MOV R0,#0F4H
			MOV R1,#00H
		NEXT5: JB P1.1, NEXT6 ; Check 3rd Column
			MOV R0,#0F5H
			MOV R1,#00H
		NEXT6: JB P1.0, NEXTB ; Check 4th Column
			MOV R0,#0F6H
			MOV R1,#00H
		NEXTB: SETB P1.6
			CLR P1.5 ; Send signal to 3rd Row
			JB P1.3,NEXT7 ; Check 1st Column
			MOV R0,#0F7H
			MOV R1,#00H
		NEXT7: JB P1.2, NEXT8 ; Check 2nd Column
			MOV R0,#0F8H
			MOV R1,#00H
		NEXT8: JB P1.1, NEXT9 ; Check 3rd Column
			MOV R0,#0F9H
			MOV R1,#00H
		NEXT9: JB P1.0, NEXTC ; Check 4th Column
			MOV R0,#0FAH
			MOV R1,#00H
		NEXTC: SETB P1.5
			CLR P1.4 ; Send signal to 4th Row
			JB P1.3,NEXTs ; Check 1st Column
			MOV R0,#0FBH
			MOV R1,#00H
		NEXTs: JB P1.2, NEXT0 ; Check 2nd Column
			MOV R0,#0FCH
			MOV R1,#00H
		NEXT0: JB P1.1, NEXTh ; Check 3rd Column
			MOV R0,#0FDH
			MOV R1,#00H
		NEXTh: JB P1.0, AGAIN ; Check 4th Column
			MOV R0,#0FEH
			MOV R1,#00H
			LJMP AGAIN
END