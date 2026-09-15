/* EE 390 example (C / SDCC) - Buttons with output loads
 *
 * Pressing K1..K4 switches on exactly one of the four outputs O1..O4 (P1.0..P1.3).
 * Same behaviour as Simple_Buttons_with_Output_Loads.asm.
 *
 * Build: build buttons_outputs      (or sdcc -mmcs51 buttons_outputs.c)
 */
#include <8052.h>

#define K1 P3_1     /* buttons read 0 when pressed */
#define K2 P3_0
#define K3 P3_2
#define K4 P3_3

void main(void)
{
    P1 = 0x00;      /* all outputs off */
    P3 = 0xFF;      /* write 1s so P3 pins can be used as inputs */

    for (;;) {
        if (!K1) P1 = 0x01;     /* O1 on, others off */
        if (!K2) P1 = 0x02;     /* O2 */
        if (!K3) P1 = 0x04;     /* O3 */
        if (!K4) P1 = 0x08;     /* O4 */
    }
}
