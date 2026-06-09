/**
 * A bird. Give a thing to a bird and it carries a copy to each of its nests.
 *
 * A bird usually feeds one nest, but **copying a nest makes the bird feed both**
 * (bird.cpp / the manual): the same bird then delivers to every copy, which is
 * how ToonTalk keeps copied communication channels in sync. So a bird holds a
 * *list* of nests.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { Nest } from './nest';

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
