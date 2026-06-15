/**
 * Dusty the vacuum — a multi-mode tool (its nose button cycles the mode):
 *  - **erase**: touch a thing to toggle it *erased* (a wildcard a robot matches
 *    by kind, not exact value); on a trained robot, clears its value guards.
 *  - **suck**: vacuum a thing up into Dusty's stomach (it leaves the world).
 *  - **reverse**: spit the last sucked thing back out.
 * Dusty itself is never consumed. The nose button cycles suck → reverse → erase
 * and a fresh Dusty starts in **suck**, faithful to the original (tools.cpp Vacuum
 * ctor `state = VACUUM_SUCK`:1458; the `VacuumState` enum tools.h:249 is
 * `{VACUUM_SUCK, VACUUM_SPIT(=reverse), VACUUM_BLANK(=erase)}`).
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export type VacuumMode = 'suck' | 'reverse' | 'erase';

export interface DustySnapshot extends ThingSnapshot {
  mode: VacuumMode;
  stomach: ThingSnapshot[];
}

// Order matches the VacuumState enum: SUCK, SPIT (reverse), BLANK (erase).
const MODE_ORDER: VacuumMode[] = ['suck', 'reverse', 'erase'];

export class Dusty extends Thing {
  readonly kind = 'dusty' as const;
  mode: VacuumMode;
  /** Things sucked up, last-in-first-out (reverse spits the most recent). */
  readonly stomach: Thing[];

  constructor(opts: { id?: string; x?: number; y?: number; mode?: VacuumMode; stomach?: Thing[] } = {}) {
    super(opts);
    this.mode = opts.mode ?? 'suck';
    this.stomach = opts.stomach ?? [];
  }

  protected override kindForId(): ThingKind {
    return 'dusty';
  }

  /** Cycle the nose button: suck → reverse → erase → suck. */
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
