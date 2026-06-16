/**
 * A nest — ToonTalk's message queue. A bird delivers to the *back* of the nest
 * (`insert_at_end_of_contents` in bird.cpp) and things are read from the *front*
 * (oldest first), so it's a FIFO channel. The nest displays the front item (the
 * next to be read).
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export interface NestSnapshot extends ThingSnapshot {
  contents: ThingSnapshot[];
}

export class Nest extends Thing {
  readonly kind = 'nest' as const;
  readonly contents: Thing[];
  /** True once the egg has hatched its bird — the nest then shows an empty nest
   * (the bird has flown off) rather than an egg. Presentation/transient. */
  hatched: boolean;

  constructor(opts: { id?: string; x?: number; y?: number; contents?: Thing[]; hatched?: boolean } = {}) {
    super(opts);
    this.contents = opts.contents ?? [];
    this.hatched = opts.hatched ?? false;
  }

  protected override kindForId(): ThingKind {
    return 'nest';
  }

  /** A bird delivers to the back of the queue. */
  receive(thing: Thing): void {
    this.contents.push(thing);
  }

  /** The oldest delivery — the one shown and read next (FIFO). */
  front(): Thing | null {
    return this.contents[0] ?? null;
  }

  /** Remove and return the oldest delivery, if any (read from the front). */
  takeFront(): Thing | null {
    return this.contents.shift() ?? null;
  }

  copy(): Nest {
    return new Nest({ x: this.x, y: this.y, contents: this.contents.map((c) => c.copy()) });
  }

  equals(other: Thing): boolean {
    return other instanceof Nest;
  }

  describe(): string {
    return `nest(${this.contents.length})`;
  }

  override snapshot(): NestSnapshot {
    return { ...super.snapshot(), contents: this.contents.map((c) => c.snapshot()) };
  }
}
