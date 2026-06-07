/**
 * The bomb: ToonTalk's terminating tool. Drop the bomb on a thing and it blows
 * that thing up — a loose object vanishes, or the contents of a box hole are
 * destroyed (the box itself survives). Unlike the wand and Dusty, the bomb is
 * *consumed* when it detonates.
 *
 * In full ToonTalk a bomb also terminates a running process (a robot team on a
 * truck); that meaning arrives with trucks. For now it simply destroys its
 * target, which is the same primitive.
 */
import { Thing, type ThingKind } from './thing';

export class Bomb extends Thing {
  readonly kind = 'bomb' as const;

  constructor(opts: { id?: string; x?: number; y?: number } = {}) {
    super(opts);
  }

  protected override kindForId(): ThingKind {
    return 'bomb';
  }

  copy(): Bomb {
    return new Bomb({ x: this.x, y: this.y });
  }

  equals(other: Thing): boolean {
    return other instanceof Bomb;
  }

  describe(): string {
    return 'bomb';
  }
}
