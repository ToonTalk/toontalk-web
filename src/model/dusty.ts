/**
 * Dusty the vacuum — ToonTalk's erasing tool. Touch a thing with Dusty and it
 * becomes "erased": a wildcard that a robot's condition matches by kind rather
 * than by exact value. Dusty itself is never consumed.
 */
import { Thing, type ThingKind } from './thing';

export class Dusty extends Thing {
  readonly kind = 'dusty' as const;

  constructor(opts: { id?: string; x?: number; y?: number } = {}) {
    super(opts);
  }

  protected override kindForId(): ThingKind {
    return 'dusty';
  }

  copy(): Dusty {
    return new Dusty({ x: this.x, y: this.y });
  }

  equals(other: Thing): boolean {
    return other instanceof Dusty;
  }

  describe(): string {
    return 'dusty';
  }
}
