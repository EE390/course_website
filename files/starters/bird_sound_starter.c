/* ============================================================================
 * EE 390 - Mini Project 3: Bird Song Synthesizer in C            STARTER TEMPLATE
 * Board   : Puzhong 51 A2 (STC89C52RC, 11.0592 MHz, 12T mode)
 * Compiler: SDCC       build bird_song      (or: sdcc -mmcs51 bird_song.c
 *                                                packihx bird_song.ihx > bird_song.hex)
 *
 * Name(s) :
 * Date    :
 *
 * This template only gives pin names, the interrupt declaration and suggested
 * function headings. Replace every TODO with your own code. You may add, rename
 * or remove functions as long as the program meets requirements R1-R9 on the
 * project page.
 * ========================================================================== */

#include <8052.h>

/* ------------------------------------------------------------------ pins -- */
#define BUZZER  P2_5        /* passive buzzer (PNP driver) */
#define LED1    P2_0        /* LEDs D1..D4 (active LOW) */
#define LED2    P2_1
#define LED3    P2_2
#define LED4    P2_3
#define K1      P3_1        /* push buttons (read 0 when pressed) */
#define K2      P3_0
#define K3      P3_2
#define K4      P3_3

/* ------------------------------------------------------- shared variables -- */
/* TODO: declare the variables shared by main code and the Timer 0 ISR.
 *       Think about 'volatile' and about how you update them safely. */

/* The ISR prototype must be visible in the file that contains main(). */
void timer0_isr(void) __interrupt(1);

/* ---------------------------------------------------------- sound tables -- */
/* Document your table format here (pitch encoding, rest code, end marker).
 * Generate the data with a spreadsheet or script (see the project page).
 * Tables must be stored in flash, not RAM (R9).
 *
 * Format:
 */
const unsigned char __code BIRD1[] = { 0 /* TODO: K1 - bird 1 */ };
const unsigned char __code BIRD2[] = { 0 /* TODO: K2 - bird 2 */ };
const unsigned char __code BIRD3[] = { 0 /* TODO: K3 - bird 3 */ };
const unsigned char __code BIRD4[] = { 0 /* TODO: K4 - bird 4 */ };

/* ------------------------------------------------------------- functions -- */

/* Timer 0 overflow - runs once every half period of the tone. */
void timer0_isr(void) __interrupt(1)
{
    /* TODO: reload Timer 0 and toggle the buzzer */
}

/* Wait exactly 5 ms using Timer 1. */
void delay_5ms(void)
{
    /* TODO */
}

/* Play the call stored in the table 'call'. */
void play_call(const unsigned char __code *call)
{
    /* TODO: step through the table: set the pitch (or silence for a rest),
     *       hold it for its length using delay_5ms(), stop at the end marker */
    (void)call;
}

void main(void)
{
    /* TODO: initialise ports, timers (TMOD) and interrupts */

    for (;;) {
        /* TODO: detect a new press of K1..K4, light the matching LED,
         *       play the matching call, then turn the LED off (R1-R3) */
    }
}
