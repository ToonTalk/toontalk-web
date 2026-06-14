/**
 * A box: ToonTalk's fundamental container. It has a fixed number of holes, each
 * either empty or holding another Thing (including, eventually, other boxes).
 * Boxes are how data is structured and how robots' conditions are expressed.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { Side } from './text';

export interface BoxSnapshot extends ThingSnapshot {
  holes: (ThingSnapshot | null)[];
  blank?: boolean;
}

export class Box extends Thing {
  readonly kind = 'box' as const;
  readonly holes: (Thing | null)[];
  /**
   * A "blank" box has no fixed size yet (cubby.cpp `blank`). Dropping a thing on
   * it sizes/fills it via `fill` (set_to_future_value): a number → that many
   * holes, text → one hole per character, a robot team → a hole per robot, a
   * notebook → a hole per page. A non-blank box just fills the targeted hole.
   */
  blank: boolean;

  constructor(opts: {
    id?: string;
    x?: number;
    y?: number;
    size?: number;
    holes?: (Thing | null)[];
    blank?: boolean;
  }) {
    super(opts);
    this.blank = opts.blank ?? false;
    this.holes = opts.holes ?? (this.blank ? [] : new Array<Thing | null>(opts.size ?? 2).fill(null));
  }

  protected override kindForId(): ThingKind {
    return 'box';
  }

  get size(): number {
    return this.holes.length;
  }

  isHoleEmpty(i: number): boolean {
    return this.holes[i] == null;
  }

  contentsAt(i: number): Thing | null {
    return this.holes[i] ?? null;
  }

  put(i: number, thing: Thing): void {
    this.holes[i] = thing;
  }

  take(i: number): Thing | null {
    const t = this.holes[i] ?? null;
    this.holes[i] = null;
    return t;
  }

  /**
   * Merge another box's holes into this one, like joining text pads: dropping on
   * the right side appends the other box's holes after ours; the left side
   * prepends them. The other box is consumed by the caller.
   */
  join(other: Box, side: Side): void {
    if (side === 'left') this.holes.unshift(...other.holes);
    else this.holes.push(...other.holes);
    this.blank = false;
  }

  /** Give a blank box its holes (cubby.cpp set_to_future_value) — it stops being
   * blank and from now on behaves like an ordinary fixed-size box. */
  fill(holes: (Thing | null)[]): void {
    this.holes.length = 0;
    this.holes.push(...holes);
    this.blank = false;
  }

  copy(): Box {
    return new Box({
      x: this.x,
      y: this.y,
      blank: this.blank,
      holes: this.holes.map((h) => (h ? h.copy() : null)),
    });
  }

  equals(other: Thing): boolean {
    if (!(other instanceof Box) || other.blank !== this.blank || other.size !== this.size) return false;
    return this.holes.every((h, i) => {
      const oh = other.holes[i];
      if (h == null && oh == null) return true;
      if (h == null || oh == null) return false;
      return h.equals(oh);
    });
  }

  describe(): string {
    if (this.blank) return '[blank box]';
    return `[${this.holes.map((h) => (h ? h.describe() : '_')).join(' | ')}]`;
  }

  override snapshot(): BoxSnapshot {
    return {
      ...super.snapshot(),
      blank: this.blank,
      holes: this.holes.map((h) => (h ? h.snapshot() : null)),
    };
  }
}
