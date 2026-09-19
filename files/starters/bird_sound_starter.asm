; ==============================================================================
; EE 390 - Mini Project 2: Bird Song Synthesizer                STARTER TEMPLATE
; Board : Puzhong 51 A2 (STC89C52RC, 11.0592 MHz, 12T mode)
;
; Name(s)  :
; Date     :
;
; This template only gives pin names, the vector layout and suggested routine
; headings. Replace every TODO with your own code. You may add, rename or remove
; routines as long as the program meets requirements R1-R8 on the project page.
; ==============================================================================

; ---------------------------------------------------------------- pins --------
BUZZER   EQU P2.5   ; passive buzzer (PNP driver)
LED1     EQU P2.0   ; LEDs D1..D4 (active LOW)
LED2     EQU P2.1
LED3     EQU P2.2
LED4     EQU P2.3
K1       EQU P3.1   ; push buttons (read 0 when pressed)
K2       EQU P3.0
K3       EQU P3.2
K4       EQU P3.3

; ---------------------------------------------------------------- RAM ---------
; TODO: reserve RAM addresses for any variables shared by the main program and
;       the Timer 0 ISR, e.g.   PITCH_H EQU 30H

; ---------------------------------------------------------------- vectors -----
ORG 0000H
	LJMP MAIN
ORG 000BH           ; Timer 0 interrupt vector
	LJMP T0_ISR

ORG 0030H
; ------------------------------------------------------------------------------
; MAIN: initialise the hardware, then loop forever checking the buttons.
; ------------------------------------------------------------------------------
MAIN:
	; TODO: initialise stack pointer, ports, timers (TMOD) and interrupts (IE)

LOOP:
	; TODO: detect a new press of K1..K4, light the matching LED,
	;       play the matching call, then turn the LED off (R1-R3)
	SJMP LOOP

; ------------------------------------------------------------------------------
; PLAY_CALL: play the sound table whose address is in DPTR.
; ------------------------------------------------------------------------------
PLAY_CALL:
	; TODO: step through the table: set the pitch (or silence for a rest),
	;       hold it for its length using DELAY_5MS, stop at the end marker
	RET

; ------------------------------------------------------------------------------
; T0_ISR: Timer 0 overflow - runs once every half period of the tone.
; ------------------------------------------------------------------------------
T0_ISR:
	; TODO: reload Timer 0 and toggle the buzzer
	RETI

; ------------------------------------------------------------------------------
; DELAY_5MS: wait exactly 5 ms using Timer 1.
; ------------------------------------------------------------------------------
DELAY_5MS:
	; TODO
	RET

; ==============================================================================
; SOUND TABLES
; Document your table format here (pitch encoding, rest code, end marker).
; Generate the table data with a spreadsheet or script (see the project page).
; ==============================================================================
; Format:
;

CHEEP:              ; K1 - house sparrow "cheep"
	; TODO

CARDINAL:           ; K2 - northern cardinal "cheer-cheer-cheer"
	; TODO

TRILL:              ; K3 - chipping sparrow trill
	; TODO

CHICKADEE:          ; K4 - black-capped chickadee "fee-bee"
	; TODO

END
