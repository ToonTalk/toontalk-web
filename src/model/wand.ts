/**
 * The magic wand: ToonTalk's copying tool. Drop it on a thing and a copy
 * appears; the wand isn't consumed. Its button cycles three modes:
 *  - **C** (copy): a normal copy, *restored* (un-erased) — the default.
 *  - **O** (original): copy preserving the erased/wildcard state (picture.cpp:
 *    "in 'original' mode don't restore things").
 *  - **S** (copy self): copy a robot *with its whole team* (so teams/recursion
 *    can be duplicated); for other things it's a plain copy.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export type WandMode = 'C' | 'O' | 'S';

export interface WandSnapshot extends ThingSnapshot {
  mode: WandMode;
}

const MODE_ORDER: WandMode[] = ['C', 'O', 'S'];

export class Wand extends Thing {
  readonly kind = 'wand' as const;
  mode: WandMode;

  constructor(opts: { id?: string; x?: number; y?: number; mode?: WandMode } = {}) {
    super(opts);
    this.mode = opts.mode ?? 'C';
  }

  protected override kindForId(): ThingKind {
    return 'wand';
  }

  cycleMode(): void {
    this.mode = MODE_ORDER[(MODE_ORDER.indexOf(this.mode) + 1) % MODE_ORDER.length]!;
  }

  copy(): Wand {
    return new Wand({ x: this.x, y: this.y, mode: this.mode });
  }

  equals(other: Thing): boolean {
    return other instanceof Wand;
  }

  describe(): string {
    return `wand(${this.mode})`;
  }

  override snapshot(): WandSnapshot {
    return { ...super.snapshot(), mode: this.mode };
  }
}
