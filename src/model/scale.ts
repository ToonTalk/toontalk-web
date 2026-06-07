/**
 * The scale (balance) — ToonTalk's comparison tool.
 *
 * A scale sits in a box hole that has holes on both sides and weighs its two
 * immediate neighbours: it tilts toward the bigger number (or the text that
 * comes later alphabetically), or stays balanced when they're equal. If a
 * neighbour is removed (empty hole) it totters and matches nothing; if a
 * neighbour is *erased* by Dusty the scale keeps its previous tilt — that's how
 * you generalise, so a robot can match "first < second" for any values.
 *
 * Robots condition on the tilt: a captured scale guards on its tilt state, so
 * one trained example ("swap if the first is less than the second") runs on any
 * box whose scale tilts the same way. Pure logic — no rendering.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { Box } from './box';
import { NumberThing } from './number';
import { TextThing } from './text';

export type Tilt = 'left' | 'right' | 'balanced' | 'tottering';

export interface ScaleSnapshot extends ThingSnapshot {
  tilt: Tilt;
}

export class Scale extends Thing {
  readonly kind = 'scale' as const;
  /** Which way the balance leans; 'tottering' = can't decide (matches nothing). */
  tilt: Tilt;

  constructor(opts: { id?: string; x?: number; y?: number; tilt?: Tilt } = {}) {
    super(opts);
    this.tilt = opts.tilt ?? 'tottering';
  }

  protected override kindForId(): ThingKind {
    return 'scale';
  }

  copy(): Scale {
    return new Scale({ x: this.x, y: this.y, tilt: this.tilt });
  }

  equals(other: Thing): boolean {
    if (!(other instanceof Scale)) return false;
    // A tottering scale settles on nothing, so it never matches.
    if (this.tilt === 'tottering' || other.tilt === 'tottering') return false;
    return this.tilt === other.tilt;
  }

  describe(): string {
    return `scale(${this.tilt})`;
  }

  override snapshot(): ScaleSnapshot {
    return { ...super.snapshot(), tilt: this.tilt };
  }
}

/** How the balance leans when weighing `left` against `right`. */
export function compareTilt(left: Thing, right: Thing): Tilt {
  if (left instanceof NumberThing && right instanceof NumberThing) {
    const c = left.value.compare(right.value);
    return c > 0 ? 'left' : c < 0 ? 'right' : 'balanced';
  }
  if (left instanceof TextThing && right instanceof TextThing) {
    const c = left.value.localeCompare(right.value);
    return c > 0 ? 'left' : c < 0 ? 'right' : 'balanced';
  }
  return 'tottering'; // incomparable kinds
}

/**
 * Recompute every scale in a box from its immediate neighbours. A scale with a
 * missing neighbour totters; one with an *erased* neighbour keeps its current
 * tilt (so erasing the operands generalises the comparison).
 */
export function recomputeScales(box: Box): void {
  for (let i = 0; i < box.size; i++) {
    const s = box.contentsAt(i);
    if (!(s instanceof Scale)) continue;
    const left = i - 1 >= 0 ? box.contentsAt(i - 1) : null;
    const right = i + 1 < box.size ? box.contentsAt(i + 1) : null;
    if (!left || !right) {
      s.tilt = 'tottering';
      continue;
    }
    if (left.erased || right.erased) continue; // keep previous tilt
    s.tilt = compareTilt(left, right);
  }
}
