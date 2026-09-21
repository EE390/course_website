/* The EE 390 lab simulator page: editor, run loop, virtual board.
 *
 * Pin map follows the real Puzhong 51 A2 kit (see lab-kit.html):
 *   D1..D8   P2.0-P2.7, active LOW
 *   O1..O6   P1.0-P1.5 output loads, active HIGH
 *   K1..K4   P3.1, P3.0, P3.2, P3.3, read 0 while pressed (K3/K4 are INT0/INT1)
 *   keypad   rows P1.7-P1.4, columns P1.3-P1.0, a held key ties its column to its row
 *   buzzer   P2.5 (shared with LED D6 on the real board)
 *   7-seg    segments on P0 (1 = on), digit select P2.2-P2.4, digit n -> P2 = n*4
 *   8x8 LED  columns on P0 (active LOW), rows via a 74HC595:
 *            SER P3.4, RCLK P3.5, SRCLK P3.6
 *
 * The display and the LEDs are multiplexed far faster than the screen refreshes,
 * so reading the ports once a frame shows aliasing noise rather than a picture.
 * Every lamp is measured by how long it was actually lit instead, replayed from
 * the port writes the processor made. See the note above PERSIST_S.
 */
(function () {
  "use strict";

  var Asm = window.EE390Asm, EmuLib = window.EE390Emu;
  if (!Asm || !EmuLib) return;
  var A = EmuLib.ADDR;

  var DEFAULT_SOURCE = [
    "; Press K1 to light D1. Press Run, then hold K1.",
    "; Change it, press Run again, and see what happens.",
    "",
    "K1      EQU P3.1",
    "LED1    EQU P2.0",
    "",
    "        ORG 0000H",
    "",
    "MAIN:   JB   K1, OFF      ; K1 reads 1 when it is not pressed",
    "        CLR  LED1         ; LOW turns the LED on",
    "        SJMP MAIN",
    "OFF:    SETB LED1",
    "        SJMP MAIN",
    "",
    "        END"
  ].join("\n");

  var EXAMPLES = [
    "Simple_Buttons_with_Output_Loads",
    "Simple_Seven_Segment_Display",
    "CCC",
    "Matrix_4x4_Keypad_with_Buzzer",
    "LED_8x8_Matrix"
  ];

  var el = {};
  ["run", "step", "reset", "speed", "examples", "download", "sound", "source", "gutter",
   "errors", "editor-status", "clock", "leds", "loads", "segments", "matrix", "keypad",
   "regs", "buzzer", "buzz-text"]
    .forEach(function (id) { el[id] = document.getElementById(id); });

  var emu = null, built = null, running = false, rafId = null, lastFrame = 0;
  var dirty = true;                 // source edited since the last assemble
  var pressed = {};                 // P3 bit -> true while held
  var keyDown = {};                 // "row,col" -> true while a keypad key is held
  var audio = null, osc = null, gain = null;

  /* ------------------------------------------------------------------ board */

  var SEG_DIGITS = 8;
  var segEls = [], ledEls = [], loadEls = [], pixEls = [];

  var KEYPAD = [["1", "2", "3", "A"], ["4", "5", "6", "B"],
                ["7", "8", "9", "C"], ["*", "0", "#", "D"]];

  function buildBoard() {
    var i, r, c;
    for (i = 0; i < SEG_DIGITS; i++) {
      var d = document.createElement("div");
      d.className = "seg-digit";
      d.innerHTML =
        '<svg viewBox="0 0 40 68" aria-hidden="true">' +
        '<polygon class="s s-a" points="8,4 32,4 28,8 12,8"/>' +
        '<polygon class="s s-f" points="6,6 10,10 10,28 6,32"/>' +
        '<polygon class="s s-b" points="34,6 34,32 30,28 30,10"/>' +
        '<polygon class="s s-g" points="8,34 32,34 28,38 12,38"/>' +
        '<polygon class="s s-e" points="6,36 10,40 10,58 6,62"/>' +
        '<polygon class="s s-c" points="34,36 34,62 30,58 30,40"/>' +
        '<polygon class="s s-d" points="8,64 32,64 28,60 12,60"/>' +
        '<circle class="s s-dp" cx="37" cy="63" r="2.5"/>' +
        "</svg>";
      el.segments.appendChild(d);
      segEls.push(d.querySelectorAll(".s"));
    }
    for (i = 0; i < 8; i++) {
      var w = document.createElement("div");
      w.className = "led-cell";
      w.innerHTML = '<span class="led"><span class="led-glow"></span></span>' +
        '<span class="led-name">D' + (i + 1) + "</span>";
      el.leds.appendChild(w);
      ledEls.push(w.querySelector(".led-glow"));
    }
    for (i = 0; i < 6; i++) {
      var o = document.createElement("div");
      o.className = "led-cell";
      o.innerHTML = '<span class="led led-load"><span class="led-glow"></span></span>' +
        '<span class="led-name">O' + (i + 1) + "</span>";
      el.loads.appendChild(o);
      loadEls.push(o.querySelector(".led-glow"));
    }
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        var p = document.createElement("span");
        p.className = "pix";
        el.matrix.appendChild(p);
        pixEls.push(p);
      }
    }
    for (r = 0; r < 4; r++) {
      for (c = 0; c < 4; c++) {
        var k = document.createElement("button");
        k.type = "button";
        k.className = "padbtn";
        k.setAttribute("data-row", r);
        k.setAttribute("data-col", c);
        k.textContent = KEYPAD[r][c];
        el.keypad.appendChild(k);
        wirePad(k, r, c);      // these keys only exist now, so bind them here
      }
    }
  }

  function wirePad(node, row, col) {
    holdable(node,
      function () { padPress(row, col, true); },
      function () { padPress(row, col, false); });
  }

  /* --------------------------------------------------- what the board showed */

  /* A 74HC595 shifting on SRCLK and latching on RCLK, driving the matrix rows. */
  var shift595 = 0, latch595 = 0, prevP3 = 0xFF;

  function clock595(p3) {
    var wasSr = (prevP3 >> 6) & 1, isSr = (p3 >> 6) & 1;
    var wasRc = (prevP3 >> 5) & 1, isRc = (p3 >> 5) & 1;
    if (!wasSr && isSr) shift595 = ((shift595 << 1) | ((p3 >> 4) & 1)) & 0xFF;
    if (!wasRc && isRc) latch595 = shift595;
    prevP3 = p3;
  }

  /* Two different problems, so two ways of measuring how long a lamp was lit.
   *
   * The scanned display (7-segment digits and the matrix) sweeps more slowly
   * than the screen refreshes: about 8 ms for the 7-segment example and 19 ms
   * for the 8x8 matrix, against a 17 ms frame. One frame therefore only ever
   * catches part of the picture, so those totals are carried forward with an
   * exponential decay over 50 ms of simulated time, roughly what the eye does.
   *
   * Lamps a program drives directly need no such help. Their duty over the
   * frame just ran is already a good brightness, and measuring only that frame
   * means a lamp switched off goes dark at once, the way the real ones do. */
  var PERSIST_S = 0.05;

  var acc = null;                 // display, decayed across frames
  var now = null;                 // directly driven lamps, this frame only

  function newAcc() {
    var a = { span: 0, sel: [], seg: [], col: [], pix: [] };
    var i;
    for (i = 0; i < 8; i++) { a.sel.push(0); a.col.push(0); a.seg.push([0,0,0,0,0,0,0,0]); }
    for (i = 0; i < 64; i++) a.pix.push(0);
    return a;
  }

  function newNow() {
    var n = { span: 0, led: [], load: [] };
    var i;
    for (i = 0; i < 8; i++) n.led.push(0);
    for (i = 0; i < 6; i++) n.load.push(0);
    return n;
  }

  function fade(a, seconds) {
    var k = Math.exp(-seconds / PERSIST_S), i, s;
    a.span *= k;
    for (i = 0; i < 8; i++) {
      a.sel[i] *= k; a.col[i] *= k;
      for (s = 0; s < 8; s++) a.seg[i][s] *= k;
    }
    for (i = 0; i < 64; i++) a.pix[i] *= k;
  }

  function accumulate(p0, p1, p2, dt) {
    var digit = (p2 >> 2) & 7, s, i, r, c;
    acc.span += dt;
    now.span += dt;
    acc.sel[digit] += dt;
    if (p0) for (s = 0; s < 8; s++) if ((p0 >> s) & 1) acc.seg[digit][s] += dt;
    for (i = 0; i < 8; i++) if (!((p2 >> i) & 1)) now.led[i] += dt;      // active low
    for (i = 0; i < 6; i++) if ((p1 >> i) & 1) now.load[i] += dt;        // active high
    /* A matrix pixel is lit when its 595 row bit is high and its P0 column is
     * low. Row 0 is the top, which is bit 7 of the shift register. */
    if (latch595) {
      for (c = 0; c < 8; c++) {
        if ((p0 >> c) & 1) continue;
        acc.col[c] += dt;
        for (r = 0; r < 8; r++) if ((latch595 >> (7 - r)) & 1) acc.pix[r * 8 + c] += dt;
      }
    }
  }

  /* Replay the port writes of the window that just ran, adding up how long each
   * lamp was actually lit. Without this a multiplexed display is sampled at one
   * arbitrary instant per frame, which is mostly noise. */
  function integrate() {
    if (!emu) return view();
    if (!acc) acc = newAcc();
    now = newNow();                        // the directly driven lamps start fresh
    var span = emu.cycles - emu.winCycles;

    if (span <= 0) {                       // stopped: show this instant instead
      acc = newAcc();
      accumulate(emu.sfr[A.P0], emu.sfr[A.P1], emu.sfr[A.P2], 1);
      return view();
    }

    fade(acc, span * EmuLib.CYCLE_S);
    var log = emu.portLog;
    var p0 = emu.winPorts[0], p1 = emu.winPorts[1], p2 = emu.winPorts[2];
    var at = emu.winCycles;
    for (var k = 0; k < log.length; k++) {
      var when = log[k][0], addr = log[k][1], val = log[k][2];
      if (when > at) { accumulate(p0, p1, p2, when - at); at = when; }
      if (addr === A.P0) p0 = val;
      else if (addr === A.P1) p1 = val;
      else if (addr === A.P2) p2 = val;
      else clock595(val);
    }
    if (emu.cycles > at) accumulate(p0, p1, p2, emu.cycles - at);
    return view();
  }

  /* A lamp lit one-eighth of the time, as every digit of an eight-way multiplex
   * is, looks as bright as a steady one, so full brightness is reached at 1/8. */
  function pov(f) { return f <= 0 ? 0 : Math.min(1, Math.sqrt(f * 8)); }
  /* A directly driven lamp just follows its duty cycle, softened by the eye.
   * Under about one percent it is emitting too little light to see, which also
   * keeps the running average from leaving a glow behind a lamp switched off. */
  function ledGlow(f) { return f < 0.01 ? 0 : Math.pow(Math.min(1, f), 1 / 2.2); }

  /* Brightness for every lamp. A multiplexed lamp is judged twice: whether it
   * was driven while its digit or column was selected, and how much of the time
   * that selection was live. */
  function view() {
    var out = { seg: [], led: [], load: [], pix: [] };
    var span = acc && acc.span > 0 ? acc.span : 1;
    var frameSpan = now && now.span > 0 ? now.span : 1;
    var d, s, r, c, sel, col;
    for (d = 0; d < 8; d++) {
      var row = [];
      sel = acc ? acc.sel[d] : 0;
      for (s = 0; s < 8; s++) {
        row.push(sel > 0 ? (acc.seg[d][s] / sel) * pov(sel / span) : 0);
      }
      out.seg.push(row);
    }
    for (c = 0; c < 8; c++) {
      col = acc ? acc.col[c] : 0;
      for (r = 0; r < 8; r++) {
        out.pix[r * 8 + c] = col > 0 ? (acc.pix[r * 8 + c] / col) * pov(col / span) : 0;
      }
    }
    for (d = 0; d < 8; d++) out.led.push(now ? ledGlow(now.led[d] / frameSpan) : 0);
    for (d = 0; d < 6; d++) out.load.push(now ? ledGlow(now.load[d] / frameSpan) : 0);
    return out;
  }

  /* Below this a lamp emitted too little light to see. It matters because some
   * programs leave a pin driven for a cycle or two between updates, which is a
   * real but invisible flash on the board. */
  var VISIBLE = 0.08;

  function setGlow(node, g) {
    if (g > VISIBLE) {
      node.classList.add("on");
      node.style.opacity = g.toFixed(3);
    } else {
      node.classList.remove("on");
      node.style.opacity = "";
    }
  }

  /* The polygons sit in the DOM as a,f,b,g,e,c,d,dp; P0 carries them as
   * bit 0 = a through bit 6 = g, with bit 7 the decimal point. */
  var SEG_BIT = [0, 5, 1, 6, 4, 2, 3, 7];

  function refreshBoard(lamps) {
    if (!emu) return;
    var v = lamps || integrate();
    var i, s;
    for (i = 0; i < SEG_DIGITS; i++) {
      for (s = 0; s < 8; s++) setGlow(segEls[i][s], v.seg[i][SEG_BIT[s]]);
    }
    for (i = 0; i < 8; i++) setGlow(ledEls[i], v.led[i]);
    for (i = 0; i < 6; i++) setGlow(loadEls[i], v.load[i]);
    for (i = 0; i < 64; i++) setGlow(pixEls[i], v.pix[i]);

    var pc = emu.pc.toString(16).toUpperCase();
    var regs = [
      ["PC", "0000".slice(pc.length) + pc + "H"],
      ["A", hex2(emu.sfr[A.ACC])],
      ["B", hex2(emu.sfr[A.B])],
      ["SP", hex2(emu.sfr[A.SP])],
      ["PSW", hex2(emu.pswWithParity())],
      ["DPTR", hex2(emu.sfr[A.DPH]).slice(0, 2) + hex2(emu.sfr[A.DPL]).slice(0, 2) + "H"],
      /* Pin values, not latch values: this is what MOV A,Pn would read, so a
       * button or a held keypad key shows up here the same way it does in the
       * program. For a pin nothing is pulling down the two are identical. */
      ["P0", hex2(emu.rd(A.P0))],
      ["P1", hex2(emu.rd(A.P1))],
      ["P2", hex2(emu.rd(A.P2))],
      ["P3", hex2(emu.rd(A.P3))],
      ["TMOD", hex2(emu.sfr[A.TMOD])],
      ["TCON", hex2(emu.sfr[A.TCON])],
      ["TH0", hex2(emu.sfr[A.TH0])],
      ["TL0", hex2(emu.sfr[A.TL0])],
      ["TH1", hex2(emu.sfr[A.TH1])],
      ["TL1", hex2(emu.sfr[A.TL1])],
      ["IE", hex2(emu.sfr[A.IE])]
    ];
    for (i = 0; i < 8; i++) regs.push(["R" + i, hex2(emu.rget(i))]);
    el.regs.innerHTML = regs.map(function (r) {
      return '<div class="reg"><span class="reg-name">' + r[0] + '</span><span class="reg-val">' + r[1] + "</span></div>";
    }).join("");
    el.clock.textContent = emu.time().toFixed(3) + " s · " + emu.cycles.toLocaleString() + " cycles";
  }

  function hex2(v) { return ("0" + (v & 0xFF).toString(16).toUpperCase()).slice(-2) + "H"; }

  /* ------------------------------------------------------------------ sound */

  var audioFailed = false;
  function ensureAudio() {
    if (audio || audioFailed) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { audioFailed = true; return; }
    try {
      audio = new Ctx();
      osc = audio.createOscillator();
      osc.type = "square";
      osc.frequency.value = 440;
      gain = audio.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(audio.destination);
      osc.start();
    } catch (e) {            // no audio device, or the browser blocked it
      audio = osc = gain = null;
      audioFailed = true;
    }
  }

  /* Turn the buzzer-pin edges of the last slice into one tone. */
  function updateSound(edges) {
    var freq = 0;
    if (edges.length >= 2) {
      var span = edges[edges.length - 1][0] - edges[0][0];
      if (span > 0) freq = (edges.length - 1) / (2 * span);
    }
    var on = freq > 30 && freq < 20000 && el.sound.checked;
    el["buzz-text"].textContent = freq ? Math.round(freq) + " Hz" : "silent";
    el.buzzer.classList.toggle("on", !!freq);
    if (!audio) { if (on) ensureAudio(); else return; }
    if (!audio) return;
    if (on) {
      osc.frequency.setTargetAtTime(freq, audio.currentTime, 0.01);
      gain.gain.setTargetAtTime(0.05, audio.currentTime, 0.01);
    } else {
      gain.gain.setTargetAtTime(0, audio.currentTime, 0.02);
    }
  }

  function buzzerEdges() {
    var out = [];
    for (var i = 0; i < emu.p2Log.length; i++) {
      if (emu.p2Log[i][1] === 5) out.push(emu.p2Log[i]);
    }
    return out;
  }

  /* ------------------------------------------------------------ build and run */

  function gutter() {
    var n = el.source.value.split("\n").length;
    var out = [];
    for (var i = 1; i <= n; i++) out.push(i);
    el.gutter.textContent = out.join("\n");
  }

  function showErrors(errors) {
    if (!errors.length) {
      el.errors.innerHTML = "";
      el.errors.classList.remove("has-errors");
      return;
    }
    el.errors.classList.add("has-errors");
    el.errors.innerHTML = "<strong>" + errors.length + (errors.length === 1 ? " error" : " errors") + "</strong>" +
      errors.slice(0, 12).map(function (e) {
        return '<div class="err"><button class="err-line" type="button" data-line="' + e.line + '">line ' +
          e.line + "</button> " + escapeHtml(e.message) + "</div>";
      }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* A held keypad key ties its column pin to whatever its row pin is driving. */
  function keypadPins(latch) {
    var mask = 0xFF;
    Object.keys(keyDown).forEach(function (k) {
      if (!keyDown[k]) return;
      var rc = k.split(",");
      var rowBit = 7 - (+rc[0]), colBit = 3 - (+rc[1]);
      if (!((latch >> rowBit) & 1)) mask &= ~(1 << colBit);
    });
    return mask;
  }

  function build() {
    var res;
    try {
      res = Asm.assemble(el.source.value);
    } catch (e) {
      showErrors([{ line: 1, message: String(e && e.message || e) }]);
      return null;
    }
    showErrors(res.errors);
    if (res.errors.length) return null;
    built = res;
    dirty = false;
    var rom = new Uint8Array(0x10000).fill(0xFF);
    Object.keys(res.code).forEach(function (a) { rom[a] = res.code[a]; });
    emu = new EmuLib.Emu(rom);
    emu.wirePins = function (addr, latch) {
      return addr === A.P1 ? keypadPins(latch) : 0xFF;
    };
    shift595 = latch595 = 0;
    acc = null;
    now = null;
    prevP3 = 0xFF;
    applyButtons();
    emu.markWindow();
    el["editor-status"].textContent = res.bytesUsed + " bytes assembled";
    refreshBoard();
    return emu;
  }

  function applyButtons() {
    if (!emu) return;
    var pins = 0xFF;
    Object.keys(pressed).forEach(function (bit) {
      if (pressed[bit]) pins &= ~(1 << +bit);
    });
    emu.pinsP3 = pins & 0xFF;
  }

  function setRunning(state) {
    running = state;
    el.run.textContent = state ? "❚❚ Pause" : "▶ Run";
    el.run.classList.toggle("btn-primary", !state);
    if (state) {
      lastFrame = performance.now();
      if (emu) emu.markWindow();
      rafId = requestAnimationFrame(frame);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      updateSound([]);
    }
  }

  function frame(now) {
    if (!running || !emu) return;
    var wall = Math.min((now - lastFrame) / 1000, 0.05);   // ignore long gaps
    lastFrame = now;
    var slice = wall * parseFloat(el.speed.value);
    emu.markWindow();
    try {
      emu.runFor(slice, 400000);
    } catch (e) {
      setRunning(false);
      showErrors([{ line: lineForAddress(emu.pc), message: "stopped: " + (e.message || e) }]);
      return;
    }
    var lamps = integrate();
    updateSound(buzzerEdges());
    refreshBoard(lamps);
    rafId = requestAnimationFrame(frame);
  }

  function lineForAddress(addr) {
    if (!built) return 1;
    for (var i = 0; i < built.lines.length; i++) {
      var l = built.lines[i];
      if (l.addr === addr && l.bytes && l.bytes.length) return l.n;
    }
    return 1;
  }

  /* ------------------------------------------------------------------ wiring */

  el.run.addEventListener("click", function () {
    if (running) { setRunning(false); return; }
    if ((!emu || dirty) && !build()) return;   // edited source is assembled first
    ensureAudio();
    try { if (audio && audio.state === "suspended") audio.resume(); } catch (e) { /* ignore */ }
    setRunning(true);
  });

  el.step.addEventListener("click", function () {
    if (running) setRunning(false);
    if ((!emu || dirty) && !build()) return;
    emu.markWindow();
    try {
      emu.step();
    } catch (e) {
      showErrors([{ line: lineForAddress(emu.pc), message: "stopped: " + (e.message || e) }]);
    }
    refreshBoard();
  });

  el.reset.addEventListener("click", function () {
    setRunning(false);
    build();
  });

  el.source.addEventListener("input", function () {
    gutter();
    dirty = true;
    el["editor-status"].textContent = "edited — press Run to assemble";
    try { localStorage.setItem("ee390-lab-source", el.source.value); } catch (e) { /* private mode */ }
  });
  el.source.addEventListener("scroll", function () { el.gutter.scrollTop = el.source.scrollTop; });

  el.errors.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".err-line") : null;
    if (!b) return;
    var line = +b.getAttribute("data-line");
    var text = el.source.value.split("\n");
    var pos = 0;
    for (var i = 0; i < line - 1 && i < text.length; i++) pos += text[i].length + 1;
    el.source.focus();
    el.source.setSelectionRange(pos, pos + (text[line - 1] || "").length);
  });

  function press(bit, down) {
    pressed[bit] = down;
    applyButtons();
    document.querySelectorAll('.keybtn[data-bit="' + bit + '"]').forEach(function (b) {
      b.classList.toggle("down", down);
    });
    if (!running) refreshBoard();
  }

  function padPress(row, col, down) {
    keyDown[row + "," + col] = down;
    var sel = '.padbtn[data-row="' + row + '"][data-col="' + col + '"]';
    document.querySelectorAll(sel).forEach(function (b) { b.classList.toggle("down", down); });
    if (!running) refreshBoard();
  }

  function holdable(node, onDown, onUp) {
    ["mousedown", "touchstart"].forEach(function (ev) {
      node.addEventListener(ev, function (e) { e.preventDefault(); onDown(); });
    });
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(function (ev) {
      node.addEventListener(ev, onUp);
    });
  }

  document.querySelectorAll(".keybtn").forEach(function (b) {
    var bit = +b.getAttribute("data-bit");
    holdable(b, function () { press(bit, true); }, function () { press(bit, false); });
  });

  var KEYMAP = { "1": 1, "2": 0, "3": 2, "4": 3 };   // K1..K4 -> P3 bit
  document.addEventListener("keydown", function (e) {
    if (e.target === el.source || e.repeat) return;
    if (KEYMAP.hasOwnProperty(e.key)) press(KEYMAP[e.key], true);
  });
  document.addEventListener("keyup", function (e) {
    if (KEYMAP.hasOwnProperty(e.key)) press(KEYMAP[e.key], false);
  });

  el.download.addEventListener("click", function () {
    if ((!built || dirty) && !build()) return;
    var blob = new Blob([built.hex], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "program.hex";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  el.sound.addEventListener("change", function () {
    if (!el.sound.checked && gain && audio) gain.gain.setTargetAtTime(0, audio.currentTime, 0.02);
  });

  EXAMPLES.forEach(function (name) {
    var o = document.createElement("option");
    o.value = name;
    o.textContent = name.replace(/_/g, " ");
    el.examples.appendChild(o);
  });

  el.examples.addEventListener("change", function () {
    var name = el.examples.value;
    if (!name) return;
    fetch("examples/" + name + ".asm").then(function (r) { return r.text(); }).then(function (text) {
      setRunning(false);
      el.source.value = text.replace(/\r\n?/g, "\n");
      gutter();
      build();
    }).catch(function () {
      showErrors([{ line: 1, message: "could not load that example" }]);
    });
    el.examples.value = "";
  });

  /* ------------------------------------------------------------------ start */

  /* Used by the site's automated tests, and handy when debugging in the console. */
  window.EE390Lab = {
    advance: function (seconds) {
      if (!emu) return 0;
      emu.markWindow();
      emu.runFor(seconds, 4000000);
      var lamps = integrate();
      updateSound(buzzerEdges());
      refreshBoard(lamps);
      return emu.cycles;
    },
    press: press,
    padPress: padPress,
    build: build,
    view: view,               // brightness of every lamp, 0..1
    isRunning: function () { return running; },
    emu: function () { return emu; },
    built: function () { return built; }
  };

  buildBoard();
  var saved = null;
  try { saved = localStorage.getItem("ee390-lab-source"); } catch (e) { /* private mode */ }
  el.source.value = saved || DEFAULT_SOURCE;
  gutter();
  build();
})();
