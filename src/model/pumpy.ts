/**
 * Pumpy — ToonTalk's resize tool. Drop Pumpy on a thing to change its size
 * according to Pumpy's current mode (its button cycles them):
 * bigger / smaller (both dimensions), wider / narrower (x), taller / shorter
 * (y), and good-size (reset to natural). Pumpy is not consumed.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export type PumpyMode =
  | 'bigger'
  | 'smaller'
  | 'wider'
  | 'narrower'
  | 'taller'
  | 'shorter'
  | 'good';

export interface PumpySnapshot extends ThingSnapshot {
  mode: PumpyMode;
}

const MODE_ORDER: PumpyMode[] = ['bigger', 'smaller', 'wider', 'narrower', 'taller', 'shorter', 'good'];
const STEP = 1.25;
const MIN = 0.4;
const MAX = 3;
const clamp = (v: number): number => Math.max(MIN, Math.min(MAX, v));

export class Pumpy extends Thing {
  readonly kind = 'pumpy' as const;
  mode: PumpyMode;

  constructor(opts: { id?: string; x?: number; y?: number; mode?: PumpyMode } = {}) {
    super(opts);
    this.mode = opts.mode ?? 'bigger';
  }

  protected override kindForId(): ThingKind {
    return 'pumpy';
  }

  cycleMode(): void {
    this.mode = MODE_ORDER[(MODE_ORDER.indexOf(this.mode) + 1) % MODE_ORDER.length]!;
  }

  copy(): Pumpy {
    return new Pumpy({ x: this.x, y: this.y, mode: this.mode });
  }

  equals(other: Thing): boolean {
    return other instanceof Pumpy;
  }

  describe(): string {
    return `pumpy(${this.mode})`;
  }

  override snapshot(): PumpySnapshot {
    return { ...super.snapshot(), mode: this.mode };
  }
}

/** Apply a Pumpy mode to a thing's size (clamped to a sensible range). */
export function resizeThing(thing: Thing, mode: PumpyMode): void {
  switch (mode) {
    case 'bigger':
      thing.scaleX = clamp(thing.scaleX * STEP);
      thing.scaleY = clamp(thing.scaleY * STEP);
      break;
    case 'smaller':
      thing.scaleX = clamp(thing.scaleX / STEP);
      thing.scaleY = clamp(thing.scaleY / STEP);
      break;
    case 'wider':
      thing.scaleX = clamp(thing.scaleX * STEP);
      break;
    case 'narrower':
      thing.scaleX = clamp(thing.scaleX / STEP);
      break;
    case 'taller':
      thing.scaleY = clamp(thing.scaleY * STEP);
      break;
    case 'shorter':
      thing.scaleY = clamp(thing.scaleY / STEP);
      break;
    case 'good':
      thing.scaleX = 1;
      thing.scaleY = 1;
      break;
  }
}
