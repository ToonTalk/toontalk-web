import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Box } from '../src/model/box';
import { Bomb } from '../src/model/bomb';
import { Robot } from '../src/model/robot';
import { House } from '../src/model/house';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';

function numBox(a: number, b: number): Box {
  return new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });
}

describe('Bomb', () => {
  // The original bomb only works inside a house: it terminates the whole running
  // process (bomb.cpp Bomb::used → house_will_explode), and is consumed.
  it('terminates a house (the running process) and is itself consumed', () => {
    const w = new World();
    const house = w.add(new House({ robot: new Robot({}), box: new Box({ size: 1 }) })) as House;
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, house)).toBe('exploded');
    expect(w.get(house.id)).toBeUndefined(); // process terminated
    expect(w.get(bomb.id)).toBeUndefined(); // bomb consumed on detonation
  });

  // "Bombs only work inside houses" — on a loose object the bomb is refused and
  // is NOT consumed (deleting a loose thing is Dusty's job, not the bomb's).
  it('is refused on a loose thing and stays put', () => {
    const w = new World();
    const n = w.add(new NumberThing({ value: 7 }));
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, n)).toBe('none');
    expect(w.get(n.id)).toBeDefined(); // not destroyed
    expect(w.get(bomb.id)).toBeDefined(); // not consumed
  });

  it('is refused on a box and its holes (the box and contents survive)', () => {
    const w = new World();
    const box = w.add(numBox(4, 5)) as Box;
    const bomb = w.add(new Bomb()) as Bomb;
    expect(resolveDrop(w, bomb, box, { holeIndex: 1 })).toBe('none');
    expect(w.get(box.id)).toBeDefined();
    expect(box.isHoleEmpty(1)).toBe(false); // hole contents untouched
    expect(w.get(bomb.id)).toBeDefined();
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
