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
 * Regenerating fixtures is an instructor job: see instructor/README.md.
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

console.log("");
if (failures) {
  console.error(failures + " test(s) failed.");
  process.exit(1);
}
console.log("All simulator tests passed.");
