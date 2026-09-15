/* EE 390 example (C / SDCC) - LCD welcome message
 *
 * Initialises the LCD1602 and prints "WELCOME!". Same steps as LCD_Welcom.asm.
 * Wiring: data P0, RS P2.6, R/W P2.5, E P2.7.
 *
 * Build: build lcd_welcome
 */
#include <8052.h>

#define LCD_DATA P0
#define LCD_RS   P2_6       /* 0 = command, 1 = character */
#define LCD_RW   P2_5       /* 0 = write */
#define LCD_E    P2_7       /* data is taken on the falling edge */

void delay_ms(unsigned char ms)
{
    TMOD = (TMOD & 0xF0) | 0x01;    /* Timer 0 mode 1, keep Timer 1 settings */
    while (ms--) {
        TH0 = 0xFC;                 /* 1 ms */
        TL0 = 0x67;
        TR0 = 1;
        while (!TF0)
            ;
        TR0 = 0;
        TF0 = 0;
    }
}

/* Put one byte on the LCD bus and pulse E. */
void lcd_write(unsigned char value, unsigned char is_char)
{
    LCD_RS = is_char;
    LCD_DATA = value;
    LCD_E = 1;
    delay_ms(5);                    /* give the LCD time to process it */
    LCD_E = 0;
}

void lcd_init(void)
{
    LCD_RW = 0;
    lcd_write(0x38, 0);             /* 2 lines, 5x7 characters */
    lcd_write(0x0F, 0);             /* display on, cursor blinking */
    lcd_write(0x01, 0);             /* clear the screen */
    lcd_write(0x80, 0);             /* cursor to line 1, column 1 */
}

void lcd_print(const char *text)
{
    while (*text)
        lcd_write(*text++, 1);
}

void main(void)
{
    lcd_init();
    lcd_print("WELCOME!");
    for (;;)
        ;
}
