import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { Placeholder, type Thing } from '../src/model/thing';

const hitAlways = () => true;

describe('Thing', () => {
  it('copies with a new identity but equal structure', () => {
    const a = new Placeholder({ sprite: 'number', x: 10, y: 20 });
    const b = a.copy();
    expect(b.id).not.toBe(a.id);
    expect(a.equals(b)).toBe(true);
  });

  it('distinguishes different sprites', () => {
    const a = new Placeholder({ sprite: 'number' });
    const b = new Placeholder({ sprite: 'text' });
    expect(a.equals(b)).toBe(false);
  });

  it('produces a serializable snapshot', () => {
    const a = new Placeholder({ sprite: 'box', x: 5, y: 6 });
    expect(a.snapshot()).toMatchObject({ kind: 'placeholder', x: 5, y: 6 });
  });
});

describe('World', () => {
  it('adds things and reports size', () => {
    const w = new World();
    w.add(new Placeholder({ sprite: 'number' }));
    w.add(new Placeholder({ sprite: 'text' }));
    expect(w.size).toBe(2);
  });

  it('emits events on add, move, and remove', () => {
    const w = new World();
    const events: string[] = [];
    w.subscribe((e) => events.push(e.type));
    const t = w.add(new Placeholder({ sprite: 'bird' }));
    w.moveThing(t.id, { x: 99, y: 1 });
    w.remove(t.id);
    expect(events).toEqual(['added', 'moved', 'removed']);
    expect(t.x).toBe(99);
  });

  it('returns the topmost (most recently added) thing at a point', () => {
    const w = new World();
    w.add(new Placeholder({ sprite: 'box' }));
    const top = w.add(new Placeholder({ sprite: 'wand' }));
    const found: Thing | undefined = w.topAt({ x: 0, y: 0 }, hitAlways);
    expect(found?.id).toBe(top.id);
  });

  it('round-trips a world snapshot shape', () => {
    const w = new World();
    w.add(new Placeholder({ sprite: 'robot', x: 1, y: 2 }));
    const snap = w.snapshot();
    expect(snap.things).toHaveLength(1);
    expect(snap.things[0]).toMatchObject({ kind: 'placeholder', x: 1, y: 2 });
  });
});
