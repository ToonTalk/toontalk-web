/**
 * The magic wand: ToonTalk's copying tool. Drop the wand on a thing and a copy
 * of that thing appears. The wand itself is not consumed.
 */
import { Thing, type ThingKind } from './thing';

export class Wand extends Thing {
  readonly kind = 'wand' as const;

  constructor(opts: { id?: string; x?: number; y?: number } = {}) {
    super(opts);
  }

  protected override kindForId(): ThingKind {
    return 'wand';
  }

  copy(): Wand {
    return new Wand({ x: this.x, y: this.y });
  }

  equals(other: Thing): boolean {
    return other instanceof Wand;
  }

  describe(): string {
    return 'wand';
  }
}
