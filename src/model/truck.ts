/**
 * A truck. Drop a robot (team) and a box into a truck and its crew drives off to
 * build a house, where the robot works on the box (a running process) — see
 * truck.cpp `fill_house` / `initial_contents`. The truck needs *both* a robot
 * and a box before it leaves; until then it holds what it's been given.
 *
 * We model the load here; `resolveDrop` builds the House once the truck is full.
 * Pure logic — no rendering.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { Box } from './box';
import type { Robot } from './robot';

export class Truck extends Thing {
  readonly kind = 'truck' as const;
  /** The robot (team lead) loaded so far, if any. */
  robot: Robot | null = null;
  /** The box loaded so far, if any. */
  box: Box | null = null;

  constructor(opts: { id?: string; x?: number; y?: number } = {}) {
    super(opts);
  }

  protected override kindForId(): ThingKind {
    return 'truck';
  }

  /** True once both a robot and a box are aboard — ready to drive off. */
  loaded(): boolean {
    return this.robot !== null && this.box !== null;
  }

  copy(): Truck {
    return new Truck({ x: this.x, y: this.y });
  }

  equals(other: Thing): boolean {
    return other instanceof Truck;
  }

  describe(): string {
    return 'truck';
  }

  // A truck's cargo isn't persisted on its own (it's transient until it drives
  // off and becomes a house); a saved half-loaded truck reloads empty.
  override snapshot(): ThingSnapshot {
    return { ...super.snapshot() };
  }
}
