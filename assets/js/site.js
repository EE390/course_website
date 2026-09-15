// EE 390 course site — shared behaviour (nav highlight + mobile menu)

(function () {
  // Sub-pages can set <body data-nav="parent.html"> to highlight their parent in the menu.
  var page = document.body.getAttribute("data-nav") || location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach(function (a) {
    if (a.getAttribute("href").split("/").pop() === page) a.setAttribute("aria-current", "page");
  });

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Language tabs (Assembly | C). Markup:
  //   <div class="tabs" data-tabs>
  //     <div class="tab-list" role="tablist"><button data-tab="asm">Assembly</button><button data-tab="c">C</button></div>
  //     <div data-panel="asm">…</div><div data-panel="c">…</div>
  //   </div>
  // Every tab group on the page switches together, and the choice is remembered.
  var LANG_KEY = "ee390-language";
  var groups = document.querySelectorAll("[data-tabs]");

  function selectTab(name, remember) {
    groups.forEach(function (group) {
      if (!group.querySelector('[data-tab="' + name + '"]')) return;
      group.querySelectorAll("[data-tab]").forEach(function (b) {
        var on = b.getAttribute("data-tab") === name;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      group.querySelectorAll("[data-panel]").forEach(function (p) {
        p.hidden = p.getAttribute("data-panel") !== name;
      });
    });
    if (remember) {
      try { localStorage.setItem(LANG_KEY, name); } catch (e) {}
    }
  }

  if (groups.length) {
    groups.forEach(function (group) {
      group.querySelectorAll("[data-tab]").forEach(function (b) {
        b.setAttribute("role", "tab");
        b.type = "button";
        b.addEventListener("click", function () { selectTab(b.getAttribute("data-tab"), true); });
      });
    });
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    selectTab(saved === "c" ? "c" : "asm", false);
  }
})();
