/* EE 390 example (C / SDCC) - Serial port echo
 *
 * Sends a greeting at 9600 baud (8N1), then sends back every character it
 * receives, converted to upper case. Open a serial terminal on the board's COM
 * port (e.g. the USB-CDC/UART Helper tab in STC-ISP) to try it.
 *
 * Build: build serial_echo
 */
#include <8052.h>

void uart_init(void)
{
    TMOD = (TMOD & 0x0F) | 0x20;    /* Timer 1 mode 2 = baud rate generator */
    TH1 = 0xFD;                     /* 9600 baud at 11.0592 MHz */
    SCON = 0x50;                    /* mode 1 (8N1), receiver enabled */
    TR1 = 1;
}

void uart_send(unsigned char c)
{
    SBUF = c;
    while (!TI)                     /* wait until the byte has been sent */
        ;
    TI = 0;
}

unsigned char uart_receive(void)
{
    while (!RI)                     /* wait for a byte */
        ;
    RI = 0;
    return SBUF;
}

void uart_print(const char *text)
{
    while (*text)
        uart_send(*text++);
}

void main(void)
{
    unsigned char c;

    uart_init();
    uart_print("Hello from the 8051! Type something:\r\n");

    for (;;) {
        c = uart_receive();
        if (c >= 'a' && c <= 'z')
            c -= 'a' - 'A';         /* to upper case */
        uart_send(c);
    }
}
