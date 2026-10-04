# Building Better: IB MYP Personal Project portfolio (wireframe)

A single-page static website that tells the story of a three-month health, fitness and lifestyle Personal Project in the order it happened:

**Goal → Plan → Research → Action → Progress → Learning → Reflection**

Each chapter flows straight into the next as you scroll. The sticky header highlights the chapter you are reading, the bar underneath lists that chapter's sections, and a thin line shows how far through the portfolio you are. On phones, the menu button opens the full contents.

It is a wireframe: the layout, navigation, charts and interactions work, and every spot where real content goes is marked as a placeholder.

## Chapters

Everything lives in `index.html`, in this order:

| Anchor | Nav label | What it covers |
| --- | --- | --- |
| `#top` | Home | Hero, project at a glance, contents |
| `#project` | Home | 01 The project: the idea, my goal, the three-month timeline |
| `#research` | Interviews & Research | 02 Research process, questions, interviews, survey, sources, key findings, bibliography |
| `#progress` | My Progress | 03 Starting point, weekly routine, exercise library, month by month, graphs, before vs after, evidence gallery |
| `#diet-sleep` | Diet & Sleep | 04 Nutrition (what I learned, diet plan, sources, free template) and Sleep (why it matters, schedule, progress graph, free template) |
| `#reflection` | Reflection | 05 Goal check, self-rating, successes and setbacks, journal, ATL skills, looking forward |
| `#resources` | Resources | 06 Free templates, four-week starter plan, beginner checklist, user feedback |
| `#about` | About | 07 The MYP Personal Project, goals and global context, success criteria, assessment map |

Shared files:

- `assets/css/styles.css`: all styles (colours and fonts are tokens at the top; light and dark mode)
- `assets/js/main.js`: navigation tracking, contents menu, filters, timeline, templates and charts
- `assets/js/data.js`: **every chart's numbers**, plus the project start date
- `assets/images/`: put your photos and screenshots here

## Preview it

Open `index.html` in a browser, or run a local server from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Replacing placeholders

- **Find them:** click **Highlight placeholders** in the footer. Every placeholder turns yellow.
- **Short text** looks like `<span class="ph">[Your name]</span>`. Replace the whole span with your text.
- **Writing prompts** look like `<span class="ph-block">…</span>`. Replace them with a paragraph.
- **Images:** replace a placeholder box such as

  ```html
  <div class="ph-media"><span>[Workout Photo]</span></div>
  ```

  with

  ```html
  <img class="photo" src="assets/images/week3-bench.jpg" alt="Bench press session in week 3">
  ```

  Add `photo--wide`, `photo--tall` or `photo--banner` to match the shape of the box you replaced.

## Updating graphs

All graphs read from `assets/js/data.js`. Change the numbers in each `values` list (one per week) and the graph, its dates, hover labels and data table update. Set `projectStart` to the Monday your project began and every date on every chart moves with it.

The before-and-after self-rating in the Reflection chapter uses `data-start` and `data-end` on each row instead.

## Timeline and evidence

- **Milestone status** (timeline): change `data-status="done | active | next"` on the `<li class="ms">` and the matching status label (`status--done`, `status--active`, `status--next`). The "X of Y milestones completed" counts update themselves.
- **Evidence gallery** (My Progress): copy any `<article class="card evidence-item">`, then set `data-month` (1, 2 or 3) and `data-category` (`workout-photos`, `workout-logs`, `tracker`, `running`, `progress-photos`, `gym-notes` or `measurements`). The filters pick it up automatically.
- Give each piece of evidence a code (E-01, E-02…) so you can refer to it in your report.

## Navigation

The header builds itself from the page structure:

- A chapter is `<section class="chapter" id="…" data-chapter="Name" data-num="03">`.
- A section inside it is `<div class="block" id="…" data-block="Short name">`. The short name is what appears in the section bar and the phone menu.
- Each chapter ends with a "Next chapter" link (`<a class="bridge">`) into the one after it.

To add, rename or reorder a section, change the HTML and the navigation updates on its own. The top-level links are in the `<nav class="primary">` list near the top of `index.html`.

## Publishing

The site is plain HTML, CSS and JavaScript, so it works on GitHub Pages: in the repository settings, open **Pages** and deploy from this branch's root folder.
