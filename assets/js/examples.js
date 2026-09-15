// EE 390 — code examples catalogue and viewer (assembly and C).
//
// TO ADD AN EXAMPLE: put the file in /examples (assembly .asm) or /examples/c (C .c)
// and add an entry below.
//   file:     file name (also used as the #link anchor, so keep names unique)
//   lang:     "asm" or "c"
//   title:    short human-readable name
//   category: one of the CATEGORIES keys
//   summary:  one or two sentences on what the program does
//   uses:     board modules / concepts it demonstrates

var CATEGORIES = {
  basics: "Basics",
  displays: "Displays",
  comms: "Communication",
  sensors: "Sensors & peripherals"
};

var EXAMPLES = [
  {
    file: "Simple_Buttons_with_Output_Loads.asm",
    lang: "asm",
    title: "Buttons with Output Loads",
    category: "basics",
    summary: "Pressing K1–K4 switches on exactly one of four outputs O1–O4 on P1.0–P1.3.",
    uses: ["Push buttons", "P1 outputs", "JB polling"]
  },
  {
    file: "Matrix_4x4_Keypad_with_Buzzer.asm",
    lang: "asm",
    title: "4×4 Keypad Piano",
    category: "basics",
    summary: "Each key loads a different Timer 0 reload value, so the passive buzzer plays a different tone per key.",
    uses: ["Matrix keypad", "Buzzer", "Timer 0 interrupt"]
  },
  {
    file: "Simple_Seven_Segment_Display.asm",
    lang: "asm",
    title: "7-Segment Display: 0–7",
    category: "displays",
    summary: "Shows the digits 0–7 across the eight 7-segment digits using multiplexing and a ROM look-up table.",
    uses: ["7-segment", "MOVC look-up table", "Multiplexing"]
  },
  {
    file: "CCC.asm",
    lang: "asm",
    title: "7-Segment Display: Walking Hex 0–F",
    category: "displays",
    summary: "Copies the segment codes for 0–F from ROM into RAM 20H–2FH, then shows each hex digit in turn while stepping across digit positions.",
    uses: ["7-segment", "ROM → RAM copy", "Indirect addressing"]
  },
  {
    file: "LCD_Welcom.asm",
    lang: "asm",
    title: "LCD Welcome Message",
    category: "displays",
    summary: "Initialises the LCD1602 and prints “WELCOME!” from a zero-terminated string in ROM.",
    uses: ["LCD1602", "DPTR strings", "Timer delay"]
  },
  {
    file: "LED_8x8_Matrix.asm",
    lang: "asm",
    title: "8×8 LED Matrix Animation",
    category: "displays",
    summary: "Plays a sequence of frames on the LED matrix — columns from P0, rows shifted out through the 74HC595.",
    uses: ["LED matrix", "74HC595 shift register", "Frame tables"]
  },
  {
    file: "Serial_Communication.asm",
    lang: "asm",
    title: "Serial Terminal: Read/Write RAM",
    category: "comms",
    summary: "Menu over UART at 9600 baud: type R or W, then a hex address (and data) to read or write internal RAM from a PC terminal.",
    uses: ["UART", "ASCII ↔ hex", "Polling TI/RI"]
  },
  {
    file: "EEPROM_to_LCD.asm",
    lang: "asm",
    title: "I²C EEPROM Read/Write",
    category: "comms",
    summary: "Uses the keypad to choose read or write, enter an address and data, and stores it in the AT24C02 EEPROM — results shown on the LCD.",
    uses: ["AT24C02", "Bit-banged I²C", "Keypad", "LCD1602"]
  },
  {
    file: "IR_to_7_Segment_Display.asm",
    lang: "asm",
    title: "IR Remote Decoder",
    category: "comms",
    summary: "Decodes the 4-byte NEC code from an IR remote on the INT0 interrupt and shows it on the 7-segment display.",
    uses: ["IR receiver", "External interrupt", "Pulse timing"]
  },
  {
    file: "ADC_Read_to_LCD.asm",
    lang: "asm",
    title: "ADC Reading on LCD",
    category: "sensors",
    summary: "Reads the 12-bit XPT2046 ADC, converts the value to decimal and prints it on the LCD.",
    uses: ["XPT2046 ADC", "SPI", "Hex → decimal", "LCD1602"]
  },
  {
    file: "ADC_Read_to_Seven_Segment_Display.asm",
    lang: "asm",
    title: "ADC Reading on 7-Segment",
    category: "sensors",
    summary: "Same ADC read as above, displayed as a 4-digit decimal number on the 7-segment display.",
    uses: ["XPT2046 ADC", "SPI", "7-segment"]
  },
  {
    file: "Temperature_Sensor_7_Segment_Display_DS18B20.asm",
    lang: "asm",
    title: "DS18B20 Thermometer",
    category: "sensors",
    summary: "Reads temperature from the DS18B20 over 1-Wire and shows it with decimal places on the 7-segment display.",
    uses: ["DS18B20", "1-Wire timing", "7-segment"]
  },
  {
    file: "DS1302_Date_Time_to_LCD.asm",
    lang: "asm",
    title: "Real-Time Clock on LCD",
    category: "sensors",
    summary: "Sets the date and time in the DS1302 RTC, then continuously reads it back and shows it on the LCD.",
    uses: ["DS1302 RTC", "3-wire serial", "BCD", "LCD1602"]
  },
  // ---- C (SDCC) versions ----
  {
    file: "buttons_outputs.c",
    lang: "c",
    title: "Buttons with Output Loads",
    category: "basics",
    summary: "C version of the assembly example: K1–K4 each switch on one of the outputs O1–O4 on P1.",
    uses: ["Push buttons", "P1 outputs", "sbit names"]
  },
  {
    file: "timer_interrupt_blink.c",
    lang: "c",
    title: "LED Blink with a Timer Interrupt",
    category: "basics",
    summary: "Timer 0 interrupts every 50 ms; the ISR toggles LED D1 every 500 ms while the main loop keeps running.",
    uses: ["Timer 0 interrupt", "__interrupt", "volatile"]
  },
  {
    file: "seven_segment_0_7.c",
    lang: "c",
    title: "7-Segment Display: 0–7",
    category: "displays",
    summary: "C version: multiplexes the digits 0–7 across the display using a const segment table stored in flash.",
    uses: ["7-segment", "const table", "Bit masks"]
  },
  {
    file: "lcd_welcome.c",
    lang: "c",
    title: "LCD Welcome Message",
    category: "displays",
    summary: "C version: initialises the LCD1602 and prints “WELCOME!” using small reusable functions.",
    uses: ["LCD1602", "Functions", "Strings"]
  },
  {
    file: "serial_echo.c",
    lang: "c",
    title: "Serial Echo",
    category: "comms",
    summary: "Greets you at 9600 baud, then echoes every character you type back in upper case.",
    uses: ["UART", "Polling TI/RI", "Strings"]
  }
];

// ---------------------------------------------------------------------------

(function () {
  var grid = document.getElementById("example-grid");
  var catBar = document.getElementById("example-filters");
  var langBar = document.getElementById("language-filters");
  var viewer = document.getElementById("code-viewer");
  if (!grid || !viewer) return;

  var viewerTitle = viewer.querySelector("h3");
  var viewerCode = viewer.querySelector("code");
  var btnCopy = document.getElementById("btn-copy");
  var btnDownload = document.getElementById("btn-download");
  var btnRaw = document.getElementById("btn-raw");
  var currentText = "";
  var filter = { lang: "all", category: "all" };

  function pathFor(ex) { return (ex.lang === "c" ? "examples/c/" : "examples/") + ex.file; }
  function anchorFor(ex) { return ex.file.replace(/\.(asm|c)$/i, ""); }
  function badge(ex) {
    return '<span class="lang-badge lang-' + ex.lang + '">' + (ex.lang === "c" ? "C" : "ASM") + "</span>";
  }

  // --- Catalogue ------------------------------------------------------------

  function renderGrid() {
    grid.innerHTML = "";
    var shown = 0;
    EXAMPLES.forEach(function (ex) {
      if (filter.lang !== "all" && ex.lang !== filter.lang) return;
      if (filter.category !== "all" && ex.category !== filter.category) return;
      shown++;
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="card-head"><div class="eyebrow">' + CATEGORIES[ex.category] + "</div>" + badge(ex) + "</div>" +
        "<h3></h3><p></p>" +
        '<div class="tags"></div>' +
        '<div class="btn-row">' +
        '<button class="btn btn-sm btn-primary" type="button">View code</button>' +
        '<a class="btn btn-sm" download>Download</a>' +
        "</div>";
      card.querySelector("h3").textContent = ex.title;
      card.querySelector("p").textContent = ex.summary;
      var tags = card.querySelector(".tags");
      ex.uses.forEach(function (u) {
        var t = document.createElement("span");
        t.className = "tag";
        t.textContent = u;
        tags.appendChild(t);
      });
      card.querySelector("button").addEventListener("click", function () {
        history.replaceState(null, "", "#" + anchorFor(ex));
        openExample(ex, true);
      });
      card.querySelector("a").href = pathFor(ex);
      grid.appendChild(card);
    });
    if (!shown) grid.innerHTML = '<p class="tba">No examples match these filters yet.</p>';
  }

  function makeFilter(bar, options, key) {
    if (!bar) return;
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-sm";
      b.textContent = o[1];
      b.setAttribute("aria-pressed", o[0] === filter[key] ? "true" : "false");
      b.addEventListener("click", function () {
        bar.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        filter[key] = o[0];
        renderGrid();
      });
      bar.appendChild(b);
    });
  }

  makeFilter(langBar, [["all", "All languages"], ["asm", "Assembly"], ["c", "C"]], "lang");
  makeFilter(catBar, [["all", "All topics"]].concat(Object.keys(CATEGORIES).map(function (k) { return [k, CATEGORIES[k]]; })), "category");

  // --- Viewer ---------------------------------------------------------------

  function openExample(ex, scroll) {
    viewer.hidden = false;
    viewerTitle.innerHTML = "";
    viewerTitle.appendChild(document.createTextNode(ex.file + " "));
    viewerTitle.insertAdjacentHTML("beforeend", badge(ex));
    viewerCode.textContent = "Loading…";
    btnDownload.href = pathFor(ex);
    btnDownload.setAttribute("download", ex.file);
    btnRaw.href = pathFor(ex);
    if (scroll) viewer.scrollIntoView({ behavior: "smooth", block: "start" });

    fetch(pathFor(ex))
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then(function (buf) {
        // The .asm files were saved by Windows editors (Windows-1252); C files are plain ASCII.
        currentText = new TextDecoder("windows-1252").decode(buf).replace(/\r\n?/g, "\n").replace(/\n+$/, "");
        viewerCode.innerHTML = ex.lang === "c" ? highlightC(currentText) : highlightAsm(currentText);
      })
      .catch(function () {
        currentText = "";
        viewerCode.textContent = "Could not load the file. Use the Download button instead.";
      });
  }

  btnCopy.addEventListener("click", function () {
    if (!currentText || !navigator.clipboard) return;
    navigator.clipboard.writeText(currentText).then(function () {
      var old = btnCopy.textContent;
      btnCopy.textContent = "Copied ✓";
      setTimeout(function () { btnCopy.textContent = old; }, 1500);
    });
  });

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function span(cls, s) { return '<span class="tok-' + cls + '">' + esc(s) + "</span>"; }

  // --- 8051 assembly highlighter -------------------------------------------

  var MNEMONICS = "ACALL ADD ADDC AJMP AND ANL CALL CJNE CLR CPL DA DEC DIV DJNZ INC JB JBC JC JMP JNB JNC JNZ JZ LCALL LJMP MOV MOVC MOVX MUL NOP ORL POP PUSH RET RETI RL RLC RR RRC SETB SJMP SUBB SWAP XCH XRL".split(" ");
  var DIRECTIVES = "ORG EQU DB DW DS END BIT DATA CODE SET USING".split(" ");
  var REGISTERS = "A B C AB DPTR DPL DPH SP PSW ACC R0 R1 R2 R3 R4 R5 R6 R7 P0 P1 P2 P3 TMOD TCON TH0 TL0 TH1 TL1 TF0 TF1 TR0 TR1 SCON SBUF TI RI IE IP PCON EA ET0 ET1 EX0 EX1 ES IT0 IT1".split(" ");

  function asmCode(code) {
    var re = /('[^']*'|"[^"]*")|(^\s*[A-Za-z_][\w]*:)|(#?\b(?:[0-9][0-9A-Fa-f]*[Hh]|[01]+[Bb]|[0-9]+[Dd]?)\b)|([A-Za-z_][\w]*(?:\.[0-7])?)|([\s\S])/g;
    var out = "", m;
    while ((m = re.exec(code)) !== null) {
      if (m[1]) out += span("string", m[1]);
      else if (m[2]) out += span("label", m[2]);
      else if (m[3]) out += span("number", m[3]);
      else if (m[4]) {
        var w = m[4].toUpperCase(), base = w.split(".")[0];
        if (MNEMONICS.indexOf(w) >= 0) out += span("mnemonic", m[4]);
        else if (DIRECTIVES.indexOf(w) >= 0) out += span("directive", m[4]);
        else if (REGISTERS.indexOf(base) >= 0) out += span("register", m[4]);
        else out += esc(m[4]);
      } else out += esc(m[5]);
    }
    return out;
  }

  function highlightAsm(text) {
    return text.split("\n").map(function (line) {
      var inQuote = null, cut = -1;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQuote) { if (ch === inQuote) inQuote = null; }
        else if (ch === "'" || ch === '"') inQuote = ch;
        else if (ch === ";") { cut = i; break; }
      }
      var code = cut >= 0 ? line.slice(0, cut) : line;
      var comment = cut >= 0 ? line.slice(cut) : "";
      return '<span class="ln">' + asmCode(code) + (comment ? span("comment", comment) : "") + "</span>";
    }).join("");
  }

  // --- C highlighter (SDCC) -------------------------------------------------

  var C_KEYWORDS = "void char short int long float double signed unsigned const volatile static extern register auto if else for while do switch case default break continue return goto struct union enum typedef sizeof __interrupt __using __code __data __idata __xdata __bit __sbit __sfr __sfr16 __at __critical __reentrant __naked".split(" ");
  var C_SFRS = /^(P[0-3](_[0-7])?|TMOD|TCON|TH[01]|TL[01]|TF[01]|TR[01]|SCON|SBUF|TI|RI|IE|IP|EA|ET[012]|EX[01]|ES|IT[01]|PCON|PSW|ACC|B|SP|DPL|DPH)$/;

  function cCode(code) {
    var re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b0[xX][0-9A-Fa-f]+\b|\b\d+[uUlL]*\b)|([A-Za-z_]\w*)|([\s\S])/g;
    var out = "", m;
    while ((m = re.exec(code)) !== null) {
      if (m[1]) out += span("string", m[1]);
      else if (m[2]) out += span("number", m[2]);
      else if (m[3]) {
        if (C_KEYWORDS.indexOf(m[3]) >= 0) out += span("mnemonic", m[3]);
        else if (C_SFRS.test(m[3])) out += span("register", m[3]);
        else out += esc(m[3]);
      } else out += esc(m[4]);
    }
    return out;
  }

  function highlightC(text) {
    var inBlock = false;
    return text.split("\n").map(function (line) {
      var html = "", rest = line;
      if (/^\s*#/.test(line) && !inBlock) {
        return '<span class="ln">' + span("directive", line) + "</span>";
      }
      while (rest.length) {
        if (inBlock) {
          var end = rest.indexOf("*/");
          if (end < 0) { html += span("comment", rest); rest = ""; }
          else { html += span("comment", rest.slice(0, end + 2)); rest = rest.slice(end + 2); inBlock = false; }
          continue;
        }
        var b = rest.indexOf("/*"), l = rest.indexOf("//");
        // ignore comment markers inside string literals (simple check: count quotes before the marker)
        var first = [b, l].filter(function (x) { return x >= 0 && ((rest.slice(0, x).match(/"/g) || []).length % 2 === 0); });
        if (!first.length) { html += cCode(rest); rest = ""; continue; }
        var at = Math.min.apply(null, first);
        html += cCode(rest.slice(0, at));
        if (at === l) { html += span("comment", rest.slice(at)); rest = ""; }
        else { inBlock = true; rest = rest.slice(at); var e2 = rest.indexOf("*/", 2);
          if (e2 >= 0) { html += span("comment", rest.slice(0, e2 + 2)); rest = rest.slice(e2 + 2); inBlock = false; }
          else { html += span("comment", rest); rest = ""; } }
      }
      return '<span class="ln">' + html + "</span>";
    }).join("");
  }

  // --- Init -----------------------------------------------------------------

  renderGrid();

  function openFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var ex = EXAMPLES.filter(function (e) { return anchorFor(e) === id; })[0];
    if (ex) openExample(ex, true);
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
