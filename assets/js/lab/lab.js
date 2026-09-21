/* The EE 390 lab simulator page: editor, run loop, virtual board.
 *
 * Pin map follows the real Puzhong 51 A2 kit (see lab-kit.html):
 *   D1..D8   P2.0-P2.7, active LOW
 *   K1..K4   P3.1, P3.0, P3.2, P3.3, read 0 while pressed
 *   buzzer   P2.5 (shared with LED D6 on the real board)
 *   7-seg    segments on P0 (1 = on), digit select P2.2-P2.4, digit n -> P2 = n*4
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
   "errors", "editor-status", "clock", "leds", "segments", "regs", "buzzer", "buzz-text"]
    .forEach(function (id) { el[id] = document.getElementById(id); });

  var emu = null, built = null, running = false, rafId = null, lastFrame = 0;
  var dirty = true;                 // source edited since the last assemble
  var pressed = {};                 // P3 bit -> true while held
  var audio = null, osc = null, gain = null;

  /* ------------------------------------------------------------------ board */

  var SEG_DIGITS = 8;
  var segEls = [], ledEls = [];

  function buildBoard() {
    var i;
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
      segEls.push(d);
    }
    for (i = 0; i < 8; i++) {
      var w = document.createElement("div");
      w.className = "led-cell";
      w.innerHTML = '<span class="led"></span><span class="led-name">D' + (i + 1) + "</span>";
      el.leds.appendChild(w);
      ledEls.push(w.querySelector(".led"));
    }
  }

  /* Which 7-segment digit is selected: P2.2-P2.4 carry the digit number. */
  function activeDigit(p2) { return (p2 >> 2) & 7; }

  var segClasses = ["s-a", "s-b", "s-c", "s-d", "s-e", "s-f", "s-g", "s-dp"];
  var segLatch = new Array(SEG_DIGITS);
  for (var z = 0; z < SEG_DIGITS; z++) segLatch[z] = 0;

  function refreshBoard() {
    if (!emu) return;
    var p2 = emu.sfr[A.P2], p0 = emu.sfr[A.P0];
    var i;
    for (i = 0; i < 8; i++) {
      ledEls[i].classList.toggle("on", !((p2 >> i) & 1));   // active low
    }
    /* The real display is multiplexed, so remember what each digit was last shown. */
    var dig = activeDigit(p2);
    if (p0 !== 0) segLatch[dig] = p0;
    for (i = 0; i < SEG_DIGITS; i++) {
      var bits = segLatch[i];
      for (var s = 0; s < 8; s++) {
        segEls[i].querySelector("." + segClasses[s]).classList.toggle("on", !!((bits >> s) & 1));
      }
    }
    var pc = emu.pc.toString(16).toUpperCase();
    var regs = [
      ["PC", "0000".slice(pc.length) + pc + "H"],
      ["A", hex2(emu.sfr[A.ACC])],
      ["B", hex2(emu.sfr[A.B])],
      ["SP", hex2(emu.sfr[A.SP])],
      ["PSW", hex2(emu.pswWithParity())],
      ["DPTR", hex2(emu.sfr[A.DPH]) .slice(0, 2) + hex2(emu.sfr[A.DPL]).slice(0, 2) + "H"],
      ["P0", hex2(emu.sfr[A.P0])],
      ["P1", hex2(emu.sfr[A.P1])],
      ["P2", hex2(emu.sfr[A.P2])],
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
  function updateSound(edges, sliceSeconds) {
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

  /* ------------------------------------------------------------------ build and run */

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
    applyButtons();
    el["editor-status"].textContent = res.bytesUsed + " bytes assembled";
    segLatch = segLatch.map(function () { return 0; });
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
      rafId = requestAnimationFrame(frame);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      updateSound([], 0);
    }
  }

  function frame(now) {
    if (!running || !emu) return;
    var wall = Math.min((now - lastFrame) / 1000, 0.05);   // ignore long gaps
    lastFrame = now;
    var slice = wall * parseFloat(el.speed.value);
    var edgesBefore = emu.p2Log.length;
    try {
      emu.runFor(slice, 400000);
    } catch (e) {
      setRunning(false);
      showErrors([{ line: lineForAddress(emu.pc), message: "stopped: " + (e.message || e) }]);
      return;
    }
    var edges = [];
    for (var i = edgesBefore; i < emu.p2Log.length; i++) {
      if (emu.p2Log[i][1] === 5) edges.push(emu.p2Log[i]);
    }
    if (emu.p2Log.length > 20000) emu.p2Log = emu.p2Log.slice(-4000);
    updateSound(edges, slice);
    refreshBoard();
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

  document.querySelectorAll(".keybtn").forEach(function (b) {
    var bit = +b.getAttribute("data-bit");
    ["mousedown", "touchstart"].forEach(function (ev) {
      b.addEventListener(ev, function (e) { e.preventDefault(); press(bit, true); });
    });
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(function (ev) {
      b.addEventListener(ev, function () { press(bit, false); });
    });
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
      var before = emu.p2Log.length;
      emu.runFor(seconds, 4000000);
      var edges = [];
      for (var i = before; i < emu.p2Log.length; i++) {
        if (emu.p2Log[i][1] === 5) edges.push(emu.p2Log[i]);
      }
      updateSound(edges, seconds);
      refreshBoard();
      return emu.cycles;
    },
    press: press,
    build: build,
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
