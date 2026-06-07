/**
 * A bird. Give a thing to a bird and it carries it to its nest. Birds and nests
 * come in linked pairs. (Flight animation is a later polish; the model just
 * delivers to the nest.)
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import type { Nest } from './nest';

export interface BirdSnapshot extends ThingSnapshot {
  nestId: string | null;
}

export class Bird extends Thing {
  readonly kind = 'bird' as const;
  nest: Nest | null;

  constructor(opts: { id?: string; x?: number; y?: number; nest?: Nest | null } = {}) {
    super(opts);
    this.nest = opts.nest ?? null;
  }

  protected override kindForId(): ThingKind {
    return 'bird';
  }

  /** A copied bird shares the same nest as the original. */
  copy(): Bird {
    return new Bird({ x: this.x, y: this.y, nest: this.nest });
  }

  equals(other: Thing): boolean {
    return other instanceof Bird;
  }

  describe(): string {
    return 'bird';
  }

  override snapshot(): BirdSnapshot {
    return { ...super.snapshot(), nestId: this.nest?.id ?? null };
  }
}
