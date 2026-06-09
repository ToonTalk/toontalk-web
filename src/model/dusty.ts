/**
 * Dusty the vacuum — a multi-mode tool (its nose button cycles the mode):
 *  - **erase**: touch a thing to toggle it *erased* (a wildcard a robot matches
 *    by kind, not exact value); on a trained robot, clears its value guards.
 *  - **suck**: vacuum a thing up into Dusty's stomach (it leaves the world).
 *  - **reverse**: spit the last sucked thing back out.
 * Dusty itself is never consumed. (We default to *erase*, which our robot
 * wildcard workflow leans on; the original's nose-button default is suck.)
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export type VacuumMode = 'erase' | 'suck' | 'reverse';

export interface DustySnapshot extends ThingSnapshot {
  mode: VacuumMode;
  stomach: ThingSnapshot[];
}

const MODE_ORDER: VacuumMode[] = ['erase', 'suck', 'reverse'];

export class Dusty extends Thing {
  readonly kind = 'dusty' as const;
  mode: VacuumMode;
  /** Things sucked up, last-in-first-out (reverse spits the most recent). */
  readonly stomach: Thing[];

  constructor(opts: { id?: string; x?: number; y?: number; mode?: VacuumMode; stomach?: Thing[] } = {}) {
    super(opts);
    this.mode = opts.mode ?? 'erase';
    this.stomach = opts.stomach ?? [];
  }

  protected override kindForId(): ThingKind {
    return 'dusty';
  }

  /** Cycle the nose button: erase → suck → reverse → erase. */
  cycleMode(): void {
    this.mode = MODE_ORDER[(MODE_ORDER.indexOf(this.mode) + 1) % MODE_ORDER.length]!;
  }

  copy(): Dusty {
    return new Dusty({ x: this.x, y: this.y, mode: this.mode }); // a fresh, empty stomach
  }

  equals(other: Thing): boolean {
    return other instanceof Dusty;
  }

  describe(): string {
    return `dusty(${this.mode})`;
  }

  override snapshot(): DustySnapshot {
    return { ...super.snapshot(), mode: this.mode, stomach: this.stomach.map((s) => s.snapshot()) };
  }
}
