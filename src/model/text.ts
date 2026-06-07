/**
 * A text pad. Holds a string. Dropping text A onto text B concatenates them;
 * which side of B the cursor is over decides the order (cursor on the left half
 * of B puts A before B, otherwise after).
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export type Side = 'left' | 'right';

export interface TextSnapshot extends ThingSnapshot {
  value: string;
}

export class TextThing extends Thing {
  readonly kind = 'text' as const;
  value: string;

  constructor(opts: { id?: string; x?: number; y?: number; value: string }) {
    super(opts);
    this.value = opts.value;
  }

  protected override kindForId(): ThingKind {
    return 'text';
  }

  /** Merge `other` into this text on the given side. */
  concat(other: TextThing, side: Side): void {
    this.value = side === 'left' ? other.value + this.value : this.value + other.value;
  }

  copy(): TextThing {
    return new TextThing({ x: this.x, y: this.y, value: this.value });
  }

  equals(other: Thing): boolean {
    return other instanceof TextThing && other.value === this.value;
  }

  describe(): string {
    return JSON.stringify(this.value);
  }

  override snapshot(): TextSnapshot {
    return { ...super.snapshot(), value: this.value };
  }
}
