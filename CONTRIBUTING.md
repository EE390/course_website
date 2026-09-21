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

Keep commit messages short and in the imperative: `Add Homework 2`, `Fix buzzer pin in lab kit`.

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
| The simulator assembles every example to the same bytes as ASEM-51, and runs them identically to the Python emulator (CI only) | The browser simulator cannot drift from the real toolchain |

## Where things go

```
index.html              Home: about the course and the teaching staff cards
schedule.html           lecture schedule, slides and important dates
assignments.html        Homework and Practical Assignments (mini projects)
resources.html          landing page linking to the four resource pages below
getting-started.html, lab-kit.html, wiki.html, examples.html
                        resource pages (linked from resources.html, not in the nav)
projects/               one page per practical assignment (links inside use ../)
examples/               .asm example programs (served as-is, CRLF)
examples/c/             .c example programs (SDCC)
files/
  handouts/             project and homework PDFs      e.g. homework-2.pdf
  slides/               lecture slides                 e.g. week-01-introduction.pdf
  starters/             starter templates (.asm, .c)   e.g. traffic_light_starter.c
  software/             installers and helper scripts  e.g. build.bat
  manuals/              board manuals and datasheets
  videos/               short videos (under 50 MB)
assets/css/site.css     shared styles (light + dark mode)
assets/js/site.js       nav highlight, mobile menu, Assembly/C tabs
assets/js/examples.js   example list + viewer + assembly and C syntax highlighters
assets/js/bird-sound.js  bird call plots and audio preview on the project pages
assets/js/wiki.js       table-of-contents highlighting (wiki and project pages)
assets/js/lab/          browser simulator: asm8051.js (assembler), emu8051.js (CPU),
                        lab.js (page, virtual board). Used by lab.html
.github/tests/          simulator tests: run-tests.js, fixtures/ (ASEM-51 output +
                        reference traces), ui-test.html (manual browser check)
assets/img/             images, one folder per topic (e.g. assets/img/setup/)
.github/templates/      page.html and project.html: start every new page from these
.github/scripts/        check_site.py
.github/workflows/      CI
```

**File names:** lowercase with hyphens for pages and PDFs (`homework-2.pdf`). Code files follow the style of their folder. Never rename or move a published file without updating every link, since students bookmark them. The checks will catch any link you miss.

## Common edits

**Update the teaching staff:** in `index.html`, edit the cards under *Teaching Staff*. Copy a `<div class="card staff-card">` to add a person, and set `--cols` on its grid to the number of cards in that row.

**Add a homework:** upload the PDF to `files/handouts/`. In `assignments.html`, use the commented table above *Homework* and add a row. Homework is individual.

**Add a lecture:** upload the slides to `files/slides/`. In `schedule.html`, use the commented table above *Lecture schedule* and add a row. Keep the *Important dates* list in sync with the due dates on `assignments.html`.

**Add a practical assignment (mini project, groups of 2 to 3):**
1. Copy `.github/templates/project.html` to `projects/your-project.html` and replace every UPPERCASE placeholder.
2. Put the starter in `files/starters/` and any handout in `files/handouts/`.
3. In `assignments.html`, under *Practical Assignments*, add a row to the roadmap table and a card (copy an existing one).
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

**Add a reference, datasheet or software:** upload it to `files/manuals/` or `files/software/`, or link to the vendor's site. Link software from *Getting Started*, board documents from *Lab Kit*, and datasheets or reading from the *Further reading* section of the Wiki. Third-party files must be listed in `LICENSE` as not covered by our licences.

**Add a new top-level page:**
1. Copy `.github/templates/page.html` to the repository root and replace every UPPERCASE placeholder.
2. Add its link to the `<nav class="site-nav">` block in **every** page, including `projects/*.html` (with `../`) and `404.html` (with `/course_website/`).
3. Add it to the footer columns if it belongs there.

The navigation has four items and room for a few more on laptops. Prefer adding a section to an existing page, such as a new wiki section or a new table on Assignments. A new page that belongs under Resources should get a card on `resources.html` and `<body data-nav="resources.html">` instead of a nav item.

## The lab simulator

`lab.html` runs 8051 assembly in the browser on a simulated board. Three files:
`assets/js/lab/asm8051.js` (assembler), `emu8051.js` (processor) and `lab.js` (page and board).

Both engines are checked against the real tools, and CI fails if they drift:

```sh
node .github/tests/run-tests.js
```

- **Assembler:** every program in `examples/` plus the project starter must assemble to exactly the
  bytes in `.github/tests/fixtures/*.hex`, which is ASEM-51 v1.3 output, the assembler inside MIDE-51.
- **Processor:** each program must run identically to `fixtures/traces.json`, recorded from
  `instructor/tools/emu8051.py`, the emulator used to verify the course solutions.

Changing an example means regenerating its fixture (an instructor job: assemble it in MIDE-51 and
copy the `.hex`, then rebuild the traces). Without that, CI will fail, which is the point.

For the page itself, open `.github/tests/ui-test.html` through a local server: it drives the real
page in an iframe (Run, Step, buttons, error reporting) and prints pass/fail.

If you fix a bug in `emu8051.js`, fix it in `instructor/tools/emu8051.py` too. They are meant to agree.

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

- Update the teaching staff, dates and schedule.
- Before the new term starts, tag the final state of the old one, e.g. `git tag 2026-fall && git push origin 2026-fall`. Old versions can be browsed from the tag at any time.
