// EE 390 wiki — highlight the table-of-contents entry for the section being read.
(function () {
  var links = document.querySelectorAll(".wiki-toc a");
  if (!links.length || !("IntersectionObserver" in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.classList.remove("active"); });
      var a = byId[e.target.id];
      if (a) a.classList.add("active");
    });
  }, { rootMargin: "-80px 0px -70% 0px" });

  document.querySelectorAll(".wiki-content > section[id]").forEach(function (s) { observer.observe(s); });
})();
