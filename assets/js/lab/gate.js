/* Closed-beta gate for the simulator page.
 *
 * Keeps the simulator hidden until someone enters the current beta code, so the
 * page can sit on the live site while it is still being worked on.
 *
 * WHAT THIS IS NOT: it is not access control, and it cannot be. The site is
 * static, so the assembler, the processor and this file are all already in the
 * visitor's browser by the time the gate is drawn. Anyone who opens developer
 * tools can step past it in a few seconds. Treat it as a sign on the door, not
 * a lock. Real protection needs a host that can authenticate before it serves
 * the files (Cloudflare Access, Netlify, a private deploy) — GitHub Pages
 * cannot do it.
 *
 * What it does buy: the page is not usable by accident, students who have not
 * been given the code do not start their work on an unfinished tool, and the
 * code itself is not sitting in this public repository in plain text.
 *
 * To change the code, open this page in a browser and run:
 *     EE390Gate.hash("your new code")
 * then paste the result into CODE_HASH below. The comparison ignores case and
 * surrounding spaces, so students can type it however their phone capitalises.
 *
 * The gate applies everywhere, including a local checkout, so that what you see
 * while developing is what a student sees. The site's own tests get past it by
 * writing the unlock key into localStorage before they load the page; see
 * .github/tests/ui-test.html.
 */
(function (global) {
  "use strict";

  var CODE_HASH = "mtw2sojsef";
  var STORE_KEY = "ee390-lab-beta";

  /* cyrb53. Not a cryptographic hash and does not need to be: it only keeps the
   * code out of the repository's plain text. See the note above. */
  function hash(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    var t = String(s).trim().toLowerCase();
    for (var i = 0; i < t.length; i++) {
      var ch = t.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function accepts(code) { return hash(code) === CODE_HASH; }

  var gate = document.getElementById("lab-gate");
  var main = document.getElementById("lab-main");
  if (!gate || !main) return;

  var params = new URLSearchParams(location.search);

  function remembered() {
    try { return localStorage.getItem(STORE_KEY) === CODE_HASH; } catch (e) { return false; }
  }

  function remember() {
    try { localStorage.setItem(STORE_KEY, CODE_HASH); } catch (e) { /* private mode */ }
  }

  function unlock() {
    gate.hidden = true;
    main.hidden = false;
    /* The editor sizes itself from its box, which was display:none until now. */
    global.dispatchEvent(new Event("resize"));
  }

  if (remembered()) {
    unlock();
  } else if (params.has("code")) {
    /* A one-link invitation. Take the code, then drop it from the address bar
       so it does not end up in a screenshot or the back button. */
    var fromUrl = params.get("code");
    params.delete("code");
    var rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
    if (accepts(fromUrl)) { remember(); unlock(); }
  }

  var form = document.getElementById("gate-form");
  var input = document.getElementById("gate-code");
  var msg = document.getElementById("gate-msg");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (accepts(input.value)) {
        remember();
        msg.textContent = "";
        unlock();
      } else {
        msg.textContent = "That code is not right. Check with your instructor.";
        input.select();
      }
    });
  }
  if (input && !gate.hidden) input.focus();

  global.EE390Gate = { hash: hash, accepts: accepts };
})(window);
