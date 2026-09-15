ORG 0000H
K1 EQU P3.1 ; Button K1
K2 EQU P3.0 ; Button K2
K3 EQU P3.2 ; Button K3
K4 EQU P3.3 ; Button K4
O1 EQU P1.0 ; Output External Load O1
O2 EQU P1.1 ; Output External Load O2
O3 EQU P1.2 ; Output External Load O3
O4 EQU P1.3 ; Output External Load O4

CLR A
MOV P1,A ; P1 as Output
MOV A,#0FFH
MOV P3,A ; P3 as Input
AGAIN:
	 JB K1, Next_K2 
	 SETB O1 ; O1 is ON
	 CLR  O2 ; O2 is OFF
	 CLR  O3 ; O3 is OFF
	 CLR  O4 ; O4 is OFF
Next_K2: JB K2, Next_K3
	 CLR  O1 ; O1 is OFF
	 SETB O2 ; O2 is ON
	 CLR  O3 ; O3 is OFF
	 CLR  O4 ; O4 is OFF
Next_K3: JB K3, Next_K4 
	 CLR  O1 ; O1 is OFF
	 CLR  O2 ; O2 is OFF
	 SETB O3 ; O3 is ON
	 CLR  O4 ; O4 is OFF
Next_K4: JB K4, Again
 	 CLR  O1 ; O1 is OFF
	 CLR  O2 ; O2 is OFF
	 CLR  O3 ; O3 is OFF
	 SETB O4 ; O4 is ON
SJMP AGAIN

END