# ToonTalk Web

A from-scratch web reimplementation of [ToonTalk](http://www.toontalk.com/), the
visual programming environment for children created by Ken Kahn (1992–2007).

This is a clean rewrite (TypeScript + PixiJS), not a port of the original
DirectX C++ — see `../TOONTALK_WEB_PLAN.md` for the rationale and roadmap.

## Status: The bomb 💣 ✅

- **Blow things up.** Drop the bomb on any thing and it's destroyed. Drop it on
  a *filled* box hole and only that hole's contents are blown up — the box
  itself survives. Drop it on a box (or an empty hole) and the whole box goes.
- Unlike the wand and Dusty, the **bomb is consumed** when it detonates (a miss
  with no target leaves it intact). Authentic art from `BOMB04`.
- First step toward terminating *running processes* once trucks land. 60 unit
  tests.

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
