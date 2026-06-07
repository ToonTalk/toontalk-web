/**
 * A nest. Birds deliver things to their nest; whatever is delivered piles up
 * here. (In full ToonTalk a nest also acts as a communication channel for
 * running robots; Phase 2 models the basic delivery + display.)
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';

export interface NestSnapshot extends ThingSnapshot {
  contents: ThingSnapshot[];
}

export class Nest extends Thing {
  readonly kind = 'nest' as const;
  readonly contents: Thing[];

  constructor(opts: { id?: string; x?: number; y?: number; contents?: Thing[] } = {}) {
    super(opts);
    this.contents = opts.contents ?? [];
  }

  protected override kindForId(): ThingKind {
    return 'nest';
  }

  receive(thing: Thing): void {
    this.contents.push(thing);
  }

  latest(): Thing | null {
    return this.contents.length > 0 ? this.contents[this.contents.length - 1]! : null;
  }

  /** Remove and return the most recently delivered thing, if any. */
  takeLatest(): Thing | null {
    return this.contents.pop() ?? null;
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
