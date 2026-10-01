# Building Better: IB MYP Personal Project portfolio (wireframe)

A seven-page static website that tells the story of a three-month health, fitness and lifestyle Personal Project in the order it happened:

**Goal → Plan → Research → Action → Progress → Learning → Reflection**

It is a wireframe: the layout, navigation, charts and interactions work, and every spot where real content goes is marked as a placeholder.

## Pages

| File | Nav label | What it covers |
| --- | --- | --- |
| `index.html` | Home | Hero, journey map, the idea and goal, 3-month timeline, quick stats |
| `progress.html` | My Progress | Starting point, weekly routine, exercise library, month-by-month progress, graphs, before vs after, evidence gallery |
| `diet-sleep.html` | Diet & Sleep | Nutrition (what I learned, diet plan, what helped, sources, free diet template) and Sleep (why it matters, schedule, progress graph, what helped, free sleep template) |
| `research.html` | Interviews & Research | Research process, questions, interviews, survey, sources with reliability scores, key findings, bibliography |
| `reflection.html` | Reflection | Goal check, self-rating, successes and setbacks, reflection journal, ATL skills, looking forward |
| `resources.html` | Resources | Free templates (the product), 4-week starter plan, beginner checklist, user feedback |
| `about.html` | About | The MYP Personal Project, learning and product goals, global context, success criteria, assessment criteria map |

Shared files:

- `assets/css/styles.css`: all styles (colours and fonts are tokens at the top; light and dark mode)
- `assets/js/main.js`: header, footer, mobile menu, filters, timeline, templates and charts
- `assets/js/data.js`: **every chart's numbers**, plus the project start date
- `assets/images/`: put your photos and screenshots here

## Preview it

Open `index.html` in a browser, or run a local server from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Replacing placeholders

- **Find them:** click **Highlight placeholders** in the bottom-right corner of any page. Every placeholder turns yellow.
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

  Add `photo--wide`, `photo--tall` or `photo--square` to match the shape of the box you replaced.

## Updating graphs

All graphs read from `assets/js/data.js`. Change the numbers in each `values` list (one per week) and the graph, its dates, hover labels and data table update. Set `projectStart` to the Monday your project began and every date on every chart moves with it.

The before-and-after self-rating on the Reflection page uses `data-start` and `data-end` on each row instead.

## Timeline and evidence

- **Milestone status** (Home page): change `data-status="done | active | next"` on the `<li class="milestone">` and the matching status label (`status--done`, `status--active`, `status--next`). The phase progress bars recount themselves.
- **Evidence gallery** (My Progress): copy any `<article class="card evidence-item">`, then set `data-month` (1, 2 or 3) and `data-category` (`workout-photos`, `workout-logs`, `tracker`, `running`, `progress-photos`, `gym-notes` or `measurements`). The filters pick it up automatically.
- Give each piece of evidence a code (E-01, E-02…) so you can refer to it in your report.

## Navigation

Nav labels and page order live in the `NAV` list at the top of `assets/js/main.js`. The active page is set by `data-page` on each page's `<body>`.

## Publishing

The site is plain HTML, CSS and JavaScript, so it works on GitHub Pages: in the repository settings, open **Pages** and deploy from this branch's root folder.
