@echo off
rem ==========================================================================
rem  EE 390 - build a C program for the 8051 board with SDCC
rem
rem  Usage (in Command Prompt, in the folder with your .c file):
rem      build main          compiles main.c  ->  main.hex
rem
rem  Then open main.hex in STC-ISP and program the board as usual.
rem ==========================================================================
if "%~1"=="" (
    echo Usage: build filename   ^(without .c^)
    exit /b 1
)
set NAME=%~n1
if not exist "%NAME%.c" (
    echo Cannot find %NAME%.c in this folder.
    exit /b 1
)
sdcc -mmcs51 "%NAME%.c"
if errorlevel 1 (
    echo.
    echo *** Compile failed - fix the errors above. ***
    exit /b 1
)
packihx "%NAME%.ihx" > "%NAME%.hex"
echo.
echo Created %NAME%.hex  ^(code size is in %NAME%.mem^)
