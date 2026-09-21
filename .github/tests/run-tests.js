#!/usr/bin/env node
/* Tests for the lab simulator's assembler and processor model. No dependencies.
 *
 *   node .github/tests/run-tests.js
 *
 * 1. Assembler: every program in examples/ (plus the project starter) must assemble
 *    to exactly the bytes ASEM-51 produced. The .hex files in fixtures/ are that
 *    output, generated with ASEM-51 v1.3, the assembler inside MIDE-51.
 *
 * 2. Processor: running each fixture must reproduce the trace in fixtures/traces.json,
 *    which came from the Python emulator used to verify the course solutions
 *    (instructor/tools/emu8051.py).
 *
 * 3. Assembler details: operand forms and diagnostics the examples never exercise,
 *    checked against what ASEM-51 accepts and rejects.
 *
 * 4. Processor details: flags, ports, timer modes and interrupt sources, checked
 *    against the MCS-51 manual rather than against our own recorded traces. A
 *    trace only proves the two emulators still agree, not that either is right.
 *
 * Regenerating fixtures is an instructor job: see instructor/README.md, and
 * instructor/tools/make_traces.py for section 2.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const FIX = path.join(__dirname, "fixtures");

const Asm = require(path.join(ROOT, "assets/js/lab/asm8051.js")).EE390Asm;
const Emu = require(path.join(ROOT, "assets/js/lab/emu8051.js")).EE390Emu;

let failures = 0;
function fail(name, detail) {
  failures++;
  console.error("FAIL  " + name + "\n      " + detail);
}
function pass(name, detail) {
  console.log("ok    " + name + (detail ? "   " + detail : ""));
}

function hexToMap(text) {
  const map = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line[0] !== ":") continue;
    const b = [];
    for (let i = 1; i < line.length; i += 2) b.push(parseInt(line.substr(i, 2), 16));
    if (b[3] !== 0) continue;
    const addr = (b[1] << 8) | b[2];
    for (let j = 0; j < b[0]; j++) map[addr + j] = b[4 + j];
  }
  return map;
}

function sourceFor(name) {
  const candidates = [
    path.join(ROOT, "examples", name + ".asm"),
    path.join(ROOT, "files/starters", name + ".asm")
  ];
  return candidates.find(fs.existsSync);
}

/* ---------------------------------------------------------------- 1. assembler */

const fixtures = fs.readdirSync(FIX).filter(f => f.endsWith(".hex")).sort();
if (!fixtures.length) {
  fail("fixtures", "no .hex fixtures found in " + FIX);
}

for (const file of fixtures) {
  const name = file.replace(/\.hex$/, "");
  const src = sourceFor(name);
  if (!src) { fail("assemble " + name, "no matching .asm source found"); continue; }

  let res;
  try {
    res = Asm.assemble(fs.readFileSync(src, "latin1"));
  } catch (e) {
    fail("assemble " + name, "threw: " + e.message);
    continue;
  }
  if (res.errors.length) {
    fail("assemble " + name, res.errors.slice(0, 3)
      .map(e => "line " + e.line + ": " + e.message).join("\n      "));
    continue;
  }
  const ref = hexToMap(fs.readFileSync(path.join(FIX, file), "utf8"));
  const addrs = new Set([...Object.keys(ref), ...Object.keys(res.code)].map(Number));
  const diffs = [];
  for (const a of [...addrs].sort((x, y) => x - y)) {
    if (ref[a] !== res.code[a]) {
      diffs.push(a.toString(16).toUpperCase().padStart(4, "0") + ": ASEM-51=" +
        fmt(ref[a]) + " ours=" + fmt(res.code[a]));
      if (diffs.length >= 4) break;
    }
  }
  if (diffs.length) fail("assemble " + name, diffs.join("\n      "));
  else pass("assemble " + name, Object.keys(ref).length + " bytes match ASEM-51");
}

function fmt(v) { return v === undefined ? "--" : v.toString(16).toUpperCase().padStart(2, "0"); }

/* ---------------------------------------------------------------- 2. processor */

const tracePath = path.join(FIX, "traces.json");
if (!fs.existsSync(tracePath)) {
  fail("traces", "fixtures/traces.json is missing");
} else {
  const expected = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  const A = Emu.ADDR;
  for (const file of Object.keys(expected).sort()) {
    const want = expected[file];
    const hexPath = path.join(FIX, file);
    if (!fs.existsSync(hexPath)) { fail("run " + file, "fixture hex is missing"); continue; }
    const rom = Emu.loadHex(fs.readFileSync(hexPath, "utf8")).rom;
    const e = new Emu.Emu(rom);
    let bad = null;
    try {
      for (let i = 0; i < want.steps; i++) {
        if (i === 5000) e.pinsP3 = 0xFF & ~(1 << 1);
        if (i === 12000) e.pinsP3 = 0xFF & ~(1 << 2);
        if (i % want.sample === 0) {
          const got = [e.pc, e.sfr[A.ACC], e.sfr[A.PSW] & 0xFE, e.sfr[A.SP], e.cycles,
                       e.sfr[A.P0], e.sfr[A.P1], e.sfr[A.P2]];
          const exp = want.trace[i / want.sample];
          if (exp && got.join(",") !== exp.join(",")) {
            bad = "step " + i + ": expected [" + exp.join(", ") + "] got [" + got.join(", ") + "]" +
              "\n      (fields: PC, A, PSW, SP, cycles, P0, P1, P2)";
            break;
          }
        }
        e.step();
      }
    } catch (err) {
      bad = "threw at step: " + err.message;
    }
    if (!bad && e.cycles !== want.cycles) {
      bad = "cycle count drifted: expected " + want.cycles + ", got " + e.cycles;
    }
    if (bad) fail("run " + file, bad);
    else pass("run " + file, want.trace.length + " checkpoints, " + e.cycles + " cycles");
  }
}

/* ------------------------------------------------------- 3. assembler details */

{
  let checked = 0, wrong = 0;
  const bytesOf = src => {
    const res = Asm.assemble("ORG 0\n" + src + "\nEND\n");
    if (res.errors.length) return "error: " + res.errors[0].message;
    const out = [];
    for (let a = 0; a < 0x100 && res.code[a] !== undefined; a++) {
      out.push(res.code[a].toString(16).toUpperCase().padStart(2, "0"));
    }
    return out.join(" ");
  };
  const emits = (src, want) => {
    checked++;
    const got = bytesOf(src);
    if (got !== want) { wrong++; console.error("      " + src + "  ->  " + got + "   want " + want); }
  };
  const rejects = (src, why) => {
    checked++;
    const got = bytesOf(src);
    if (!got.startsWith("error:")) {
      wrong++;
      console.error("      " + src + "  ->  " + got + "   should be rejected (" + why + ")");
    }
  };

  /* Operand forms the examples happen not to use. */
  emits("JBC 20H,$", "10 20 FD");
  emits("ORL C,P1.0", "72 90");
  emits("ANL C,/P1.0", "B0 90");
  emits("ORL C,/P1.0", "A0 90");
  emits("MOV 30H,40H", "85 40 30");          // 85 src dst, not dst src
  emits("XCHD A,@R0", "D6");
  emits("MOVX A,@R0", "E2");
  emits("CJNE @R0,#55H,$", "B6 55 FD");
  emits("DJNZ 30H,$", "D5 30 FD");
  emits("JMP @A+DPTR", "73");
  emits("MOVC A,@A+PC", "83");

  /* Numbers and expressions. */
  emits("MOV A,#0FFH", "74 FF");
  emits("MOV A,#11111111B", "74 FF");
  emits("MOV A,#0377Q", "74 FF");
  emits("MOV A,#'A'", "74 41");
  emits("MOV A,#-1", "74 FF");
  emits("MOV A,#(2+3)*4", "74 14");
  emits("MOV A,#NOT 0", "74 FF");
  emits("MOV A,#HIGH(1234H)", "74 12");      // ASEM-51 has HIGH and LOW
  emits("MOV A,#LOW(1234H)", "74 34");
  emits("MOV A,#8 SHL 2", "74 20");
  emits("MOV A,#7 MOD 4", "74 03");
  emits("MOV A,#1 AND 2 + 3", "74 01");      // AND binds looser than +
  emits("MOV A,#N\nN EQU 5", "74 05");       // forward reference to an EQU
  emits("FLAG BIT P1.0\nSETB FLAG", "D2 90");

  /* Mistakes a student should be told about rather than silently miscompiled. */
  rejects("SJMP 0200H", "relative jump out of range");
  rejects("MOV A,R8", "there is no R8");
  rejects("MOV @R2,A", "only @R0 and @R1 exist");
  rejects("MOV A,#100H", "immediate does not fit in a byte");
  rejects("MOV A,300H", "direct address out of range");
  rejects("DB 100H", "byte out of range");
  rejects("XCH R0,A", "XCH exchanges with A");
  rejects("L: NOP\nL: NOP", "duplicate label");
  rejects("N EQU 1\nN EQU 2", "duplicate EQU");
  rejects("SETB P1", "P1 is a register, not a bit");
  rejects("CLR TCON", "TCON is a register, not a bit");
  rejects("MOV A,UNDEFINED", "unknown symbol");
  rejects("FOO A,B", "unknown instruction");

  if (wrong) fail("assembler details", wrong + " of " + checked + " checks wrong (above)");
  else pass("assembler details", checked + " operand forms and diagnostics");
}

/* ------------------------------------------------------- 4. processor details */

{
  const A = Emu.ADDR;
  let checked = 0, wrong = 0;
  const mk = bytes => {
    const rom = new Uint8Array(0x10000);
    bytes.forEach((b, i) => { rom[i] = b; });
    return new Emu.Emu(rom);
  };
  const is = (what, got, want) => {
    checked++;
    if (got !== want) {
      wrong++;
      console.error("      " + what + ": got 0x" + (got >>> 0).toString(16).toUpperCase() +
        " want 0x" + (want >>> 0).toString(16).toUpperCase());
    }
  };

  /* DA A against the algorithm in the manual, for every input. */
  let daWrong = 0;
  for (let a = 0; a < 256; a++) for (const cy of [0, 1]) for (const ac of [0, 1]) {
    let r = a, c = cy;
    if ((r & 0x0F) > 9 || ac) { r += 6; if (r > 0xFF) c = 1; }
    if (((r >> 4) & 0x0F) > 9 || c) { r += 0x60; c = 1; }
    const e = mk([0xD4]);
    e.sfr[A.ACC] = a;
    e.sfr[A.PSW] = (cy ? 0x80 : 0) | (ac ? 0x40 : 0);
    e.step();
    if (e.sfr[A.ACC] !== (r & 0xFF) || (e.sfr[A.PSW] >> 7) !== c) daWrong++;
  }
  is("DA A over all 1024 inputs", daWrong, 0);

  /* Flags. */
  { const e = mk([0x34, 0x01]); e.sfr[A.ACC] = 0x7F; e.step();
    is("ADDC sets OV on signed overflow", (e.sfr[A.PSW] >> 2) & 1, 1);
    is("ADDC sets AC on a nibble carry", (e.sfr[A.PSW] >> 6) & 1, 1); }
  { const e = mk([0x94, 0x01]); e.sfr[A.ACC] = 0x80; e.step();
    is("SUBB sets OV on signed overflow", (e.sfr[A.PSW] >> 2) & 1, 1); }
  { const e = mk([0xA4]); e.sfr[A.ACC] = 0x50; e.sfr[A.B] = 0xA0; e.sfr[A.PSW] = 0x80; e.step();
    is("MUL leaves the high byte in B", e.sfr[A.B], 0x32);
    is("MUL sets OV when the product is wide", (e.sfr[A.PSW] >> 2) & 1, 1);
    is("MUL clears CY", e.sfr[A.PSW] >> 7, 0); }
  { const e = mk([0x84]); e.sfr[A.ACC] = 0x12; e.sfr[A.B] = 0; e.step();
    is("DIV by zero sets OV", (e.sfr[A.PSW] >> 2) & 1, 1); }

  /* Ports: pins are readable, and read-modify-write uses the latch. */
  { const e = mk([0xE5, 0x90]); e.pinsP1 = 0x7F; e.step();
    is("MOV A,P1 sees the pins", e.sfr[A.ACC], 0x7F); }
  { const e = mk([0x05, 0xB0]); e.pinsP3 = 0x00; e.step();
    is("INC P3 reads the latch, not the pins", e.sfr[A.P3], 0x00); }
  { const e = mk([0x52, 0xB0]); e.pinsP3 = 0x0F; e.sfr[A.ACC] = 0xF0; e.step();
    is("ANL P3,A reads the latch", e.sfr[A.P3], 0xF0); }
  { const e = mk([0xC5, 0xB0]); e.sfr[A.P3] = 0xAA; e.pinsP3 = 0x0F; e.sfr[A.ACC] = 0x11; e.step();
    is("XCH A,P3 is not read-modify-write, so it reads the pins", e.sfr[A.ACC], 0x0A); }
  { const e = mk([0xF2]); e.sfr[A.P2] = 0x12; e.iram[0] = 0x34; e.sfr[A.ACC] = 0x77; e.step();
    is("MOVX @Ri takes its page from P2", e.xram[0x1234], 0x77); }

  /* Timer modes, the C/T input and the GATE input. */
  { const e = mk([0x00]); e.sfr[A.TMOD] = 0x01; e.sfr[A.TCON] = 0x10;
    e.sfr[A.TH0] = 0xFF; e.sfr[A.TL0] = 0xFF; e.step();
    is("mode 1 is 16-bit", (e.sfr[A.TCON] >> 5) & 1, 1); }
  { const e = mk([0x00]); e.sfr[A.TMOD] = 0x00; e.sfr[A.TCON] = 0x10;
    e.sfr[A.TH0] = 0xFF; e.sfr[A.TL0] = 0x1F; e.step();
    is("mode 0 is 13-bit", (e.sfr[A.TCON] >> 5) & 1, 1); }
  { const e = mk([0x00]); e.sfr[A.TMOD] = 0x02; e.sfr[A.TCON] = 0x10;
    e.sfr[A.TH0] = 0x50; e.sfr[A.TL0] = 0xFF; e.step();
    is("mode 2 reloads TL0 from TH0", e.sfr[A.TL0], 0x50); }
  { const e = mk([0x00]); e.sfr[A.TMOD] = 0x03; e.sfr[A.TCON] = 0x10; e.sfr[A.TL0] = 0xFF; e.step();
    is("mode 3 runs TL0 as an 8-bit timer", (e.sfr[A.TCON] >> 5) & 1, 1); }
  { const e = mk([0x00, 0x00, 0x00]); e.sfr[A.TMOD] = 0x05; e.sfr[A.TCON] = 0x10;
    e.step(); e.step(); e.step();
    is("C/T = 1 counts pin edges, not machine cycles", e.sfr[A.TL0], 0); }
  { const e = mk([0x00, 0x00]); e.sfr[A.TMOD] = 0x09; e.sfr[A.TCON] = 0x10;
    e.pinsP3 = 0xFF & ~0x04; e.step(); e.step();
    is("GATE = 1 holds the timer while INT0 is low", e.sfr[A.TL0], 0); }

  /* All five interrupt sources, in the right order. */
  { const e = mk([0x00, 0x00, 0x00]); e.sfr[A.IE] = 0x81; e.sfr[A.TCON] = 0x01;
    e.step(); e.pinsP3 = 0xFF & ~0x04; e.step();
    is("a falling edge on INT0 sets IE0", (e.sfr[A.TCON] >> 1) & 1, 1);
    e.step();
    is("INT0 vectors to 0003H", e.pc, 0x0003); }
  { const e = mk([0x00, 0x00, 0x00]); e.sfr[A.IE] = 0x84; e.sfr[A.TCON] = 0x04;
    e.step(); e.pinsP3 = 0xFF & ~0x08; e.step(); e.step();
    is("INT1 vectors to 0013H", e.pc, 0x0013); }
  { const e = mk([0x00]); e.sfr[A.IE] = 0x90; e.sfr[A.SCON] = 0x02; e.step();
    is("a serial flag vectors to 0023H", e.pc, 0x0023); }
  { const e = mk([0x00]); e.sfr[A.IE] = 0x83; e.sfr[A.TCON] = 0x22; e.step();
    is("IE0 outranks TF0 at the same priority", e.pc, 0x0003); }
  { const e = mk([0x00]); e.sfr[A.IE] = 0x83; e.sfr[A.TCON] = 0x22; e.sfr[A.IP] = 0x02; e.step();
    is("IP lifts TF0 above IE0", e.pc, 0x000B); }
  { const rom = new Uint8Array(0x10000); rom[0x0B] = 0x32;      // RETI
    const e = new Emu.Emu(rom); e.sfr[A.IE] = 0x82; e.sfr[A.TCON] = 0x20;
    e.step();
    is("Timer 0 vectors to 000BH", e.pc, 0x000B);
    e.sfr[A.TCON] |= 0x20; e.step(); e.step();
    is("one instruction runs after RETI", e.pc, 0x0001); }

  if (wrong) fail("processor details", wrong + " of " + checked + " checks wrong (above)");
  else pass("processor details", checked + " checks against the MCS-51 manual");
}

console.log("");
if (failures) {
  console.error(failures + " test(s) failed.");
  process.exit(1);
}
console.log("All simulator tests passed.");
