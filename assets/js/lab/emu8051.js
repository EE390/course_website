/* 8051 emulator for the EE 390 lab simulator.
 *
 * A direct port of the Python emulator used to verify the course solutions
 * (instructor/tools/emu8051.py). Full MCS-51 instruction set, Timer 0/1 in all
 * four modes with the C/T and GATE bits, all five interrupt sources with IP
 * priority, input pins on every port, and the 12T clock.
 *
 * Keep the two in step: any fix here belongs in the Python version too.
 */
(function (global) {
  "use strict";

  var CRYSTAL = 11059200;
  var CYCLE_S = 12 / CRYSTAL;

  var ACC = 0xE0, B = 0xF0, PSW = 0xD0, SP = 0x81, DPL = 0x82, DPH = 0x83;
  var P0 = 0x80, P1 = 0x90, P2 = 0xA0, P3 = 0xB0;
  var TCON = 0x88, TMOD = 0x89, TL0 = 0x8A, TL1 = 0x8B, TH0 = 0x8C, TH1 = 0x8D;
  var SCON = 0x98, IE = 0xA8, IP = 0xB8;

  /* Pins on P3 that the timers and the external interrupts watch. */
  var TPIN = [0x10, 0x20];        // T0 = P3.4, T1 = P3.5
  var INTPIN = [0x04, 0x08];      // INT0 = P3.2, INT1 = P3.3

  /* Interrupt sources in hardware polling order, highest first inside a level.
   * clear: what the hardware does to the flag when it vectors.
   *   "always" - timer flags
   *   "ifEdge" - IE0/IE1, but only when ITx selects edge triggering
   *   "never"  - RI/TI, which the service routine has to clear itself
   */
  var SOURCES = [
    { reg: TCON, flag: 0x02, en: 0x01, vec: 0x0003, pri: 0x01, clear: "ifEdge", it: 0x01 },
    { reg: TCON, flag: 0x20, en: 0x02, vec: 0x000B, pri: 0x02, clear: "always" },
    { reg: TCON, flag: 0x08, en: 0x04, vec: 0x0013, pri: 0x04, clear: "ifEdge", it: 0x04 },
    { reg: TCON, flag: 0x80, en: 0x08, vec: 0x001B, pri: 0x08, clear: "always" },
    { reg: SCON, flag: 0x03, en: 0x10, vec: 0x0023, pri: 0x10, clear: "never" }
  ];

  var SIZE = new Uint8Array(256).fill(1);
  var CYC = new Uint8Array(256).fill(1);

  function set(ops, size, cyc) {
    for (var i = 0; i < ops.length; i++) { SIZE[ops[i]] = size; CYC[ops[i]] = cyc; }
  }
  function range(a, b) { var r = []; for (var i = a; i < b; i++) r.push(i); return r; }

  set([0x00], 1, 1);
  var ajmp = [], acall = [];
  for (var x = 0; x < 256; x += 32) { ajmp.push(x | 0x01); acall.push(x | 0x11); }
  set(ajmp, 2, 2);
  set(acall, 2, 2);
  set([0x02, 0x12], 3, 2);
  set([0x03, 0x04, 0x13, 0x14, 0x23, 0x33, 0xC3, 0xC4, 0xD3, 0xD4, 0xE4, 0xF4, 0xB3], 1, 1);
  set([0x05, 0x15], 2, 1);
  set(range(0x06, 0x10).concat(range(0x16, 0x20)), 1, 1);
  set([0x10, 0x20, 0x30], 3, 2);
  set([0x22, 0x32], 1, 2);
  [0x20, 0x30, 0x40, 0x50, 0x60, 0x90].forEach(function (base) {
    set([base + 4], 2, 1);
    set([base + 5], 2, 1);
    set(range(base + 6, base + 16), 1, 1);
  });
  set([0x40, 0x50, 0x60, 0x70, 0x80], 2, 2);
  set([0x42, 0x52, 0x62], 2, 1);
  set([0x43, 0x53, 0x63], 3, 2);
  set([0x72, 0x82, 0xA0, 0xB0], 2, 2);
  set([0x73], 1, 2);
  set([0x74], 2, 1);
  set([0x75], 3, 2);
  set([0x76, 0x77], 2, 1);
  set(range(0x78, 0x80), 2, 1);
  set([0x83, 0x93], 1, 2);
  set([0x84, 0xA4], 1, 4);
  set([0x85], 3, 2);
  set([0x86, 0x87], 2, 2);
  set(range(0x88, 0x90), 2, 2);
  set([0x90], 3, 2);
  set([0x92], 2, 2);
  set([0xA2], 2, 1);
  set([0xA3], 1, 2);
  set([0xA6, 0xA7], 2, 2);
  set(range(0xA8, 0xB0), 2, 2);
  set([0xB2], 2, 1);
  set(range(0xB4, 0xC0), 3, 2);
  set([0xC0, 0xD0], 2, 2);
  set([0xC2, 0xD2], 2, 1);
  set([0xC5], 2, 1);
  set([0xC6, 0xC7, 0xD6, 0xD7], 1, 1);
  set(range(0xC8, 0xD0), 1, 1);
  set([0xD5], 3, 2);
  set(range(0xD8, 0xE0), 2, 2);
  set([0xE0, 0xE2, 0xE3, 0xF0, 0xF2, 0xF3], 1, 2);
  set([0xE5, 0xF5], 2, 1);
  set([0xE6, 0xE7, 0xF6, 0xF7], 1, 1);
  set(range(0xE8, 0xF0).concat(range(0xF8, 0x100)), 1, 1);

  /* Intel HEX -> { rom, top }. Tolerates a byte-order mark, as PowerShell writes one. */
  function loadHex(text) {
    var rom = new Uint8Array(0x10000).fill(0xFF);
    var top = 0;
    var lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim().replace(/^\uFEFF/, "");
      if (line.charAt(0) !== ":") continue;
      var body = line.slice(1);
      if (body.length % 2) throw new Error("odd-length record on line " + (i + 1));
      var b = [], sum = 0, j;
      for (j = 0; j < body.length; j += 2) {
        var v = parseInt(body.substr(j, 2), 16);
        if (isNaN(v)) throw new Error("bad hex digits on line " + (i + 1));
        b.push(v); sum += v;
      }
      if (sum & 0xFF) throw new Error("bad checksum on line " + (i + 1));
      var n = b[0], addr = (b[1] << 8) | b[2], typ = b[3];
      if (typ === 0) {
        for (j = 0; j < n; j++) rom[(addr + j) & 0xFFFF] = b[4 + j];
        if (n) top = Math.max(top, addr + n - 1);
      }
    }
    return { rom: rom, top: top };
  }

  function Emu(rom) {
    this.rom = rom;
    this.iram = new Uint8Array(256);
    this.sfr = new Uint8Array(256);
    this.xram = new Uint8Array(0x10000);
    this.sfr[P0] = this.sfr[P1] = this.sfr[P2] = this.sfr[P3] = 0xFF;
    this.sfr[SP] = 0x07;
    this.pc = 0;
    this.cycles = 0;
    /* What the outside world holds each port pin at. A port reads its latch
     * ANDed with these, so 0xFF means "nothing is pulling anything low". */
    this.pinsP0 = 0xFF;
    this.pinsP1 = 0xFF;
    this.pinsP2 = 0xFF;
    this.pinsP3 = 0xFF;          // pulled low by simulated buttons
    /* Optional board wiring: function(portAddr, latch) -> extra pin mask. Used
     * for a matrix keypad, where an input pin follows an output pin next to it. */
    this.wirePins = null;
    this.levels = [];            // priorities of interrupts in progress
    this.holdoff = false;        // one instruction must follow RETI or a write to IE/IP
    this.prevT = [1, 1];         // last seen level on T0/T1, for the counters
    this.prevInt = [1, 1];       // last seen level on INT0/INT1, for edge triggering
    this.p2Log = [];             // [time_s, bit, level] for the buzzer
    this.portLog = [];           // [cycles, addr, value] for every port write
    this.winCycles = 0;          // start of the current board window
    this.winPorts = [0xFF, 0xFF, 0xFF, 0xFF];   // P0..P3 as the window opened
    this.logPortWrites = true;
    this.halted = null;
  }

  Emu.prototype.time = function () { return this.cycles * CYCLE_S; };

  Emu.prototype.isPort = function (a) { return a === P0 || a === P1 || a === P2 || a === P3; };

  Emu.prototype.pinsOf = function (a) {
    var base = a === P0 ? this.pinsP0 : a === P1 ? this.pinsP1
             : a === P2 ? this.pinsP2 : this.pinsP3;
    if (this.wirePins) base &= this.wirePins(a, this.sfr[a]);
    return base & 0xFF;
  };

  /* A normal read of a port sees the pin, which the outside world can pull low. */
  Emu.prototype.rd = function (a) {
    if (a < 0x80) return this.iram[a];
    if (a === PSW) return this.pswWithParity();
    if (this.isPort(a)) return this.sfr[a] & this.pinsOf(a);
    return this.sfr[a];
  };

  /* Read-modify-write instructions (INC, DEC, DJNZ, ANL, ORL, XRL on a direct
   * address, and CLR, SETB, CPL, JBC, MOV Px.y,C on a bit) read the output
   * latch instead, so a pin held low by a button cannot corrupt the latch. */
  Emu.prototype.rdLatch = function (a) {
    if (a < 0x80) return this.iram[a];
    if (a === PSW) return this.pswWithParity();
    return this.sfr[a];
  };

  /* Start a fresh window: the board rebuilds the display and the buzzer tone
   * from the port writes inside it. */
  Emu.prototype.markWindow = function () {
    this.winCycles = this.cycles;
    this.winPorts = [this.sfr[P0], this.sfr[P1], this.sfr[P2], this.sfr[P3]];
    this.portLog.length = 0;
    this.p2Log.length = 0;
  };

  Emu.prototype.wr = function (a, v) {
    v &= 0xFF;
    if (a < 0x80) { this.iram[a] = v; return; }
    if (a === IE || a === IP) this.holdoff = true;
    if (this.logPortWrites && this.isPort(a) && this.sfr[a] !== v) {
      this.portLog.push([this.cycles, a, v]);
      if (a === P2) {
        var old = this.sfr[P2];
        for (var bit = 0; bit < 8; bit++) {
          if (((old ^ v) >> bit) & 1) this.p2Log.push([this.time(), bit, (v >> bit) & 1]);
        }
      }
    }
    this.sfr[a] = v;
  };

  Emu.prototype.pswWithParity = function () {
    var a = this.sfr[ACC], p = 0;
    while (a) { p ^= a & 1; a >>= 1; }
    return (this.sfr[PSW] & 0xFE) | p;
  };

  Emu.prototype.getA = function () { return this.sfr[ACC]; };
  Emu.prototype.setA = function (v) { this.sfr[ACC] = v & 0xFF; };
  Emu.prototype.regAddr = function (n) { return ((this.sfr[PSW] >> 3) & 3) * 8 + n; };
  Emu.prototype.rget = function (n) { return this.iram[this.regAddr(n)]; };
  Emu.prototype.rset = function (n, v) { this.iram[this.regAddr(n)] = v & 0xFF; };
  Emu.prototype.cy = function () { return this.sfr[PSW] >> 7; };
  Emu.prototype.setCy = function (c) { this.sfr[PSW] = (this.sfr[PSW] & 0x7F) | (c ? 0x80 : 0); };

  Emu.prototype.bitLoc = function (b) {
    return b < 0x80 ? [0x20 + (b >> 3), b & 7] : [b & 0xF8, b & 7];
  };
  Emu.prototype.getbit = function (b) {
    var loc = this.bitLoc(b);
    return (this.rd(loc[0]) >> loc[1]) & 1;
  };
  Emu.prototype.getbitLatch = function (b) {
    var loc = this.bitLoc(b);
    return (this.rdLatch(loc[0]) >> loc[1]) & 1;
  };
  Emu.prototype.setbit = function (b, val) {
    var loc = this.bitLoc(b), byte = loc[0], n = loc[1];
    var cur = byte < 0x80 ? this.iram[byte] : this.sfr[byte];
    this.wr(byte, val ? (cur | (1 << n)) : (cur & ~(1 << n)));
  };

  Emu.prototype.push = function (v) {
    this.sfr[SP] = (this.sfr[SP] + 1) & 0xFF;
    this.iram[this.sfr[SP]] = v & 0xFF;
  };
  Emu.prototype.pop = function () {
    var v = this.iram[this.sfr[SP]];
    this.sfr[SP] = (this.sfr[SP] - 1) & 0xFF;
    return v;
  };

  /* MOVX @Ri carries only the low address byte; P2 supplies the page. */
  Emu.prototype.xpage = function (low) { return ((this.sfr[P2] << 8) | low) & 0xFFFF; };

  Emu.prototype.getDptr = function () { return (this.sfr[DPH] << 8) | this.sfr[DPL]; };
  Emu.prototype.setDptr = function (v) {
    this.sfr[DPH] = (v >> 8) & 0xFF;
    this.sfr[DPL] = v & 0xFF;
  };

  Emu.prototype._add = function (v, carry) {
    var a = this.getA(), c = carry, res = a + v + c;
    var ac = ((a & 0x0F) + (v & 0x0F) + c) > 0x0F;
    var ov = ((a ^ res) & (v ^ res) & 0x80) !== 0;
    var psw = this.sfr[PSW] & ~(0x80 | 0x40 | 0x04);
    this.sfr[PSW] = psw | (res > 0xFF ? 0x80 : 0) | (ac ? 0x40 : 0) | (ov ? 0x04 : 0);
    this.setA(res);
  };

  Emu.prototype._subb = function (v) {
    var a = this.getA(), c = this.cy(), res = a - v - c;
    var ac = ((a & 0x0F) - (v & 0x0F) - c) < 0;
    var ov = ((a ^ v) & (a ^ res) & 0x80) !== 0;
    var psw = this.sfr[PSW] & ~(0x80 | 0x40 | 0x04);
    this.sfr[PSW] = psw | (res < 0 ? 0x80 : 0) | (ac ? 0x40 : 0) | (ov ? 0x04 : 0);
    this.setA(res & 0xFF);
  };

  /* TRx is set, and if GATE is set the matching INTx pin is high. */
  Emu.prototype.timerRuns = function (t) {
    if (!(this.sfr[TCON] & (t ? 0x40 : 0x10))) return false;
    if ((this.sfr[TMOD] >> (4 * t + 3)) & 1) {
      if (!(this.rd(P3) & INTPIN[t])) return false;
    }
    return true;
  };

  /* C/T picks the input: machine cycles, or falling edges on the Tx pin. */
  Emu.prototype.timerPulses = function (t, n, edges) {
    return ((this.sfr[TMOD] >> (4 * t + 2)) & 1) ? edges[t] : n;
  };

  /* Count pulses into TH/TL for one timer. Mode 0 is 13 bits, mode 1 is 16,
   * mode 2 is 8 with auto-reload from TH. `quiet` holds back the overflow flag,
   * which Timer 1 needs while Timer 0 has taken TF1 over in mode 3. */
  Emu.prototype.countUp = function (t, mode, n, quiet) {
    if (!n) return;
    var th = t ? TH1 : TH0, tl = t ? TL1 : TL0, tf = t ? 0x80 : 0x20;
    var v, max;
    if (mode === 2) {
      v = this.sfr[tl] + n;
      while (v > 0xFF) {
        if (!quiet) this.sfr[TCON] |= tf;
        v = this.sfr[th] + (v - 0x100);
      }
      this.sfr[tl] = v;
      return;
    }
    if (mode === 0) { max = 0x1FFF; v = ((this.sfr[th] << 5) | (this.sfr[tl] & 0x1F)) + n; }
    else { max = 0xFFFF; v = ((this.sfr[th] << 8) | this.sfr[tl]) + n; }
    if (v > max) {
      if (!quiet) this.sfr[TCON] |= tf;
      v &= max;
    }
    if (mode === 0) { this.sfr[tl] = v & 0x1F; this.sfr[th] = (v >> 5) & 0xFF; }
    else { this.sfr[tl] = v & 0xFF; this.sfr[th] = (v >> 8) & 0xFF; }
  };

  /* One half of Timer 0 in mode 3, which is a plain 8-bit counter. */
  Emu.prototype.count8 = function (reg, tf, n) {
    if (!n) return;
    var v = this.sfr[reg] + n;
    while (v > 0xFF) { this.sfr[TCON] |= tf; v -= 0x100; }
    this.sfr[reg] = v;
  };

  Emu.prototype.tick = function (n) {
    var p3 = this.rd(P3), edges = [0, 0], t, lvl;
    for (t = 0; t < 2; t++) {
      lvl = (p3 & TPIN[t]) ? 1 : 0;
      if (this.prevT[t] === 1 && lvl === 0) edges[t] = 1;   // one edge per machine cycle at most
      this.prevT[t] = lvl;
    }
    var tmod = this.sfr[TMOD];
    var m0 = tmod & 3, m1 = (tmod >> 4) & 3;
    if (m0 === 3) {
      /* Mode 3 splits Timer 0: TL0 keeps TR0 and TF0, TH0 borrows TR1 and TF1. */
      if (this.timerRuns(0)) this.count8(TL0, 0x20, this.timerPulses(0, n, edges));
      if (this.sfr[TCON] & 0x40) this.count8(TH0, 0x80, n);
      /* Timer 1 keeps counting for the baud generator but can no longer raise TF1. */
      if (m1 !== 3) this.countUp(1, m1, this.timerPulses(1, n, edges), true);
    } else {
      if (this.timerRuns(0)) this.countUp(0, m0, this.timerPulses(0, n, edges));
      if (m1 !== 3 && this.timerRuns(1)) this.countUp(1, m1, this.timerPulses(1, n, edges));
    }
    this.pollExternal(p3);
  };

  /* INT0/INT1: ITx = 1 latches a falling edge into IEx, ITx = 0 makes IEx
   * follow the low level, which is why a level-triggered source has to be
   * released before the service routine returns. */
  Emu.prototype.pollExternal = function (p3) {
    var tcon = this.sfr[TCON];
    for (var i = 0; i < 2; i++) {
      var lvl = (p3 & INTPIN[i]) ? 1 : 0;
      var itBit = i ? 0x04 : 0x01, ieFlag = i ? 0x08 : 0x02;
      if (tcon & itBit) {
        if (this.prevInt[i] === 1 && lvl === 0) tcon |= ieFlag;
      } else if (lvl === 0) {
        tcon |= ieFlag;
      } else {
        tcon &= ~ieFlag;
      }
      this.prevInt[i] = lvl;
    }
    this.sfr[TCON] = tcon;
  };

  Emu.prototype.checkInterrupts = function () {
    /* RETI, and any write to IE or IP, lets one more instruction run first. */
    if (this.holdoff) { this.holdoff = false; return false; }
    var ie = this.sfr[IE];
    if (!(ie & 0x80)) return false;
    var ip = this.sfr[IP];
    var current = this.levels.length ? this.levels[this.levels.length - 1] : -1;
    /* Everything at the high priority level first, then the low one, each in
     * the fixed polling order that breaks ties inside a level. */
    for (var level = 1; level > current; level--) {
      for (var i = 0; i < SOURCES.length; i++) {
        var s = SOURCES[i];
        if (!(ie & s.en)) continue;
        if (!(this.sfr[s.reg] & s.flag)) continue;
        if (((ip & s.pri) ? 1 : 0) !== level) continue;
        if (s.clear === "always" || (s.clear === "ifEdge" && (this.sfr[TCON] & s.it))) {
          this.sfr[s.reg] &= ~s.flag;
        }
        this.push(this.pc & 0xFF);
        this.push(this.pc >> 8);
        this.pc = s.vec;
        this.levels.push(level);
        this.cycles += 2;
        this.tick(2);
        return true;
      }
    }
    return false;
  };

  Emu.prototype.step = function () {
    if (this.checkInterrupts()) return;
    var pc = this.pc, rom = this.rom;
    var op = rom[pc];
    var size = SIZE[op], cyc = CYC[op];
    var o1 = rom[(pc + 1) & 0xFFFF];
    var o2 = rom[(pc + 2) & 0xFFFF];
    var nxt = (pc + size) & 0xFFFF;
    var self = this;
    function rel(x) { return (nxt + (x > 127 ? x - 256 : x)) & 0xFFFF; }
    var lo = op & 0x0F, hi = op & 0xF0;

    function operand() {
      if (lo === 4) return o1;
      if (lo === 5) return self.rd(o1);
      if (lo === 6 || lo === 7) return self.iram[self.rget(lo - 6)];
      return self.rget(lo - 8);
    }

    if (op === 0x00) {
      /* NOP */
    } else if (lo === 0x01) {
      var target = (nxt & 0xF800) | ((op >> 5) << 8) | o1;
      if (op & 0x10) { this.push(nxt & 0xFF); this.push(nxt >> 8); }
      nxt = target;
    } else if (op === 0x02) {
      nxt = (o1 << 8) | o2;
    } else if (op === 0x12) {
      this.push(nxt & 0xFF); this.push(nxt >> 8);
      nxt = (o1 << 8) | o2;
    } else if (op === 0x03) {
      this.setA((this.getA() >> 1) | ((this.getA() & 1) << 7));
    } else if (op === 0x13) {
      var c13 = this.getA() & 1;
      this.setA((this.getA() >> 1) | (this.cy() << 7));
      this.setCy(c13);
    } else if (op === 0x23) {
      this.setA((this.getA() << 1) | (this.getA() >> 7));
    } else if (op === 0x33) {
      var c33 = this.getA() >> 7;
      this.setA((this.getA() << 1) | this.cy());
      this.setCy(c33);
    } else if ((hi === 0x00 || hi === 0x10) && lo >= 4) {
      var d = hi === 0x00 ? 1 : -1;
      if (lo === 4) this.setA(this.getA() + d);
      else if (lo === 5) this.wr(o1, this.rdLatch(o1) + d);      // read-modify-write
      else if (lo === 6 || lo === 7) {
        var ri = this.rget(lo - 6);
        this.iram[ri] = (this.iram[ri] + d) & 0xFF;
      } else this.rset(lo - 8, this.rget(lo - 8) + d);
    } else if (op === 0x10) {
      if (this.getbitLatch(o1)) { this.setbit(o1, 0); nxt = rel(o2); }   // read-modify-write
    } else if (op === 0x20) {
      if (this.getbit(o1)) nxt = rel(o2);
    } else if (op === 0x30) {
      if (!this.getbit(o1)) nxt = rel(o2);
    } else if (op === 0x22 || op === 0x32) {
      var hiB = this.pop(), loB = this.pop();
      nxt = (hiB << 8) | loB;
      if (op === 0x32) {
        if (this.levels.length) this.levels.pop();
        this.holdoff = true;      // one instruction runs before the next interrupt
      }
    } else if (hi === 0x20 && lo >= 4) {
      this._add(operand(), 0);
    } else if (hi === 0x30 && lo >= 4) {
      this._add(operand(), this.cy());
    } else if ((hi === 0x40 || hi === 0x50 || hi === 0x60) && lo >= 2) {
      var f = hi === 0x40 ? function (a, b) { return a | b; }
        : hi === 0x50 ? function (a, b) { return a & b; }
          : function (a, b) { return a ^ b; };
      if (lo === 2) this.wr(o1, f(this.rdLatch(o1), this.getA()));     // read-modify-write
      else if (lo === 3) this.wr(o1, f(this.rdLatch(o1), o2));         // read-modify-write
      else this.setA(f(this.getA(), operand()));
    } else if (op === 0x40) {
      if (this.cy()) nxt = rel(o1);
    } else if (op === 0x50) {
      if (!this.cy()) nxt = rel(o1);
    } else if (op === 0x60) {
      if (this.getA() === 0) nxt = rel(o1);
    } else if (op === 0x70) {
      if (this.getA() !== 0) nxt = rel(o1);
    } else if (op === 0x72) {
      this.setCy(this.cy() | this.getbit(o1));
    } else if (op === 0x82) {
      this.setCy(this.cy() & this.getbit(o1));
    } else if (op === 0xA0) {
      this.setCy(this.cy() | (1 - this.getbit(o1)));
    } else if (op === 0xB0) {
      this.setCy(this.cy() & (1 - this.getbit(o1)));
    } else if (op === 0x73) {
      nxt = (this.getA() + this.getDptr()) & 0xFFFF;
    } else if (op === 0x74) {
      this.setA(o1);
    } else if (op === 0x75) {
      this.wr(o1, o2);
    } else if (op === 0x76 || op === 0x77) {
      this.iram[this.rget(op - 0x76)] = o1;
    } else if (op >= 0x78 && op <= 0x7F) {
      this.rset(op - 0x78, o1);
    } else if (op === 0x80) {
      nxt = rel(o1);
    } else if (op === 0x83) {
      this.setA(rom[(this.getA() + nxt) & 0xFFFF]);
    } else if (op === 0x84) {
      var bv = this.sfr[B], pswd = this.sfr[PSW] & ~(0x80 | 0x04);
      if (bv === 0) this.sfr[PSW] = pswd | 0x04;
      else {
        var q = Math.floor(this.getA() / bv), r = this.getA() % bv;
        this.setA(q); this.sfr[B] = r;
        this.sfr[PSW] = pswd;
      }
    } else if (op === 0x85) {
      this.wr(o2, this.rd(o1));
    } else if (op === 0x86 || op === 0x87) {
      this.wr(o1, this.iram[this.rget(op - 0x86)]);
    } else if (op >= 0x88 && op <= 0x8F) {
      this.wr(o1, this.rget(op - 0x88));
    } else if (op === 0x90) {
      this.setDptr((o1 << 8) | o2);
    } else if (op === 0x92) {
      this.setbit(o1, this.cy());
    } else if (op === 0x93) {
      this.setA(rom[(this.getA() + this.getDptr()) & 0xFFFF]);
    } else if (hi === 0x90 && lo >= 4) {
      this._subb(operand());
    } else if (op === 0xA2) {
      this.setCy(this.getbit(o1));
    } else if (op === 0xA3) {
      this.setDptr((this.getDptr() + 1) & 0xFFFF);
    } else if (op === 0xA4) {
      var prod = this.getA() * this.sfr[B];
      this.setA(prod & 0xFF);
      this.sfr[B] = prod >> 8;
      this.sfr[PSW] = (this.sfr[PSW] & ~(0x80 | 0x04)) | (prod > 0xFF ? 0x04 : 0);
    } else if (op === 0xA6 || op === 0xA7) {
      this.iram[this.rget(op - 0xA6)] = this.rd(o1);
    } else if (op >= 0xA8 && op <= 0xAF) {
      this.rset(op - 0xA8, this.rd(o1));
    } else if (op === 0xB2) {
      this.setbit(o1, 1 - this.getbitLatch(o1));                       // read-modify-write
    } else if (op === 0xB3) {
      this.setCy(1 - this.cy());
    } else if (op >= 0xB4 && op <= 0xBF) {
      var xv, yv;
      if (op === 0xB4) { xv = this.getA(); yv = o1; }
      else if (op === 0xB5) { xv = this.getA(); yv = this.rd(o1); }
      else if (op === 0xB6 || op === 0xB7) { xv = this.iram[this.rget(op - 0xB6)]; yv = o1; }
      else { xv = this.rget(op - 0xB8); yv = o1; }
      this.setCy(xv < yv ? 1 : 0);
      if (xv !== yv) nxt = rel(o2);
    } else if (op === 0xC0) {
      this.push(this.rd(o1));
    } else if (op === 0xD0) {
      this.wr(o1, this.pop());
    } else if (op === 0xC2) {
      this.setbit(o1, 0);
    } else if (op === 0xD2) {
      this.setbit(o1, 1);
    } else if (op === 0xC3) {
      this.setCy(0);
    } else if (op === 0xD3) {
      this.setCy(1);
    } else if (op === 0xC4) {
      this.setA((this.getA() << 4) | (this.getA() >> 4));
    } else if (op === 0xC5) {
      var t = this.rd(o1);
      this.wr(o1, this.getA());
      this.setA(t);
    } else if (op === 0xC6 || op === 0xC7) {
      var rx = this.rget(op - 0xC6), tmp = this.iram[rx];
      this.iram[rx] = this.getA();
      this.setA(tmp);
    } else if (op >= 0xC8 && op <= 0xCF) {
      var n8 = op - 0xC8, t8 = this.rget(n8);
      this.rset(n8, this.getA());
      this.setA(t8);
    } else if (op === 0xD4) {
      var av = this.getA(), cv = this.cy();
      if ((av & 0x0F) > 9 || (this.sfr[PSW] & 0x40)) av += 6;
      if (av > 0x9F || cv || (av >> 4) > 9) av += 0x60;
      this.setCy(cv || av > 0xFF ? 1 : 0);
      this.setA(av);
    } else if (op === 0xD5) {
      var dv = (this.rdLatch(o1) - 1) & 0xFF;                          // read-modify-write
      this.wr(o1, dv);
      if (dv) nxt = rel(o2);
    } else if (op === 0xD6 || op === 0xD7) {
      var rq = this.rget(op - 0xD6), m = this.iram[rq], aq = this.getA();
      this.setA((aq & 0xF0) | (m & 0x0F));
      this.iram[rq] = (m & 0xF0) | (aq & 0x0F);
    } else if (op >= 0xD8 && op <= 0xDF) {
      var rn = op - 0xD8, nv = (this.rget(rn) - 1) & 0xFF;
      this.rset(rn, nv);
      if (nv) nxt = rel(o1);
    } else if (op === 0xE0) {
      this.setA(this.xram[this.getDptr()]);
    } else if (op === 0xE2 || op === 0xE3) {
      this.setA(this.xram[this.xpage(this.rget(op - 0xE2))]);
    } else if (op === 0xE4) {
      this.setA(0);
    } else if (op === 0xE5) {
      this.setA(this.rd(o1));
    } else if (op === 0xE6 || op === 0xE7) {
      this.setA(this.iram[this.rget(op - 0xE6)]);
    } else if (op >= 0xE8 && op <= 0xEF) {
      this.setA(this.rget(op - 0xE8));
    } else if (op === 0xF0) {
      this.xram[this.getDptr()] = this.getA();
    } else if (op === 0xF2 || op === 0xF3) {
      this.xram[this.xpage(this.rget(op - 0xF2))] = this.getA();
    } else if (op === 0xF4) {
      this.setA(~this.getA());
    } else if (op === 0xF5) {
      this.wr(o1, this.getA());
    } else if (op === 0xF6 || op === 0xF7) {
      this.iram[this.rget(op - 0xF6)] = this.getA();
    } else if (op >= 0xF8 && op <= 0xFF) {
      this.rset(op - 0xF8, this.getA());
    } else {
      throw new Error("unsupported opcode " + op.toString(16).toUpperCase() +
        " at " + pc.toString(16).toUpperCase());
    }

    this.pc = nxt;
    this.cycles += cyc;
    this.tick(cyc);
  };

  /* Run for a slice of simulated time, with a cap so a tight loop cannot hang the tab. */
  Emu.prototype.runFor = function (seconds, maxSteps) {
    var end = this.cycles + Math.round(seconds / CYCLE_S);
    var steps = 0;
    var cap = maxSteps || 2000000;
    while (this.cycles < end && steps < cap) {
      this.step();
      steps++;
    }
    return steps;
  };

  Emu.prototype.buzzerEdges = function (bit) {
    bit = bit === undefined ? 5 : bit;
    var out = [];
    for (var i = 0; i < this.p2Log.length; i++) {
      if (this.p2Log[i][1] === bit) out.push([this.p2Log[i][0], this.p2Log[i][2]]);
    }
    return out;
  };

  global.EE390Emu = {
    Emu: Emu,
    loadHex: loadHex,
    CYCLE_S: CYCLE_S,
    CRYSTAL: CRYSTAL,
    SIZE: SIZE,
    CYC: CYC,
    ADDR: { ACC: ACC, B: B, PSW: PSW, SP: SP, DPL: DPL, DPH: DPH, P0: P0, P1: P1, P2: P2, P3: P3,
            TCON: TCON, TMOD: TMOD, TL0: TL0, TL1: TL1, TH0: TH0, TH1: TH1,
            SCON: SCON, IE: IE, IP: IP }
  };
})(typeof window !== "undefined" ? window
  : (typeof module !== "undefined" && module.exports) ? module.exports : this);
