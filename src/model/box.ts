/**
 * A box: ToonTalk's fundamental container. It has a fixed number of holes, each
 * either empty or holding another Thing (including, eventually, other boxes).
 * Boxes are how data is structured and how robots' conditions are expressed.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export interface BoxSnapshot extends ThingSnapshot {
  holes: (ThingSnapshot | null)[];
}

export class Box extends Thing {
  readonly kind = 'box' as const;
  readonly holes: (Thing | null)[];

  constructor(opts: {
    id?: string;
    x?: number;
    y?: number;
    size?: number;
    holes?: (Thing | null)[];
  }) {
    super(opts);
    this.holes = opts.holes ?? new Array<Thing | null>(opts.size ?? 2).fill(null);
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

  copy(): Box {
    return new Box({ x: this.x, y: this.y, holes: this.holes.map((h) => (h ? h.copy() : null)) });
  }

  equals(other: Thing): boolean {
    if (!(other instanceof Box) || other.size !== this.size) return false;
    return this.holes.every((h, i) => {
      const oh = other.holes[i];
      if (h == null && oh == null) return true;
      if (h == null || oh == null) return false;
      return h.equals(oh);
    });
  }

  describe(): string {
    return `[${this.holes.map((h) => (h ? h.describe() : '_')).join(' | ')}]`;
  }

  override snapshot(): BoxSnapshot {
    return { ...super.snapshot(), holes: this.holes.map((h) => (h ? h.snapshot() : null)) };
  }
}
