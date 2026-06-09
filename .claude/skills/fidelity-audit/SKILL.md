---
name: fidelity-audit
description: Audit one ToonTalk element's behavior against the original manual page and the original C++ source, producing a ✅/⚠/▢ divergence report and updating docs/elements.md. Use when asked whether something is faithful/authentic, before polishing an element, after large refactors, or periodically to keep the fidelity ledger honest.
---

# Fidelity audit: `$ARGUMENTS`

Audit the named element (or, with no argument, the element most recently
worked on). The goal is an honest divergence ledger, not flattery.

## 1. Gather the three sources

1. **Manual** — fetch `https://toontalk.com/English/<page>.htm` (mapping:
   numbers=`newnum.htm`, boxes=`box.htm`; otherwise `<element>.htm`; index at
   `doc.htm`). Extract every stated behavior, gesture, mode, and key.
2. **Original source** — read `C:\Users\toont\dev\source\<element>.cpp`
   (boxes=`cubby.cpp`). This is ground truth for *exact* behavior (timings,
   state machines, edge cases) — quote line-level findings in the report.
3. **Our implementation** — read `src/model/<x>.ts`, its `resolveDrop` cases
   in `interactions.ts`, the view, the drag-controller wiring if it's a tool,
   and the element's tests.

## 2. Compare

Build a table:

| Behavior | Manual says | Original C++ does | Ours does | Status |
|---|---|---|---|---|

Status: ✅ matches · ⚠ divergence/simplification (say exactly how) · ▢ missing.
Include behaviors we have that the original *doesn't* (enhancements) — per the
guiding principle these should be flagged, not silently kept.

## 3. Verify claims empirically where cheap

- Run the element's tests; add a quick test if a claim is unverified.
- Use the **verify-app** skill for visual/runtime claims (screenshots or
  `--eval` snippets against `__ttWorld`) — not the preview screenshot tool.

## 4. Report & record

- Present the table plus a short prioritized fix list (smallest faithful fix
  first; no new features).
- Update the element's entry in `docs/elements.md` and the status row in
  CLAUDE.md so the ledger reflects reality.
- Do NOT silently change behavior during the audit — fixes are a separate,
  explicit step Ken approves.
