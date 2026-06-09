/**
 * A house — a running process. A truck builds a house from a robot (team) and a
 * box; the robot then works on that box in the house, over and over. The house
 * is driven by a periodic step (see main.ts): each tick the front-to-back team
 * is offered the box and the first matching robot runs, so a house fed by a bird
 * keeps reacting to deliveries.
 *
 * (In full ToonTalk a house is a room you fly into; we postpone the city and
 * show the house in place on the floor.) Pure logic — no rendering.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { World } from './world';
import { Box, type BoxSnapshot } from './box';
import { Robot, type RobotSnapshot, applyAction } from './robot';
import { recomputeScales } from './scale';

export interface HouseSnapshot extends ThingSnapshot {
  robot: RobotSnapshot;
  box: BoxSnapshot;
}

export class House extends Thing {
  readonly kind = 'house' as const;
  /** The lead robot of the team living here. */
  robot: Robot;
  /** The box the team works on. */
  box: Box;

  constructor(opts: { id?: string; x?: number; y?: number; robot: Robot; box: Box }) {
    super(opts);
    this.robot = opts.robot;
    this.box = opts.box;
  }

  protected override kindForId(): ThingKind {
    return 'house';
  }

  copy(): House {
    return new House({ x: this.x, y: this.y, robot: this.robot.copy(), box: this.box.copy() });
  }

  equals(other: Thing): boolean {
    return other instanceof House;
  }

  describe(): string {
    return `house(${this.robot.describe()} · ${this.box.describe()})`;
  }

  override snapshot(): HouseSnapshot {
    return { ...super.snapshot(), robot: this.robot.snapshot(), box: this.box.snapshot() };
  }
}

/**
 * One step of a house's process: offer the box to the team front-to-back and run
 * the first matching robot. Returns whether a robot ran (so the view can
 * refresh). The box is internal to the house, so this notifies the *house*.
 */
export function runHouse(world: World, house: House): boolean {
  recomputeScales(house.box);
  const runner = house.robot.lineup().find((r) => r.actions.length > 0 && r.matches(house.box));
  if (!runner) return false;
  for (const action of runner.actions) applyAction(house.box, action);
  recomputeScales(house.box);
  world.notifyChanged(house);
  return true;
}
