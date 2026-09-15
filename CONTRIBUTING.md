# Maintaining the EE 390 website

Plain HTML, CSS and JavaScript: no build step, no dependencies. Changes go live about a minute after they reach `main`.

## Workflow

1. Create a branch, or press `.` on the repo page to edit in the browser.
2. Open a pull request. The checks (links, HTML, C compile) run automatically.
3. A course staff member reviews and merges.

Keep commit messages short and in the imperative: `Add Practical Quiz 2`, `Fix buzzer pin in lab kit`.

> **Never commit solutions, answer keys or grading notes.** They belong in the private [`EE390/instructor`](https://github.com/EE390/instructor) repository. `.gitignore` blocks file names containing `solution` as a safety net.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home: announcements, course information, quick links |
| `getting-started.html` | Installing MIDE-51, SDCC and STC-ISP; first program in assembly or C |
| `lab-kit.html` | Board overview and pin map |
| `wiki.html` | 8051 Wiki, grouped: the chip · assembly · peripherals · C with SDCC · tools & reference. Diagrams are inline SVG in the file |
| `examples.html` | Example catalogue and viewer: assembly (`examples/`) and C (`examples/c/`) |
| `assignments.html` | Practical quizzes and other assignments |
| `projects.html` | Course roadmap and mini project cards |
| `projects/*.html` | One page per mini project: `bird-song.html` (MP2, assembly), `bird-song-c.html` (MP3, C). Links inside use `../` |
| `references.html` | Software, videos, board manual, datasheets, reading |
| `404.html` | Page-not-found. Uses absolute `/course_website/` links because GitHub Pages serves it at any depth |

## Common edits

**Post an announcement:** in `index.html`, copy an `<li>` inside `<ul class="announcements">` and put the new one at the top.

**Fill in course information:** in `index.html`, replace the `TBA` cells (instructor, email, office hours, lab time).

**Add a mini project:** for a PDF-only project, upload the PDF to `files/`. For a full project page, copy `projects/bird-song.html` and replace its content. Then copy a card in `projects.html` and add a row to the roadmap table.

**Add a practical quiz:** upload the PDF to `files/` and list it under *Practical Quizzes* in `assignments.html`.

**Add a code example:** upload a `.asm` file to `examples/` or a `.c` file to `examples/c/`, then add an entry (with `lang: "asm"` or `lang: "c"`) to the `EXAMPLES` list in `assets/js/examples.js`. Link directly to it with `examples.html#file_name_without_extension`. C files must compile with SDCC without warnings (CI checks this).

**Show code in both languages:** wrap alternatives in a tab group. The reader's choice is remembered across pages:

```html
<div class="tabs" data-tabs>
  <div class="tab-list" role="tablist"><button data-tab="asm">Assembly</button><button data-tab="c">C</button></div>
  <div data-panel="asm">…</div>
  <div data-panel="c">…</div>
</div>
```

Mark language-specific items with `<span class="lang-badge lang-asm">ASM</span>` or `<span class="lang-badge lang-c">C</span>`.

**Add a reference or datasheet:** edit `references.html`. Prefer linking to the vendor's site. Only upload files to `files/` when we have the right to redistribute them.

**Add a page:** copy an existing page. Change the `<title>`, the description, the `og:*`/canonical tags and the `<main>` content. Add the link to the `<nav class="site-nav">` block in *every* page (and in `404.html`).

## Folders

```
assets/css/site.css     shared styles (light + dark mode)
assets/js/site.js       nav highlight, mobile menu, Assembly/C tabs
assets/js/examples.js   example list + viewer + assembly and C syntax highlighters
assets/js/bird-song.js  bird call plots and audio preview on the project pages
assets/js/wiki.js       wiki table-of-contents highlighting
assets/img/             images
examples/               .asm example programs (served as-is, CRLF)
examples/c/             .c example programs (SDCC)
files/                  PDFs, videos, software, starter templates (.asm, .c)
files/c/build.bat       helper students use to compile C with SDCC
.github/                issue templates, CODEOWNERS, CI workflow
```

## Preview locally

The code viewer loads files with `fetch`, which browsers block on `file://` URLs. Run a local server from the repo folder:

```sh
python -m http.server 8000
```

then open http://localhost:8000. (`404.html` only renders correctly on GitHub Pages.)

## Limits

GitHub rejects files over 100 MB and warns above 50 MB. Host large videos (e.g. lecture recordings) elsewhere, such as YouTube (unlisted), and link to them from `references.html`.

## Each semester

- Update dates, announcements and course information.
- Tag the final state of the term, e.g. `git tag 2026-fall && git push origin 2026-fall`.
