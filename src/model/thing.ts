/**
 * The base of every ToonTalk object is a "Thing": something with identity and
 * a position in the world that can be picked up, moved, copied, and (later)
 * matched against and acted on by robots.
 *
 * This file is intentionally free of any rendering or DOM code. Everything here
 * is pure data + logic so it can be unit-tested and, later, serialized to and
 * from the original .tt world format.
 */

export type ThingKind =
  | 'number'
  | 'text'
  | 'box'
  | 'bird'
  | 'nest'
  | 'robot'
  | 'scale'
  | 'wand'
  | 'dusty'
  | 'bomb'
  | 'truck'
  | 'house'
  | 'notebook'
  | 'placeholder';

export interface Point {
  x: number;
  y: number;
}

/** Plain serializable snapshot of a Thing — the unit of save/load. */
export interface ThingSnapshot {
  id: string;
  kind: ThingKind;
  x: number;
  y: number;
  erased?: boolean;
}

let nextId = 1;
function freshId(kind: ThingKind): string {
  return `${kind}-${nextId++}`;
}

export abstract class Thing {
  readonly id: string;
  abstract readonly kind: ThingKind;
  x: number;
  y: number;
  /** Erased (by Dusty) → acts as a wildcard in a robot's condition. */
  erased: boolean;

  constructor(opts: { id?: string; x?: number; y?: number; erased?: boolean } = {}) {
    this.id = opts.id ?? freshId(this.kindForId());
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.erased = opts.erased ?? false;
  }

  /** Subclasses override only if id prefix should differ from kind. */
  protected kindForId(): ThingKind {
    return 'placeholder';
  }

  moveTo(p: Point): void {
    this.x = p.x;
    this.y = p.y;
  }

  /** Deep, independent copy with a new identity (the wand will use this). */
  abstract copy(): Thing;

  /** Structural equality, ignoring identity and position. */
  abstract equals(other: Thing): boolean;

  /** A human-readable label for HUD/debugging. */
  abstract describe(): string;

  snapshot(): ThingSnapshot {
    return { id: this.id, kind: this.kind, x: this.x, y: this.y, erased: this.erased };
  }
}

/**
 * A minimal concrete Thing used in Phase 0 to exercise the engine before the
 * real ToonTalk objects (numbers, boxes, robots…) land in later phases.
 */
export class Placeholder extends Thing {
  readonly kind = 'placeholder' as const;
  /** Which sprite texture this stands in for. */
  readonly sprite: string;

  constructor(opts: { id?: string; x?: number; y?: number; sprite: string }) {
    super(opts);
    this.sprite = opts.sprite;
  }

  protected override kindForId(): ThingKind {
    return 'placeholder';
  }

  copy(): Placeholder {
    return new Placeholder({ x: this.x, y: this.y, sprite: this.sprite });
  }

  equals(other: Thing): boolean {
    return other instanceof Placeholder && other.sprite === this.sprite;
  }

  describe(): string {
    return `placeholder(${this.sprite})`;
  }
}
