// EE 390 — Mini Project 2 (Bird Song Synthesizer): target-sound plots and audio preview.
// Plots and previews use the specified frequencies (the target), not board reload values.

(function () {
  var STEP_MS = 5;

  // Keep in sync with instructor/tools/birds.py and the specification table on the page.
  // segment: {type:"sweep", f1, f2, ms, step, curve} | {type:"tone", f, ms} | {type:"rest", ms}
  var CURVES = {
    linear: function (u) { return u; },
    fast: function (u) { return 1 - (1 - u) * (1 - u); },
    slow: function (u) { return u * u; }
  };
  function repeat(n, segs) { var out = []; for (var i = 0; i < n; i++) out = out.concat(segs); return out; }
  function rest(ms) { return { type: "rest", ms: ms }; }

  var CHEEP = [
    { type: "sweep", f1: 3000, f2: 4400, ms: 30, step: 5, curve: "fast" },
    { type: "sweep", f1: 4400, f2: 3200, ms: 40, step: 5, curve: "slow" }
  ];
  var CHEER = [{ type: "sweep", f1: 4400, f2: 2000, ms: 150, step: 5, curve: "fast" }];

  var BIRDS = {
    CHEEP: [].concat(CHEEP, rest(110), CHEEP, rest(160), CHEEP),
    CARDINAL: [].concat(CHEER, rest(120), CHEER, rest(100), CHEER, rest(80), CHEER, rest(60), CHEER),
    TRILL: repeat(20, [{ type: "sweep", f1: 4600, f2: 3400, ms: 25, step: 5, curve: "linear" }, rest(35)]),
    CHICKADEE: [
      { type: "sweep", f1: 4000, f2: 3800, ms: 300, step: 10, curve: "linear" },
      rest(80),
      { type: "tone", f: 3550, ms: 300 }
    ]
  };

  // -> [{f (0 = rest), ms}]
  function toNotes(segs) {
    var out = [];
    segs.forEach(function (s) {
      if (s.type === "rest") out.push({ f: 0, ms: s.ms });
      else if (s.type === "tone") out.push({ f: s.f, ms: s.ms });
      else {
        var n = Math.floor(s.ms / s.step);
        for (var i = 0; i < n; i++) out.push({ f: s.f1 + (s.f2 - s.f1) * CURVES[s.curve](i / (n - 1)), ms: s.step });
      }
    });
    return out;
  }

  // --- Audio preview ---------------------------------------------------------

  var ctx = null, current = null;

  function play(notes, button) {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    if (current) { try { current.stop(); } catch (e) {} }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "square";
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    var t = ctx.currentTime + 0.05;
    notes.forEach(function (n) {
      if (n.f) {
        osc.frequency.setValueAtTime(n.f, t);
        gain.gain.setValueAtTime(0.05, t);
      } else {
        gain.gain.setValueAtTime(0, t);
      }
      t += n.ms / 1000;
    });
    gain.gain.setValueAtTime(0, t);
    osc.start();
    osc.stop(t + 0.05);
    current = osc;
    if (button) {
      button.disabled = true;
      osc.onended = function () { button.disabled = false; };
    }
  }

  // --- Frequency / time plot -------------------------------------------------

  var SVG_NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, text) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function plot(container, notes) {
    var W = 520, H = 170, L = 44, R = 10, T = 10, B = 26;
    var FMIN = 1700, FMAX = 4900;
    var totalMs = notes.reduce(function (s, n) { return s + n.ms; }, 0) || 1;
    var x = function (ms) { return L + (W - L - R) * ms / totalMs; };
    var y = function (f) { return T + (H - T - B) * (1 - (f - FMIN) / (FMAX - FMIN)); };

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "freq-plot", role: "img" });
    svg.appendChild(el("title", {}, "Frequency versus time"));
    [2000, 3000, 4000].forEach(function (f) {
      svg.appendChild(el("line", { x1: L, x2: W - R, y1: y(f), y2: y(f), class: "grid" }));
      svg.appendChild(el("text", { x: L - 6, y: y(f) + 4, class: "axis", "text-anchor": "end" }, f / 1000 + " kHz"));
    });
    svg.appendChild(el("line", { x1: L, x2: W - R, y1: H - B, y2: H - B, class: "baseline" }));
    svg.appendChild(el("text", { x: L, y: H - 8, class: "axis" }, "0"));
    svg.appendChild(el("text", { x: W - R, y: H - 8, class: "axis", "text-anchor": "end" }, totalMs + " ms"));

    var t = 0, d = "";
    notes.forEach(function (n) {
      if (n.f) d += "M" + x(t).toFixed(1) + " " + y(n.f).toFixed(1) + "H" + x(t + n.ms).toFixed(1);
      t += n.ms;
    });
    svg.appendChild(el("path", { d: d, class: "trace" }));
    container.innerHTML = "";
    container.appendChild(svg);
  }

  document.querySelectorAll("[data-bird]").forEach(function (card) {
    var notes = toNotes(BIRDS[card.getAttribute("data-bird")]);
    plot(card.querySelector(".plot"), notes);
    var btn = card.querySelector(".listen");
    btn.addEventListener("click", function () { play(notes, btn); });
  });
})();
