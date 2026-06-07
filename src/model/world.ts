/**
 * The World holds every Thing currently on screen and is the single source of
 * truth the view observes. It emits change events so the view can stay in sync
 * without the model knowing anything about rendering.
 *
 * Pure logic only — no PixiJS, no DOM.
 */

import type { Point, ThingSnapshot } from './thing';
import { Thing } from './thing';

export type WorldEvent =
  | { type: 'added'; thing: Thing }
  | { type: 'removed'; id: string }
  | { type: 'moved'; thing: Thing }
  | { type: 'changed'; thing: Thing };

type Listener = (event: WorldEvent) => void;

export interface WorldSnapshot {
  things: ThingSnapshot[];
}

export class World {
  private readonly things = new Map<string, Thing>();
  private readonly listeners = new Set<Listener>();

  add(thing: Thing): Thing {
    this.things.set(thing.id, thing);
    this.emit({ type: 'added', thing });
    return thing;
  }

  remove(id: string): void {
    if (this.things.delete(id)) {
      this.emit({ type: 'removed', id });
    }
  }

  get(id: string): Thing | undefined {
    return this.things.get(id);
  }

  all(): Thing[] {
    return [...this.things.values()];
  }

  get size(): number {
    return this.things.size;
  }

  moveThing(id: string, p: Point): void {
    const thing = this.things.get(id);
    if (!thing) return;
    thing.moveTo(p);
    this.emit({ type: 'moved', thing });
  }

  /** Signal that a thing's contents changed (value, text, box holes…). */
  notifyChanged(thing: Thing): void {
    this.emit({ type: 'changed', thing });
  }

  /** Remove everything (emits a 'removed' for each, so views clean up). */
  clear(): void {
    for (const id of [...this.things.keys()]) this.remove(id);
  }

  /**
   * Topmost thing whose hit test contains the point, searched in reverse
   * insertion order so the most recently added (visually on top) wins.
   * hitTest is supplied by the caller since geometry lives in the view.
   */
  topAt(p: Point, hitTest: (thing: Thing, p: Point) => boolean): Thing | undefined {
    const list = this.all();
    for (let i = list.length - 1; i >= 0; i--) {
      const thing = list[i];
      if (thing && hitTest(thing, p)) return thing;
    }
    return undefined;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): WorldSnapshot {
    return { things: this.all().map((t) => t.snapshot()) };
  }

  private emit(event: WorldEvent): void {
    for (const l of this.listeners) l(event);
  }
}
