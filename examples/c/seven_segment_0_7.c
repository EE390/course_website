/* EE 390 example (C / SDCC) - 7-segment display: 0..7
 *
 * Shows the digits 0..7 across the eight 7-segment digits by multiplexing:
 * select one digit (P2.2..P2.4 via the 74HC138), output its segments on P0,
 * wait 1 ms, move on. Same idea as Simple_Seven_Segment_Display.asm.
 *
 * Build: build seven_segment_0_7
 */
#include <8052.h>

/* Segment patterns for 0..9 (common cathode, 1 = segment on). 'const' puts the
 * table in flash, so it uses no RAM. */
const unsigned char SEGMENTS[] = { 0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F };

/* 1 ms delay with Timer 0 in mode 1: 921 counts, 65536 - 921 = FC67H */
void delay_1ms(void)
{
    TH0 = 0xFC;
    TL0 = 0x67;
    TR0 = 1;
    while (!TF0)
        ;
    TR0 = 0;
    TF0 = 0;
}

void main(void)
{
    unsigned char digit;

    TMOD = 0x01;                    /* Timer 0 mode 1 */

    for (;;) {
        for (digit = 0; digit < 8; digit++) {
            P0 = 0x00;                                  /* blank while switching digits */
            P2 = (P2 & 0xE3) | (digit << 2);            /* change only P2.2..P2.4 */
            P0 = SEGMENTS[digit];
            delay_1ms();
        }
    }
}
