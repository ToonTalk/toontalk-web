/**
 * A bird. Give a thing to a bird and it carries a copy to each of its nests.
 *
 * A bird usually feeds one nest, but **copying a nest makes the bird feed both**
 * (bird.cpp / the manual): the same bird then delivers to every copy, which is
 * how ToonTalk keeps copied communication channels in sync. So a bird holds a
 * *list* of nests.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import { Nest } from './nest';
import type { World } from './world';

export interface BirdSnapshot extends ThingSnapshot {
  nestIds: string[];
}

export class Bird extends Thing {
  readonly kind = 'bird' as const;
  /** Every nest this bird delivers to (usually one; more after a nest is copied). */
  nests: Nest[];

  constructor(opts: { id?: string; x?: number; y?: number; nests?: Nest[] } = {}) {
    super(opts);
    this.nests = opts.nests ?? [];
  }

  protected override kindForId(): ThingKind {
    return 'bird';
  }

  /** A copied bird feeds the same nests as the original. */
  copy(): Bird {
    return new Bird({ x: this.x, y: this.y, nests: [...this.nests] });
  }

  equals(other: Thing): boolean {
    return other instanceof Bird;
  }

  describe(): string {
    return 'bird';
  }

  override snapshot(): BirdSnapshot {
    return { ...super.snapshot(), nestIds: this.nests.map((n) => n.id) };
  }
}

/**
 * Hatch a bird from a nest's egg: a nest with no delivery and no bird feeding it
 * is an egg, and pressing it gives a fresh bird (added to the world at x,y) that
 * feeds the nest. Returns the new bird, or null if the nest isn't an egg.
 */
export function hatchFromNest(world: World, nest: Nest, x: number, y: number): Bird | null {
  if (nest.contents.length > 0) return null;
  const hasBird = world.all().some((t) => t instanceof Bird && t.nests.includes(nest));
  if (hasBird) return null;
  const bird = new Bird({ nests: [nest], x, y });
  world.add(bird);
  nest.hatched = true; // the egg is gone — show an empty nest now
  world.notifyChanged(nest);
  return bird;
}
