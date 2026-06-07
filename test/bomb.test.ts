import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Bomb } from '../src/model/bomb';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';

function numBox(a: number, b: number): Box {
  return new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });
}

describe('Bomb', () => {
  it('blows up a loose thing and is itself consumed', () => {
    const w = new World();
    const n = w.add(new NumberThing({ value: 7 }));
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, n)).toBe('exploded');
    expect(w.get(n.id)).toBeUndefined(); // target destroyed
    expect(w.get(bomb.id)).toBeUndefined(); // bomb consumed
  });

  it('destroys only the contents of a filled box hole; the box survives', () => {
    const w = new World();
    const box = w.add(numBox(4, 5)) as Box;
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, box, { holeIndex: 1 })).toBe('exploded');
    expect(w.get(box.id)).toBeDefined();
    expect(box.isHoleEmpty(1)).toBe(true);
    expect(box.contentsAt(0)!).toBeInstanceOf(NumberThing); // other hole untouched
    expect(w.get(bomb.id)).toBeUndefined();
  });

  it('blows up the whole box when the targeted hole is empty', () => {
    const w = new World();
    const box = w.add(new Box({ size: 2 })) as Box;
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, box, { holeIndex: 0 })).toBe('exploded');
    expect(w.get(box.id)).toBeUndefined();
  });

  it('blows up the whole box when dropped on it without a hole', () => {
    const w = new World();
    const box = w.add(numBox(1, 2)) as Box;
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, box)).toBe('exploded');
    expect(w.get(box.id)).toBeUndefined();
  });

  it('does nothing without a target', () => {
    const w = new World();
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, undefined)).toBe('none');
    expect(w.get(bomb.id)).toBeDefined(); // not consumed on a miss
  });

  it('survives a save/load round-trip', () => {
    const w = new World();
    w.add(new Bomb({ x: 12, y: 34 }));
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const bomb = w2.all().find((t) => t instanceof Bomb) as Bomb | undefined;
    expect(bomb).toBeDefined();
    expect(bomb!.x).toBe(12);
    expect(bomb!.y).toBe(34);
  });
});
