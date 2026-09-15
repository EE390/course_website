#!/usr/bin/env python3
"""Offline checks for the EE 390 website. Standard library only.

Run from the repository root before committing:

    python .github/scripts/check_site.py

The same script runs in GitHub Actions on every push and pull request.
Exit code 1 means at least one error; warnings never fail the build.
"""
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SITE_PREFIX = "/course_website/"          # used only by 404.html (served at any depth)
MAX_FILE_MB = 50                          # GitHub warns above 50 MB and rejects above 100 MB
WARN_FILE_MB = 25
MAX_SITE_MB = 900                         # GitHub Pages sites are limited to 1 GB
JS_ANCHOR_PAGES = {"examples.html"}       # anchors resolved by JavaScript, not by element ids
FORBIDDEN = re.compile(r"solution|answer[-_ ]?key|grading[-_ ]?notes", re.I)
SKIP_DIRS = {".git", ".github", "node_modules"}
CI = os.environ.get("GITHUB_ACTIONS") == "true"

errors, warnings = [], []


def report(kind, path, msg):
    rel = path.relative_to(ROOT).as_posix() if isinstance(path, Path) else path
    (errors if kind == "error" else warnings).append((rel, msg))


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.nav, self.meta = set(), [], [], {}
        self.title, self._in_title, self._in_nav, self._in_head = "", False, False, False
        self.has = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "a" and a.get("name"):
            self.ids.add(a["name"])
        for key in ("href", "src"):
            if a.get(key):
                self.links.append(a[key])
                if self._in_nav and tag == "a":
                    self.nav.append(a[key])
        if tag == "nav" and "site-nav" in (a.get("class") or ""):
            self._in_nav = True
        if tag == "head":
            self._in_head = True
        if tag == "title" and self._in_head:
            self._in_title = True
        if tag == "meta":
            k = a.get("name") or a.get("property")
            if k:
                self.meta[k] = a.get("content", "")
        if tag == "link" and a.get("rel") == "canonical":
            self.meta["canonical"] = a.get("href", "")
        if tag == "main" and a.get("id") == "main":
            self.has.add("main")
        if tag == "a" and "skip-link" in (a.get("class") or ""):
            self.has.add("skip-link")
        if "footer-legal" in (a.get("class") or ""):
            self.has.add("footer-legal")
        if tag == "script" and (a.get("src") or "").endswith("assets/js/site.js"):
            self.has.add("site.js")

    def handle_endtag(self, tag):
        if tag == "nav":
            self._in_nav = False
        if tag == "title":
            self._in_title = False
        if tag == "head":
            self._in_head = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def tracked_files():
    try:
        out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True)
        files = [ROOT / f for f in out.stdout.decode("utf-8").split("\0") if f]
        # include new files that are staged or untracked but not ignored
        extra = subprocess.run(["git", "ls-files", "-z", "--others", "--exclude-standard"],
                               cwd=ROOT, capture_output=True, check=True)
        files += [ROOT / f for f in extra.stdout.decode("utf-8").split("\0") if f]
        return [f for f in files if f.exists()]
    except (OSError, subprocess.CalledProcessError):
        return [p for p in ROOT.rglob("*") if p.is_file() and not (set(p.relative_to(ROOT).parts) & SKIP_DIRS)]


def page_files(files):
    return sorted(f for f in files if f.suffix == ".html" and f.relative_to(ROOT).parts[0] not in SKIP_DIRS)


def resolve(page, url):
    """Return (target path, fragment) for a local URL, or None for external links."""
    if re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I) or url.startswith("//"):
        return None
    parts = urlsplit(url)
    path, frag = unquote(parts.path), unquote(parts.fragment)
    if not path:
        return page, frag
    if path.startswith(SITE_PREFIX):
        target = ROOT / path[len(SITE_PREFIX):]
    elif path.startswith("/"):
        return ROOT / "__root_relative__" / path.lstrip("/"), frag
    else:
        target = page.parent / path
    if path.endswith("/") or target.is_dir():
        target = target / "index.html"
    return target.resolve(), frag


def normalise_nav(page, hrefs):
    out = []
    for h in hrefs:
        r = resolve(page, h)
        out.append(r[0].relative_to(ROOT).as_posix() if r else h)
    return out


def main():
    files = tracked_files()
    pages = page_files(files)
    parsed = {}
    for p in pages:
        parser = Page()
        parser.feed(p.read_text(encoding="utf-8"))
        parsed[p] = parser

    # 1. Required page elements
    for p, d in parsed.items():
        rel = p.relative_to(ROOT).as_posix()
        if not d.title.strip():
            report("error", p, "missing <title>")
        elif "EE 390" not in d.title:
            report("warning", p, "title should include 'EE 390'")
        for need in ("main", "skip-link", "site.js", "footer-legal"):
            if need not in d.has:
                report("error", p, f"missing {need} (copy the structure from .github/templates/)")
        if rel == "404.html":
            continue
        if not d.meta.get("description"):
            report("error", p, "missing <meta name=\"description\">")
        expected = "https://ee390.github.io/course_website/" + ("" if rel == "index.html" else rel)
        for key in ("canonical", "og:url"):
            if d.meta.get(key) != expected:
                report("error", p, f"{key} should be {expected}")
        for key in ("og:title", "og:description", "og:image"):
            if not d.meta.get(key):
                report("error", p, f"missing {key}")

    # 2. Identical navigation on every page
    home = ROOT / "index.html"
    if home in parsed:
        ref_nav = normalise_nav(home, parsed[home].nav)
        for p, d in parsed.items():
            nav = normalise_nav(p, d.nav)
            if nav != ref_nav:
                report("error", p, f"site navigation differs from index.html: {nav}")

    # 3. Local links, images and #anchors
    for p, d in parsed.items():
        for url in d.links:
            if url.startswith(("data:", "javascript:")):
                continue
            r = resolve(p, url)
            if r is None:
                continue
            target, frag = r
            if "__root_relative__" in target.parts:
                report("error", p, f"root-relative link '{url}' breaks on GitHub Pages; use a relative path")
                continue
            if not target.exists():
                report("error", p, f"broken link '{url}'")
                continue
            if frag and target.suffix == ".html" and target.name not in JS_ANCHOR_PAGES:
                ids = parsed[target].ids if target in parsed else set()
                if frag not in ids:
                    report("error", p, f"link '{url}': no element with id '{frag}'")

    # 4. Code examples listed in assets/js/examples.js exist
    js = ROOT / "assets/js/examples.js"
    if js.exists():
        text = js.read_text(encoding="utf-8")
        for m in re.finditer(r'file:\s*"([^"]+)"[\s\S]*?lang:\s*"(\w+)"', text):
            name, lang = m.groups()
            folder = ROOT / ("examples/c" if lang == "c" else "examples")
            if not (folder / name).exists():
                report("error", "assets/js/examples.js", f"example '{name}' not found in {folder.relative_to(ROOT).as_posix()}/")

    # 5. Every download in files/ is linked from a page, so nothing is uploaded but unreachable
    linked = set()
    for p, d in parsed.items():
        for url in d.links:
            r = resolve(p, url)
            if r:
                linked.add(r[0])
    for f in files:
        rel = f.relative_to(ROOT)
        if rel.parts[0] == "files" and f.resolve() not in linked:
            report("error", f, "not linked from any page; add it to the right page or delete it")

    # 6. File sizes, site size and instructor material
    total = 0
    for f in files:
        size = f.stat().st_size
        rel = f.relative_to(ROOT).as_posix()
        if rel.startswith(".git/"):
            continue
        total += size
        mb = size / 1_048_576
        if mb > MAX_FILE_MB:
            report("error", f, f"{mb:.1f} MB is over {MAX_FILE_MB} MB; attach it to the 'materials' GitHub Release instead (see CONTRIBUTING.md)")
        elif mb > WARN_FILE_MB:
            report("warning", f, f"{mb:.1f} MB; consider a GitHub Release asset for files this large")
        if FORBIDDEN.search(f.name):
            report("error", f, "looks like instructor material; it belongs in the private EE390/instructor repo")
    total_mb = total / 1_048_576
    if total_mb > MAX_SITE_MB:
        report("error", "(site)", f"site is {total_mb:.0f} MB; GitHub Pages allows 1 GB")

    # Output
    for kind, items in (("error", errors), ("warning", warnings)):
        for rel, msg in items:
            if CI:
                print(f"::{kind} file={rel}::{msg}")
            else:
                print(f"{kind.upper():8} {rel}: {msg}")
    print(f"\nChecked {len(pages)} pages and {len(files)} files ({total_mb:.1f} MB): "
          f"{len(errors)} error(s), {len(warnings)} warning(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
