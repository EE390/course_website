/* EE 390 example (C / SDCC) - LED blink with a Timer 0 interrupt
 *
 * Timer 0 overflows every 50 ms and its interrupt counts the overflows.
 * Every 10 overflows (500 ms) it toggles LED D1. The main loop is free to do
 * other work - here it just mirrors button K1 onto LED D8.
 *
 * Build: build timer_interrupt_blink
 */
#include <8052.h>

#define LED_BLINK  P2_0     /* D1 */
#define LED_BUTTON P2_7     /* D8 */
#define K1         P3_1

volatile unsigned char ticks;           /* changed inside the ISR */

/* The ISR prototype must be visible in the file that contains main(). */
void timer0_isr(void) __interrupt(1);

/* 50 ms = 46080 counts, 65536 - 46080 = 4C00H */
void timer0_isr(void) __interrupt(1)
{
    TH0 = 0x4C;                         /* mode 1: reload on every overflow */
    TL0 = 0x00;
    if (++ticks == 10) {
        ticks = 0;
        LED_BLINK = !LED_BLINK;
    }
}

void main(void)
{
    TMOD = 0x01;                        /* Timer 0 mode 1 */
    TH0 = 0x4C;
    TL0 = 0x00;
    ET0 = 1;                            /* enable the Timer 0 interrupt */
    EA = 1;                             /* enable interrupts globally */
    TR0 = 1;                            /* start the timer */

    for (;;)
        LED_BUTTON = K1;                /* LED D8 lights while K1 is pressed */
}
