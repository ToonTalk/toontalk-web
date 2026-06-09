import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Nest } from '../src/model/nest';
import { Bird } from '../src/model/bird';
import { Robot } from '../src/model/robot';
import { serialize, loadWorld } from '../src/model/persistence';

function makeWorld(): World {
  const w = new World();
  w.add(new NumberThing({ value: 5, x: 10, y: 20 }));
  w.add(new TextThing({ value: 'hi', x: 30, y: 40 }));
  w.add(new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 5 })], x: 50, y: 60 }));
  const nest = new Nest({ x: 70, y: 80 });
  w.add(nest);
  w.add(new Bird({ nests: [nest], x: 90, y: 100 }));
  w.add(new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] }));
  return w;
}

describe('persistence round-trip', () => {
  it('restores the same number of things', () => {
    const w = makeWorld();
    const json = serialize(w);
    const w2 = new World();
    loadWorld(w2, json);
    expect(w2.size).toBe(w.size);
  });

  it('restores values, positions, and box contents', () => {
    const json = serialize(makeWorld());
    const w2 = new World();
    loadWorld(w2, json);

    const num = w2.all().find((t) => t instanceof NumberThing && t.x === 10) as NumberThing;
    expect(num.value.toString()).toBe('5');

    const box = w2.all().find((t) => t instanceof Box) as Box;
    expect((box.contentsAt(0) as NumberThing).value.toString()).toBe('4');
    expect((box.contentsAt(1) as NumberThing).value.toString()).toBe('5');
  });

  it('relinks each bird to its nest', () => {
    const json = serialize(makeWorld());
    const w2 = new World();
    loadWorld(w2, json);
    const bird = w2.all().find((t) => t instanceof Bird) as Bird;
    expect(bird.nests).toHaveLength(1);
    expect(bird.nests[0]).toBeInstanceOf(Nest);
    // The relinked nest is one of the world's actual nests.
    expect(w2.all()).toContain(bird.nests[0]);
  });

  it('restores robot condition and actions', () => {
    const json = serialize(makeWorld());
    const w2 = new World();
    loadWorld(w2, json);
    const robot = w2.all().find((t) => t instanceof Robot) as Robot;
    expect(robot.condition).toEqual(['number', 'number']);
    expect(robot.actions).toHaveLength(1);
  });

  it('clears the previous world on load', () => {
    const w2 = new World();
    w2.add(new NumberThing({ value: 999 }));
    loadWorld(w2, serialize(makeWorld()));
    expect(w2.all().some((t) => t instanceof NumberThing && t.value.toString() === '999')).toBe(false);
  });
});
