---
name: new-element
description: Faithful scaffold checklist for adding a new ToonTalk element (a new Thing kind, e.g. pictures, sounds, joystick sensor) or substantially extending one. Use whenever a new element is requested, to guarantee the manual + original C++ are consulted first and every required file is touched.
---

# Adding a ToonTalk element, faithfully

Work through these steps in order. The guiding principle applies: **match the
original; hold enhancements** until documented behavior works.

## 1. Ground truth first — never guess

- Read the element's manual page: `https://toontalk.com/English/<element>.htm`
  (see the list in CLAUDE.md / `docs/elements.md`).
- Read the original C++: `C:\Users\toont\dev\source\<element>.cpp`
  (boxes = `cubby.cpp`; animation/selection = `sprite.cpp`/`animate.cpp`;
  interaction = `dragdrop.cpp`/`mouse.cpp`/`input.cpp`).
- Note exact behaviors, modes, key bindings, and what is/isn't consumed.
  Add a digest entry to `docs/elements.md` BEFORE coding (▢ items included).

## 2. Art

- Source bitmaps: `C:\Users\toont\dev\M25\` (primary), fall back to `M22/`
  (low-res, but has a few images missing from M25). `.TTS` format, offsets and
  per-asset exceptions are in `ASSET_GUIDE.md`; manifest via
  `tools/parse-tts.py` → `tools/tts-manifest.json`. Black is the transparency
  key (watch the green/magenta-keyed plate exceptions).
- Animation cycles: bake frames pre-aligned (each frame's `-ox,-oy`) to
  `public/assets/anim/<name>/NN.png` and add a spec to `ANIMATIONS`
  (see `docs/assets.md`).

## 3. Model first (pure, testable)

- `src/model/<x>.ts` — subclass `Thing`; implement `copy`/`equals`/`describe`/
  `snapshot`. **No rendering imports in `src/model/`.**
- `src/model/thing.ts` — add to `ThingKind`.
- `src/model/interactions.ts` — drop behavior in `resolveDrop`, returning a
  `DropResult` string for the HUD. Remember: tools (wand, dusty, pumpy) are
  held, NOT consumed on use; the bomb IS consumed.
- `src/model/persistence.ts` — `buildByKind` case; round-trips all state.

## 4. View

- Default: `SpriteView` keys off `thing.kind` → `<kind>.png`.
- Bespoke view only if the element needs one (cf. number/text/box/nest/robot).
- If it's a held tool, wire it through `drag-controller.ts` (`heldTool`,
  `applyHeldTool`, mode keys) rather than drag-and-drop.

## 5. Seed, test, verify

- Seed an instance in `main.ts`'s demo.
- Vitest file covering: model behavior, `resolveDrop` rules, robot-matching
  (`equals`) where relevant, persistence round-trip.
- `npm run typecheck` and `npm test` must be green.
- Visual check with the **verify-app** skill (`tools/verify/snap.mjs`) — not
  the preview screenshot tool.

## 6. Record it

- README top changelog entry.
- Update the element's entry in `docs/elements.md` (flip ▢ → ✅/⚠ honestly;
  list remaining divergences).
- Update the status table row in CLAUDE.md.
- Commit (authored as Ken Kahn / toontalk@gmail.com) only with typecheck +
  tests green.
