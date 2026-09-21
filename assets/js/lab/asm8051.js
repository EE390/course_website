/* 8051 assembler for the EE 390 lab simulator.
 *
 * Intel/ASEM-51 syntax, so the course examples and the project starter assemble
 * unchanged: labels, ORG, EQU, DATA, BIT, CODE, DB, DW, DS, END, "$", numbers as
 * 0FFH / 1010B / 65 / 'A', and the full MCS-51 instruction set.
 *
 * Every example in examples/ is assembled by the test page and compared byte for
 * byte against ASEM-51 output, which is what keeps this honest.
 */
(function (global) {
  "use strict";

  var SFR = {
    P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, PCON: 0x87, TCON: 0x88, TMOD: 0x89,
    TL0: 0x8A, TL1: 0x8B, TH0: 0x8C, TH1: 0x8D, AUXR: 0x8E, P1: 0x90, SCON: 0x98,
    SBUF: 0x99, P2: 0xA0, AUXR1: 0xA2, IE: 0xA8, P3: 0xB0, IP: 0xB8, T2CON: 0xC8,
    T2MOD: 0xC9, RCAP2L: 0xCA, RCAP2H: 0xCB, TL2: 0xCC, TH2: 0xCD, PSW: 0xD0,
    ACC: 0xE0, B: 0xF0
  };

  var BIT = {
    /* TCON */ IT0: 0x88, IE0: 0x89, IT1: 0x8A, IE1: 0x8B, TR0: 0x8C, TF0: 0x8D, TR1: 0x8E, TF1: 0x8F,
    /* SCON */ RI: 0x98, TI: 0x99, RB8: 0x9A, TB8: 0x9B, REN: 0x9C, SM2: 0x9D, SM1: 0x9E, SM0: 0x9F,
    /* IE   */ EX0: 0xA8, ET0: 0xA9, EX1: 0xAA, ET1: 0xAB, ES: 0xAC, ET2: 0xAD, EA: 0xAF,
    /* IP   */ PX0: 0xB8, PT0: 0xB9, PX1: 0xBA, PT1: 0xBB, PS: 0xBC, PT2: 0xBD,
    /* PSW  */ P: 0xD0, OV: 0xD2, RS0: 0xD3, RS1: 0xD4, F0: 0xD5, AC: 0xD6, CY: 0xD7,
    /* T2CON*/ CPRL2: 0xC8, CT2: 0xC9, TR2: 0xCA, EXEN2: 0xCB, TCLK: 0xCC, RCLK: 0xCD,
    EXF2: 0xCE, TF2: 0xCF, T2: 0x90, T2EX: 0x91,
    /* P3 alternates */ RXD: 0xB0, TXD: 0xB1, INT0: 0xB2, INT1: 0xB3, T0: 0xB4, T1: 0xB5,
    WR: 0xB6, RD: 0xB7
  };

  /* Predefined in ASEM-51's .mcu files, so code may jump to RESET or TIMER0 by name. */
  var VECT = { RESET: 0x0000, EXTI0: 0x0003, TIMER0: 0x000B, EXTI1: 0x0013,
               TIMER1: 0x001B, SINT: 0x0023, TIMER2: 0x002B };

  function AsmError(msg, line) {
    this.message = msg;
    this.line = line;
    this.name = "AsmError";
  }
  AsmError.prototype = Object.create(Error.prototype);

  /* ---------------------------------------------------------------- lexing */

  /* Strip a comment, respecting quoted strings. */
  function stripComment(line) {
    var q = null, out = "";
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        out += c;
        if (c === q) q = null;
      } else if (c === "'" || c === '"') {
        q = c; out += c;
      } else if (c === ";") {
        break;
      } else out += c;
    }
    return out;
  }

  function splitOperands(s) {
    var parts = [], cur = "", q = null;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) {
        cur += c;
        if (c === q) q = null;
      } else if (c === "'" || c === '"') {
        q = c; cur += c;
      } else if (c === ",") {
        parts.push(cur.trim()); cur = "";
      } else cur += c;
    }
    if (cur.trim() !== "" || parts.length) parts.push(cur.trim());
    return parts.filter(function (p, idx) { return !(p === "" && idx === parts.length - 1 && parts.length === 1); });
  }

  /* ---------------------------------------------------------------- numbers and expressions */

  function parseAtom(tok, ctx) {
    var t = tok.trim();
    if (t === "$") return ctx.pc;
    var m;
    if ((m = /^'(.)'$/.exec(t))) return t.charCodeAt(1);
    if ((m = /^0[xX]([0-9A-Fa-f]+)$/.exec(t))) return parseInt(m[1], 16);
    if ((m = /^([0-9][0-9A-Fa-f]*)[Hh]$/.exec(t))) return parseInt(m[1], 16);
    if ((m = /^([01]+)[Bb]$/.exec(t))) return parseInt(m[1], 2);
    if ((m = /^([0-7]+)[Oo Qq]$/.exec(t))) return parseInt(m[1], 8);
    if ((m = /^([0-9]+)[Dd]?$/.exec(t))) return parseInt(m[1], 10);
    /* name.bit  (P2.5, ACC.7, 20H.3) */
    if ((m = /^(.+)\.([0-7])$/.exec(t))) {
      var base = parseAtom(m[1], ctx), n = parseInt(m[2], 10);
      if (base >= 0x80) {
        if (base % 8) throw new AsmError("'" + m[1] + "' is not a bit-addressable register", ctx.line);
        return base + n;
      }
      if (base < 0x20 || base > 0x2F) throw new AsmError("'" + m[1] + "' is not bit addressable", ctx.line);
      return (base - 0x20) * 8 + n;
    }
    var up = t.toUpperCase();
    if (ctx.symbols.hasOwnProperty(up)) {
      var s = ctx.symbols[up];
      if (s.value === null) throw new AsmError("symbol '" + t + "' used before it is defined", ctx.line);
      return s.value;
    }
    if (SFR.hasOwnProperty(up)) return SFR[up];
    if (BIT.hasOwnProperty(up)) return BIT[up];
    if (VECT.hasOwnProperty(up)) return VECT[up];
    if (ctx.pass === 1 && /^[A-Za-z_?][A-Za-z0-9_?]*$/.test(t)) return 0;   // forward reference
    throw new AsmError("unknown symbol '" + t + "'", ctx.line);
  }

  /* +, -, *, /, parentheses, and the usual bitwise operators */
  function evalExpr(src, ctx) {
    var s = String(src).trim();
    if (s === "") throw new AsmError("missing value", ctx.line);
    var pos = 0;

    function skip() { while (pos < s.length && /\s/.test(s[pos])) pos++; }

    function primary() {
      skip();
      if (s[pos] === "(") {
        pos++;
        var v = expr();
        skip();
        if (s[pos] !== ")") throw new AsmError("missing ')'", ctx.line);
        pos++;
        return v;
      }
      if (s[pos] === "-") { pos++; return -primary(); }
      if (s[pos] === "+") { pos++; return primary(); }
      if (/^NOT\b/i.test(s.slice(pos))) { pos += 3; return ~primary(); }
      var start = pos;
      if (s[pos] === "'") {                       // character literal
        pos++;
        while (pos < s.length && s[pos] !== "'") pos++;
        pos++;
        return parseAtom(s.slice(start, pos), ctx);
      }
      while (pos < s.length && !/[+\-*\/()&|^\s]/.test(s[pos])) pos++;
      if (start === pos) throw new AsmError("cannot parse '" + s + "'", ctx.line);
      return parseAtom(s.slice(start, pos), ctx);
    }

    function term() {
      var v = primary();
      for (;;) {
        skip();
        var c = s[pos];
        if (c === "*") { pos++; v = v * primary(); }
        else if (c === "/") { pos++; var d = primary(); v = d ? Math.floor(v / d) : 0; }
        else if (/^MOD\b/i.test(s.slice(pos))) { pos += 3; v = v % primary(); }
        else if (/^SHL\b/i.test(s.slice(pos))) { pos += 3; v = v << primary(); }
        else if (/^SHR\b/i.test(s.slice(pos))) { pos += 3; v = v >> primary(); }
        else return v;
      }
    }

    function expr() {
      var v = term();
      for (;;) {
        skip();
        var c = s[pos];
        if (c === "+") { pos++; v = v + term(); }
        else if (c === "-") { pos++; v = v - term(); }
        else if (c === "&") { pos++; v = v & term(); }
        else if (c === "|") { pos++; v = v | term(); }
        else if (c === "^") { pos++; v = v ^ term(); }
        else if (/^AND\b/i.test(s.slice(pos))) { pos += 3; v = v & term(); }
        else if (/^OR\b/i.test(s.slice(pos))) { pos += 2; v = v | term(); }
        else if (/^XOR\b/i.test(s.slice(pos))) { pos += 3; v = v ^ term(); }
        else return v;
      }
    }

    var val = expr();
    skip();
    if (pos !== s.length) throw new AsmError("cannot parse '" + s + "'", ctx.line);
    return val;
  }

  /* ---------------------------------------------------------------- operands */

  var REG = /^R([0-7])$/i;
  var IREG = /^@R([01])$/i;

  function operandKind(op) {
    var t = op.trim(), m;
    var up = t.toUpperCase();
    if (up === "A") return { k: "A" };
    if (up === "C") return { k: "C" };
    if (up === "AB") return { k: "AB" };
    if (up === "DPTR") return { k: "DPTR" };
    if (up === "@DPTR") return { k: "@DPTR" };
    if (up.replace(/\s+/g, "") === "@A+DPTR") return { k: "@A+DPTR" };
    if (up.replace(/\s+/g, "") === "@A+PC") return { k: "@A+PC" };
    if ((m = REG.exec(t))) return { k: "R", n: +m[1] };
    if ((m = IREG.exec(t))) return { k: "@R", n: +m[1] };
    if (t[0] === "#") return { k: "#", expr: t.slice(1) };
    if (t[0] === "/") return { k: "/bit", expr: t.slice(1) };
    return { k: "direct", expr: t };
  }

  /* ---------------------------------------------------------------- instruction table
   * Each entry: function(ops, ctx) -> array of byte producers.
   * Sizes must be identical in both passes, so they never depend on symbol values.
   */
  function byteOf(v) { return v & 0xFF; }

  function rel(target, nextPc, ctx) {
    var d = target - nextPc;
    if (ctx.pass === 2 && (d < -128 || d > 127)) {
      throw new AsmError("jump is " + d + " bytes away; the limit is -128..127", ctx.line);
    }
    return d & 0xFF;
  }

  var OPS = {};

  function simple(mn, opcode) { OPS[mn] = function () { return [opcode]; }; }
  simple("NOP", 0x00); simple("RET", 0x22); simple("RETI", 0x32);
  simple("RR", 0x03); simple("RRC", 0x13); simple("RL", 0x23); simple("RLC", 0x33);
  simple("SWAP", 0xC4); simple("DA", 0xD4); simple("MUL", 0xA4); simple("DIV", 0x84);

  /* accumulator-operand families: A,#imm / A,dir / A,@Ri / A,Rn */
  function family(mn, immOp, dirOp, iriOp, regOp) {
    OPS[mn] = function (ops, ctx) {
      var a = operandKind(ops[0]), b = operandKind(ops[1]);
      if (a.k === "A") {
        if (b.k === "#") return [immOp, byteOf(evalExpr(b.expr, ctx))];
        if (b.k === "R") return [regOp + b.n];
        if (b.k === "@R") return [iriOp + b.n];
        if (b.k === "direct") return [dirOp, byteOf(evalExpr(b.expr, ctx))];
      }
      throw new AsmError(mn + " cannot take these operands", ctx.line);
    };
  }
  family("ADD", 0x24, 0x25, 0x26, 0x28);
  family("ADDC", 0x34, 0x35, 0x36, 0x38);
  family("SUBB", 0x94, 0x95, 0x96, 0x98);

  /* ANL / ORL / XRL, which also take dir,A  dir,#imm  and (ANL/ORL) C,bit */
  function logic(mn, immOp, dirOp, iriOp, regOp, dirAOp, dirImmOp, cBitOp, cNotBitOp) {
    OPS[mn] = function (ops, ctx) {
      var a = operandKind(ops[0]), b = operandKind(ops[1]);
      if (a.k === "A") {
        if (b.k === "#") return [immOp, byteOf(evalExpr(b.expr, ctx))];
        if (b.k === "R") return [regOp + b.n];
        if (b.k === "@R") return [iriOp + b.n];
        if (b.k === "direct") return [dirOp, byteOf(evalExpr(b.expr, ctx))];
      }
      if (a.k === "C" && cBitOp !== undefined) {
        if (b.k === "/bit") return [cNotBitOp, byteOf(evalExpr(b.expr, ctx))];
        return [cBitOp, byteOf(evalExpr(b.expr, ctx))];
      }
      if (a.k === "direct") {
        if (b.k === "A") return [dirAOp, byteOf(evalExpr(a.expr, ctx))];
        if (b.k === "#") return [dirImmOp, byteOf(evalExpr(a.expr, ctx)), byteOf(evalExpr(b.expr, ctx))];
      }
      throw new AsmError(mn + " cannot take these operands", ctx.line);
    };
  }
  logic("ANL", 0x54, 0x55, 0x56, 0x58, 0x52, 0x53, 0x82, 0xB0);
  logic("ORL", 0x44, 0x45, 0x46, 0x48, 0x42, 0x43, 0x72, 0xA0);
  logic("XRL", 0x64, 0x65, 0x66, 0x68, 0x62, 0x63);

  OPS.MOV = function (ops, ctx) {
    var a = operandKind(ops[0]), b = operandKind(ops[1]);
    if (a.k === "A") {
      if (b.k === "#") return [0x74, byteOf(evalExpr(b.expr, ctx))];
      if (b.k === "R") return [0xE8 + b.n];
      if (b.k === "@R") return [0xE6 + b.n];
      if (b.k === "direct") return [0xE5, byteOf(evalExpr(b.expr, ctx))];
    }
    if (a.k === "R") {
      if (b.k === "A") return [0xF8 + a.n];
      if (b.k === "#") return [0x78 + a.n, byteOf(evalExpr(b.expr, ctx))];
      if (b.k === "direct") return [0xA8 + a.n, byteOf(evalExpr(b.expr, ctx))];
    }
    if (a.k === "@R") {
      if (b.k === "A") return [0xF6 + a.n];
      if (b.k === "#") return [0x76 + a.n, byteOf(evalExpr(b.expr, ctx))];
      if (b.k === "direct") return [0xA6 + a.n, byteOf(evalExpr(b.expr, ctx))];
    }
    if (a.k === "DPTR" && b.k === "#") {
      var v = evalExpr(b.expr, ctx);
      return [0x90, (v >> 8) & 0xFF, v & 0xFF];
    }
    if (a.k === "C" && b.k === "direct") return [0xA2, byteOf(evalExpr(b.expr, ctx))];
    if (a.k === "direct" && b.k === "C") return [0x92, byteOf(evalExpr(a.expr, ctx))];
    if (a.k === "direct") {
      if (b.k === "A") return [0xF5, byteOf(evalExpr(a.expr, ctx))];
      if (b.k === "R") return [0x88 + b.n, byteOf(evalExpr(a.expr, ctx))];
      if (b.k === "@R") return [0x86 + b.n, byteOf(evalExpr(a.expr, ctx))];
      if (b.k === "#") return [0x75, byteOf(evalExpr(a.expr, ctx)), byteOf(evalExpr(b.expr, ctx))];
      if (b.k === "direct") return [0x85, byteOf(evalExpr(b.expr, ctx)), byteOf(evalExpr(a.expr, ctx))];
    }
    throw new AsmError("MOV cannot take these operands", ctx.line);
  };

  OPS.MOVC = function (ops, ctx) {
    var a = operandKind(ops[0]), b = operandKind(ops[1]);
    if (a.k === "A" && b.k === "@A+DPTR") return [0x93];
    if (a.k === "A" && b.k === "@A+PC") return [0x83];
    throw new AsmError("MOVC needs A,@A+DPTR or A,@A+PC", ctx.line);
  };

  OPS.MOVX = function (ops, ctx) {
    var a = operandKind(ops[0]), b = operandKind(ops[1]);
    if (a.k === "A" && b.k === "@DPTR") return [0xE0];
    if (a.k === "A" && b.k === "@R") return [0xE2 + b.n];
    if (a.k === "@DPTR" && b.k === "A") return [0xF0];
    if (a.k === "@R" && b.k === "A") return [0xF2 + a.n];
    throw new AsmError("MOVX cannot take these operands", ctx.line);
  };

  function incdec(mn, aOp, dirOp, iriOp, regOp, dptrOp) {
    OPS[mn] = function (ops, ctx) {
      var a = operandKind(ops[0]);
      if (a.k === "A") return [aOp];
      if (a.k === "R") return [regOp + a.n];
      if (a.k === "@R") return [iriOp + a.n];
      if (a.k === "DPTR" && dptrOp !== undefined) return [dptrOp];
      if (a.k === "direct") return [dirOp, byteOf(evalExpr(a.expr, ctx))];
      throw new AsmError(mn + " cannot take this operand", ctx.line);
    };
  }
  incdec("INC", 0x04, 0x05, 0x06, 0x08, 0xA3);
  incdec("DEC", 0x14, 0x15, 0x16, 0x18);

  function bitop(mn, aOp, cOp, bitOp) {
    OPS[mn] = function (ops, ctx) {
      var a = operandKind(ops[0]);
      if (a.k === "A" && aOp !== undefined) return [aOp];
      if (a.k === "C") return [cOp];
      if (a.k === "direct") return [bitOp, byteOf(evalExpr(a.expr, ctx))];
      throw new AsmError(mn + " cannot take this operand", ctx.line);
    };
  }
  bitop("CLR", 0xE4, 0xC3, 0xC2);
  bitop("CPL", 0xF4, 0xB3, 0xB2);
  bitop("SETB", undefined, 0xD3, 0xD2);

  OPS.PUSH = function (ops, ctx) { return [0xC0, byteOf(evalExpr(operandKind(ops[0]).expr, ctx))]; };
  OPS.POP = function (ops, ctx) { return [0xD0, byteOf(evalExpr(operandKind(ops[0]).expr, ctx))]; };

  OPS.XCH = function (ops, ctx) {
    var b = operandKind(ops[1]);
    if (b.k === "R") return [0xC8 + b.n];
    if (b.k === "@R") return [0xC6 + b.n];
    if (b.k === "direct") return [0xC5, byteOf(evalExpr(b.expr, ctx))];
    throw new AsmError("XCH cannot take these operands", ctx.line);
  };
  OPS.XCHD = function (ops, ctx) {
    var b = operandKind(ops[1]);
    if (b.k === "@R") return [0xD6 + b.n];
    throw new AsmError("XCHD needs A,@Ri", ctx.line);
  };

  OPS.LJMP = function (ops, ctx) {
    var v = evalExpr(ops[0], ctx);
    return [0x02, (v >> 8) & 0xFF, v & 0xFF];
  };
  OPS.LCALL = function (ops, ctx) {
    var v = evalExpr(ops[0], ctx);
    return [0x12, (v >> 8) & 0xFF, v & 0xFF];
  };

  function short11(mn, base) {
    OPS[mn] = function (ops, ctx) {
      var target = evalExpr(ops[0], ctx);
      var next = ctx.pc + 2;
      if (ctx.pass === 2 && ((target & 0xF800) !== (next & 0xF800))) {
        throw new AsmError(mn + " can only reach addresses in the same 2K page; use " +
          (mn === "AJMP" ? "LJMP" : "LCALL"), ctx.line);
      }
      return [base | ((target & 0x0700) >> 3), target & 0xFF];
    };
  }
  short11("AJMP", 0x01);
  short11("ACALL", 0x11);

  OPS.SJMP = function (ops, ctx) { return [0x80, rel(evalExpr(ops[0], ctx), ctx.pc + 2, ctx)]; };
  OPS.JMP = function (ops, ctx) {
    if (operandKind(ops[0]).k === "@A+DPTR") return [0x73];
    throw new AsmError("JMP needs @A+DPTR (did you mean SJMP, AJMP or LJMP?)", ctx.line);
  };

  function condRel(mn, opcode) {
    OPS[mn] = function (ops, ctx) { return [opcode, rel(evalExpr(ops[0], ctx), ctx.pc + 2, ctx)]; };
  }
  condRel("JC", 0x40); condRel("JNC", 0x50); condRel("JZ", 0x60); condRel("JNZ", 0x70);

  function bitRel(mn, opcode) {
    OPS[mn] = function (ops, ctx) {
      return [opcode, byteOf(evalExpr(ops[0], ctx)), rel(evalExpr(ops[1], ctx), ctx.pc + 3, ctx)];
    };
  }
  bitRel("JB", 0x20); bitRel("JNB", 0x30); bitRel("JBC", 0x10);

  OPS.DJNZ = function (ops, ctx) {
    var a = operandKind(ops[0]);
    if (a.k === "R") return [0xD8 + a.n, rel(evalExpr(ops[1], ctx), ctx.pc + 2, ctx)];
    if (a.k === "direct") {
      return [0xD5, byteOf(evalExpr(a.expr, ctx)), rel(evalExpr(ops[1], ctx), ctx.pc + 3, ctx)];
    }
    throw new AsmError("DJNZ cannot take these operands", ctx.line);
  };

  OPS.CJNE = function (ops, ctx) {
    var a = operandKind(ops[0]), b = operandKind(ops[1]);
    var target = ops[2];
    if (a.k === "A" && b.k === "#") {
      return [0xB4, byteOf(evalExpr(b.expr, ctx)), rel(evalExpr(target, ctx), ctx.pc + 3, ctx)];
    }
    if (a.k === "A" && b.k === "direct") {
      return [0xB5, byteOf(evalExpr(b.expr, ctx)), rel(evalExpr(target, ctx), ctx.pc + 3, ctx)];
    }
    if (a.k === "R" && b.k === "#") {
      return [0xB8 + a.n, byteOf(evalExpr(b.expr, ctx)), rel(evalExpr(target, ctx), ctx.pc + 3, ctx)];
    }
    if (a.k === "@R" && b.k === "#") {
      return [0xB6 + a.n, byteOf(evalExpr(b.expr, ctx)), rel(evalExpr(target, ctx), ctx.pc + 3, ctx)];
    }
    throw new AsmError("CJNE cannot take these operands", ctx.line);
  };

  /* ---------------------------------------------------------------- assembling */

  var DIRECTIVES = { ORG: 1, EQU: 1, SET: 1, DATA: 1, BIT: 1, CODE: 1, XDATA: 1, IDATA: 1,
                     DB: 1, DW: 1, DS: 1, END: 1, USING: 1 };

  function dataBytes(operandText, ctx, wordSize) {
    var out = [];
    splitOperands(operandText).forEach(function (item) {
      var t = item.trim();
      var m = /^'([^']*)'$/.exec(t) || /^"([^"]*)"$/.exec(t);
      if (m && (m[1].length !== 1 || wordSize === 1)) {
        for (var i = 0; i < m[1].length; i++) out.push(m[1].charCodeAt(i) & 0xFF);
        return;
      }
      var v = evalExpr(t, ctx);
      if (wordSize === 2) { out.push((v >> 8) & 0xFF); out.push(v & 0xFF); }
      else out.push(v & 0xFF);
    });
    return out;
  }

  function assemble(source) {
    var lines = String(source).replace(/\r\n?/g, "\n").split("\n");
    var symbols = {};
    var errors = [];
    var parsed = [];

    /* ---- split every line once ---- */
    lines.forEach(function (raw, idx) {
      var text = stripComment(raw);
      var rec = { n: idx + 1, raw: raw, label: null, mn: null, ops: [], opText: "" };
      var m = /^\s*([A-Za-z_?][A-Za-z0-9_?]*)\s*:/.exec(text);
      if (m) { rec.label = m[1].toUpperCase(); text = text.slice(m[0].length); }
      text = text.trim();
      if (text) {
        var parts = /^([A-Za-z_?][A-Za-z0-9_?]*)(\s+([\s\S]*))?$/.exec(text);
        if (parts) {
          var word = parts[1].toUpperCase();
          var rest = (parts[3] || "").trim();
          /* "NAME EQU value" style: the name sits where a mnemonic would */
          var restWord = /^([A-Za-z_?][A-Za-z0-9_?]*)(\s+([\s\S]*))?$/.exec(rest);
          if (restWord && DIRECTIVES[restWord[1].toUpperCase()] &&
              !OPS[word] && !DIRECTIVES[word]) {
            rec.label = word;
            rec.mn = restWord[1].toUpperCase();
            rec.opText = (restWord[3] || "").trim();
          } else {
            rec.mn = word;
            rec.opText = rest;
          }
        } else {
          rec.mn = text.toUpperCase();
        }
        rec.ops = splitOperands(rec.opText);
      }
      parsed.push(rec);
    });

    /* ---- two passes ---- */
    var code = {};          // address -> byte
    var top = -1, ended = false;

    function runPass(pass) {
      var pc = 0;
      ended = false;
      for (var i = 0; i < parsed.length; i++) {
        var rec = parsed[i];
        if (ended) break;
        var ctx = { pc: pc, pass: pass, symbols: symbols, line: rec.n };
        try {
          var mn = rec.mn;
          /* value-defining directives bind the label to a value, not to the PC */
          if (mn === "EQU" || mn === "SET" || mn === "DATA" || mn === "BIT" ||
              mn === "CODE" || mn === "XDATA" || mn === "IDATA") {
            if (!rec.label) throw new AsmError(mn + " needs a name in front of it", rec.n);
            var val = evalExpr(rec.opText, ctx);
            if (pass === 1 && symbols.hasOwnProperty(rec.label) && mn !== "SET") {
              throw new AsmError("'" + rec.label + "' is defined more than once", rec.n);
            }
            symbols[rec.label] = { value: val, kind: mn.toLowerCase() };
            continue;
          }
          if (rec.label) {
            if (pass === 1) {
              if (symbols.hasOwnProperty(rec.label)) {
                throw new AsmError("'" + rec.label + "' is defined more than once", rec.n);
              }
              symbols[rec.label] = { value: pc, kind: "label" };
            } else {
              symbols[rec.label] = { value: pc, kind: "label" };
            }
          }
          if (!mn) continue;

          if (mn === "ORG") { pc = evalExpr(rec.opText, ctx) & 0xFFFF; continue; }
          if (mn === "END") { ended = true; continue; }
          if (mn === "USING") { continue; }
          if (mn === "DS") { pc = (pc + evalExpr(rec.opText, ctx)) & 0xFFFF; continue; }
          if (mn === "DB" || mn === "DW") {
            var bytes = dataBytes(rec.opText, ctx, mn === "DB" ? 1 : 2);
            if (pass === 2) {
              for (var k = 0; k < bytes.length; k++) {
                code[(pc + k) & 0xFFFF] = bytes[k];
                top = Math.max(top, (pc + k) & 0xFFFF);
              }
            }
            rec.bytes = bytes;
            rec.addr = pc;
            pc = (pc + bytes.length) & 0xFFFF;
            continue;
          }

          var fn = OPS[mn];
          if (!fn) throw new AsmError("unknown instruction '" + rec.mn + "'", rec.n);
          var emitted = fn(rec.ops, ctx);
          if (pass === 2) {
            for (var j = 0; j < emitted.length; j++) {
              code[(pc + j) & 0xFFFF] = emitted[j] & 0xFF;
              top = Math.max(top, (pc + j) & 0xFFFF);
            }
          }
          rec.bytes = emitted;
          rec.addr = pc;
          pc = (pc + emitted.length) & 0xFFFF;
        } catch (e) {
          if (pass === 2 || !(e instanceof AsmError)) {
            errors.push({ line: rec.n, message: e.message, text: rec.raw });
            /* keep going so the student sees every error at once */
            rec.bytes = rec.bytes || [];
            rec.addr = pc;
          }
          if (pass === 1) {
            /* size still matters in pass 1; assume the worst case of 3 bytes */
            if (rec.mn && !DIRECTIVES[rec.mn]) pc = (pc + 3) & 0xFFFF;
          }
        }
      }
    }

    runPass(1);
    if (!errors.length) runPass(2);

    return {
      errors: errors,
      symbols: symbols,
      lines: parsed,
      code: code,
      top: top,
      hex: toIntelHex(code, top),
      bytesUsed: Object.keys(code).length
    };
  }

  function toIntelHex(code, top) {
    var addrs = Object.keys(code).map(Number).sort(function (a, b) { return a - b; });
    var out = [], i = 0;
    while (i < addrs.length) {
      var start = addrs[i], rec = [];
      while (i < addrs.length && addrs[i] === start + rec.length && rec.length < 16) {
        rec.push(code[addrs[i]]); i++;
      }
      var sum = rec.length + ((start >> 8) & 0xFF) + (start & 0xFF);
      var line = ":" + hx(rec.length) + hx((start >> 8) & 0xFF) + hx(start & 0xFF) + "00";
      for (var j = 0; j < rec.length; j++) { line += hx(rec[j]); sum += rec[j]; }
      line += hx((-sum) & 0xFF);
      out.push(line);
    }
    out.push(":00000001FF");
    return out.join("\n") + "\n";
  }

  function hx(v) { return ("0" + (v & 0xFF).toString(16).toUpperCase()).slice(-2); }

  global.EE390Asm = { assemble: assemble, SFR: SFR, BIT: BIT, VECT: VECT, toIntelHex: toIntelHex };
})(typeof window !== "undefined" ? window
  : (typeof module !== "undefined" && module.exports) ? module.exports : this);
