/**
 * The bomb: ToonTalk's recycler. It terminates a running process — the **house**
 * it's used on (a robot team working in a built house) — and is *consumed* when
 * it detonates. A bomb "only works inside a house" (bomb.cpp `Bomb::used`:105):
 * dropped on a loose object or a box it is refused and stays put. Deleting a
 * loose thing is Dusty's job, not the bomb's.
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
