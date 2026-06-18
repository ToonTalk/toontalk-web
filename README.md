# ToonTalk Web

A from-scratch web reimplementation of [ToonTalk](http://www.toontalk.com/), the
visual programming environment for children created by Ken Kahn (1992–2007).

This is a clean rewrite (TypeScript + PixiJS), not a port of the original
DirectX C++ — see `../TOONTALK_WEB_PLAN.md` for the rationale and roadmap.

## Status: A library of example robots in the notebook 📒 ✅

The main notebook ("claude 1") now comes pre-stocked with a variety of trained
robots — flip past **Pictures** (page 1) and the **Examples** divider (page 2) to
the library, pull a page out (drag the robot off it), and drop a matching box on it
to watch it run. Teams come out as a lined-up row that takes turns on the box:

| # | Robot | Try dropping… |
|---|---|---|
| 3 | **Add** | a 2-number box `[3,5]` → `8` |
| 4 | **Multiply** | a 2-number box `[3,5]` → `15` |
| 5 | **Count up** | a 1-number box `[0]` → climbs `1,2,3…` (grab it to stop) |
| 6 | **Double** | a 1-number box `[5]` → `10,20,40…` |
| 7 | **Join words** | a 2-text box `["snow","man"]` → `"snowman"` |
| 8 | **Swap** | a 2-number box → swaps them (oscillates — grab to stop) |
| 9 | **Sort pair** | `[number, scale, number]` → puts the bigger first, then stops |
| 10 | **Greet** | a 1-text box that's exactly `"hi"` → `"hi there"` (exact-value guard) |
| 11 | **Add-or-join** (team ×2) | a number pair → adds · a text pair → joins |
| 12 | **By size** (team ×2) | a lone number → doubles · a pair → adds |
| 13 | **All-rounder** (team ×3) | number pair → add · text pair → join · lone number → count up |

The library is detected by its **Examples** divider page, so any notebook lacking
it gets the library added on load — an existing notebook keeps your filed pages and
gains the library after them. (Pages shift accordingly; the numbers above are for a
fresh notebook. **Reset** re-seeds a clean one.)

## Status: Robot teams — a line of robots that work together 🤝 ✅

- **Build a team.** Drop one robot on another and they form a **team**: the
  robots **line up**, one behind the other, as **separate robots** on the floor —
  each keeping its own thought bubble. Drag the front robot and the whole line
  follows; **grab any teammate to pull it back off** into a solo robot.
- **They take turns.** Hand the team a box and it goes to the **front robot
  first**; if that one doesn't match, it's passed down the line until one does —
  and as the box changes mid-run, a different member can pick up the next pass
  (the manual's cooperating team).
- **Copy the whole team.** The magic wand in **"copy self"** mode duplicates a
  robot *with its teammates* — the copy spreads out as its own separate line.
- **File a team as one page.** Drop a team lead into the notebook (or load it
  into a truck, or pour it into a blank box) and the **whole team** goes with it
  as a single page; take that page back out and the team **comes back out lined
  up**. Save/load preserves it.
- Faithful to the C++ `first_in_line`/`next` team model. 210 unit tests green,
  plus real-interaction guards (`team-floor.mjs`, `team-copy-file.mjs`).

## Status: Lively animations — the bam-mouse, flying birds & hatching eggs ✅

- **The hammer comes down.** Combining two number/text pads (or joining boxes)
  now plays the **full 22-frame bam-mouse**: it runs in, plants itself, *slams*
  its big red hammer down to smash the lego brick into clay — and the result
  pops in at the exact moment of impact — then runs back out. (Before, it only
  had the 4-frame run cycle, so the hammer never actually struck.)
- **Birds fly where they're going.** A delivering bird now **faces its flight
  direction** (all 8 directional `BIRD.TTS` cycles) — out to the nest, then
  turned around for the trip home — instead of one fixed side-on flap.
- **Eggs hatch.** A fresh nest is an egg: it now **cracks open** and the newborn
  bird **flies up out of the nest**, growing to full size, before settling in to
  feed it.
- All use the original art, baked by `tools/bake-mouse.py` / `bake-bird.py` /
  `bake-nest.py`. 175 unit tests still green.

## Status: The bomb 💣 ✅ (faithful — recycles a house)

- **Recycle a running process.** A bomb blows up a **house** — the running
  process a robot team works in — and is then consumed. That's its real job in
  ToonTalk: deallocating finished houses.
- **Bombs only work on a house.** Dropped on a loose thing or a box, the bomb is
  *refused* and stays put (the original aborts with "bombs only work inside
  houses"); to delete a loose object you use **Dusty**. (Earlier our bomb
  destroyed any target — that was a divergence, now matched to `bomb.cpp`.)
- Authentic art from `BOMB04`.

## Status: Dusty + erasing + thought bubbles ✅

- **Real conditionals.** A trained robot now matches the **exact values** it was
  shown by default (a guard), not just the shape. To generalize, **erase** the
  inputs first.
- **Dusty** (the vacuum) is a tool: drop it on a thing — loose or in a box hole —
  to toggle it *erased* (rendered faded). Erased holes become wildcards ("any").
- **Thought bubble.** A trained robot shows its condition in a cloud above it:
  exact required values, or a faded "any" for erased holes.
- Authentic art: Dusty (`SUCK0`), the bubble (`BUBBL10`), and flood-fill
  transparency so sprite interiors stay solid.
- Persisted (erased flag + value guards survive save/load). 53 unit tests.

## Status: Extraction ✅

- **Take things out of containers:** drag a thing out of a box hole, or grab the
  delivered item off a nest — it becomes a loose object again.
- **Robots can remove** too: a `remove` action empties a hole during a run.
- Foundation for full-featured training (recording extractions/insertions) and
  for Dusty the vacuum (erasing). 48 unit tests total.

## Status: Persistence ✅

- **Save / Load / Reset** controls (top-right). Save downloads the world as JSON;
  Load opens one back up; Reset returns to the demo world.
- **Autosave**: the world is saved to the browser on every change and restored on
  refresh, so work isn't lost. Everything serializes through each thing's
  snapshot — the same groundwork that will let us import the original `.tt` files.
- A thing delivered to a nest (or held in a box hole) now renders as its **real
  self** — a box looks like a box, not a text description.
- 44 unit tests total (added a persistence round-trip suite).

## Status: Phase 3 — Robots ✅

- **Robots**, trained by example: a robot remembers the *shape* of the box it
  was shown (its condition) and a list of demonstrated actions. Given a new box
  it runs only if the box matches, then replays the actions — so one example
  generalizes to any matching input.
  - Condition matching by hole shape (empty, or a thing of a given kind).
  - `combine` actions (drop one hole's thing onto another's), with an optional
    operation override (an adder vs a multiplier robot).
  - `runRobot` engine + `trainByExample` helper; **drop a trained robot on a box
    (or vice versa) to run it.** A pre-trained adder and a ready box are seeded.
  - **Interactive training:** drop an *untrained* robot on a filled box to start
    a session, then demonstrate by dragging from one hole onto another (applied
    live and recorded). **Enter** finishes — the robot captures the box's shape
    as its condition and can then run on any matching box. **Esc** cancels.
  - 14 robot/trainer unit tests (matching, generalization, multiply, text,
    no-match, live recording, finish-then-run).

## Status: Phase 2 — Birds, nests & the wand ✅

- Strict-typed Vite 7 + TypeScript + PixiJS project, Vitest 4 (0 audit issues).
- **Model / view split**: everything in `src/model/` is pure logic with no
  rendering imports, so ToonTalk's semantics are unit-testable and serializable.
- Drag/drop targets by the dragged object's overlap + center (matches the
  original "drop it on the side" feel), with pointer + touch and a render-mode
  flag (`faithful` / `modern`).
- **Objects so far:**
  - `NumberThing` — exact arbitrary-precision arithmetic via `Rational`
    (BigInt). Number-on-number combines using the dragged number's op (`+ − × ÷`).
  - `TextThing` — text-on-text concatenates; which side you drop on sets order.
  - `Box` — holes you can fill; dropping onto a filled hole combines in place.
  - `Bird` + `Nest` — give a thing to a bird and it's delivered to the nest
    (which shows the latest delivery and a count).
  - `Wand` — drop it on any thing to make an independent copy.
- 25 unit tests across rationals and every drop interaction.

Phases 0–1 (foundation, model/view split, numbers/text/boxes) are included.

## Run it

```bash
cd toontalk-web
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run typecheck  # tsc --noEmit (strict)
npm test           # vitest model unit tests
npm run build      # typecheck + production build
```

## Render modes

The look is controlled by a single flag read only by the view layer:

- `?mode=faithful` (default) — nearest-neighbor scaling, original palette feel.
- `?mode=modern` — smoothed textures, soft drop shadows, drag glow.

A toggle link in the top-right switches between them. Add new visual differences
in `src/config/render-mode.ts`.

## Layout

```
src/
  config/render-mode.ts   render flag + theme (view-only)
  model/                  pure ToonTalk logic — NO rendering
    thing.ts              base Thing + Placeholder
    rational.ts           exact BigInt rationals
    number.ts, text.ts, box.ts   the objects
    interactions.ts       resolveDrop: the combine rules
    world.ts              object registry + change events
  view/                   PixiJS rendering
    thing-view.ts         base view
    sprite/number/text/box-view.ts, pad.ts, view-factory.ts
    renderer.ts, assets.ts
  input/drag-controller.ts   geometry → resolveDrop
  main.ts                 bootstrap
test/                     rational + interactions + model tests
```

## Next

- Phase 4 tools: the vacuum (Dusty, ✅) and the bomb (✅) are done. Still to
  come: trucks (spawn running processes) — at which point the bomb also gains its
  full meaning, terminating a running robot team.
- Polish: visible bird flight and a brief robot run animation.
```
