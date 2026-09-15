# Maintaining the EE 390 website

Plain HTML, CSS and JavaScript: no build step, no dependencies. Changes go live about a minute after they reach `main`.

## Workflow

1. Create a branch, or press `.` on the repo page to edit in the browser.
2. Before committing, run the checks (Python 3, no packages needed):
   ```sh
   python .github/scripts/check_site.py
   ```
3. Open a pull request. The same checks, plus compiling all C code with SDCC, run automatically.
4. A course staff member reviews and merges.

Keep commit messages short and in the imperative: `Add Practical Quiz 2`, `Fix buzzer pin in lab kit`.

> **Never commit solutions, answer keys or grading notes.** They belong in the private [`EE390/instructor`](https://github.com/EE390/instructor) repository. The checks reject file names containing `solution`, `answer key` or `grading notes`.

## What the checks enforce

| Rule | Why |
| --- | --- |
| Every page has a title, description, canonical URL and link-preview (`og:`) tags | Search results and shared links look right |
| The site navigation is identical on every page | Nobody gets lost when a page is added |
| Every internal link, image and `#anchor` exists | No broken links for students |
| Every file in `files/` is linked from at least one page | Everything uploaded is actually reachable on the site |
| Every example in `assets/js/examples.js` exists | The code viewer never shows an empty file |
| No file over 50 MB; whole site under 900 MB | GitHub's file limit and the 1 GB Pages limit |
| All C examples and starters compile with SDCC without warnings (CI only) | Students can build what we give them |

## Where things go

```
index.html, *.html      top-level pages (one per nav item)
projects/               one page per mini project (links inside use ../)
examples/               .asm example programs (served as-is, CRLF)
examples/c/             .c example programs (SDCC)
files/
  handouts/             project and quiz PDFs          e.g. practical-quiz-2.pdf
  starters/             starter templates (.asm, .c)   e.g. traffic_light_starter.c
  software/             installers and helper scripts  e.g. build.bat
  manuals/              board manuals and datasheets
  videos/               short videos (under 50 MB)
assets/css/site.css     shared styles (light + dark mode)
assets/js/site.js       nav highlight, mobile menu, Assembly/C tabs
assets/js/examples.js   example list + viewer + assembly and C syntax highlighters
assets/js/bird-song.js  bird call plots and audio preview on the project pages
assets/js/wiki.js       table-of-contents highlighting (wiki and project pages)
assets/img/             images, one folder per topic (e.g. assets/img/setup/)
.github/templates/      page.html and project.html: start every new page from these
.github/scripts/        check_site.py
.github/workflows/      CI
```

**File names:** lowercase with hyphens for pages and PDFs (`practical-quiz-2.pdf`). Code files follow the style of their folder. Never rename or move a published file without updating every link, since students bookmark them. The checks will catch any link you miss.

## Common edits

**Post an announcement:** in `index.html`, copy an `<li>` inside `<ul class="announcements">` and put the new one at the top.

**Fill in course information:** in `index.html`, replace the `TBA` cells (instructor, email, office hours, lab time).

**Add a practical quiz:** upload the PDF to `files/handouts/`. In `assignments.html`, use the commented table above *Practical Quizzes* and add a row.

**Add a mini project:**
1. Copy `.github/templates/project.html` to `projects/your-project.html` and replace every UPPERCASE placeholder.
2. Put the starter in `files/starters/` and any handout in `files/handouts/`.
3. In `projects.html`, add a row to the roadmap table and a card (copy an existing one).
4. Put the solution, answer key and grading notes in `EE390/instructor`.

A PDF-only project needs just steps 2 and 3.

**Add a code example:** upload a `.asm` file to `examples/` or a `.c` file to `examples/c/`, then add an entry (with `lang: "asm"` or `lang: "c"`) to the `EXAMPLES` list in `assets/js/examples.js`. Link directly to it with `examples.html#file_name_without_extension`.

**Show code in both languages:** wrap alternatives in a tab group. The reader's choice is remembered across pages:

```html
<div class="tabs" data-tabs>
  <div class="tab-list" role="tablist"><button data-tab="asm">Assembly</button><button data-tab="c">C</button></div>
  <div data-panel="asm">…</div>
  <div data-panel="c">…</div>
</div>
```

Mark language-specific items with `<span class="lang-badge lang-asm">ASM</span>` or `<span class="lang-badge lang-c">C</span>`.

**Add a reference, datasheet or software:** upload it to `files/manuals/` or `files/software/` and link it from `references.html`, or link to the vendor's site. Third-party files must be listed in `LICENSE` as not covered by our licences.

**Add a new top-level page:**
1. Copy `.github/templates/page.html` to the repository root and replace every UPPERCASE placeholder.
2. Add its link to the `<nav class="site-nav">` block in **every** page, including `projects/*.html` (with `../`) and `404.html` (with `/course_website/`).
3. Add it to the footer columns if it belongs there.

The navigation has room for about two more items before it gets crowded on laptops. Prefer adding a section to an existing page, such as a new wiki section or a new table on Assignments.

## Large files (over 50 MB)

Recordings and large installers can still be on the site without going into the repository:

1. On GitHub, go to **Releases**, open (or create) the release tagged `materials`, and attach the file. Release assets can be up to 2 GB and don't count towards the site size.
2. Link it from the page with its download URL:
   `https://github.com/EE390/course_website/releases/download/materials/<file-name>`

Release downloads can't play inside the page. For long videos students should watch in the browser, use an unlisted YouTube video and embed it instead.

## Preview locally

The code viewer loads files with `fetch`, which browsers block on `file://` URLs. Run a local server from the repo folder:

```sh
python -m http.server 8000
```

then open http://localhost:8000. `404.html` only renders correctly on GitHub Pages.

## Each semester

- Update dates, announcements and course information.
- Before the new term starts, tag the final state of the old one, e.g. `git tag 2026-fall && git push origin 2026-fall`. Old versions can be browsed from the tag at any time.
