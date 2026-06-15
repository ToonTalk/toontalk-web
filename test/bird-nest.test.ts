import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Nest } from '../src/model/nest';
import { Bird } from '../src/model/bird';
import { Robot } from '../src/model/robot';
import { Box } from '../src/model/box';
import { Wand } from '../src/model/wand';
import { resolveDrop } from '../src/model/interactions';

describe('bird feeds multiple nests after a nest is copied', () => {
  it('copying a nest makes its bird feed both, and delivery reaches both', () => {
    const w = new World();
    const nest = w.add(new Nest()) as Nest;
    const bird = w.add(new Bird({ nests: [nest] })) as Bird;
    const wand = w.add(new Wand()) as Wand;

    // Copy the nest with the wand → the bird should now feed both nests.
    expect(resolveDrop(w, wand, nest)).toBe('copied');
    expect(bird.nests).toHaveLength(2);

    // Give a number to the bird → a copy lands on every nest (FIFO front).
    const gift = w.add(new NumberThing({ value: 7 }));
    expect(resolveDrop(w, gift, bird)).toBe('delivered');
    expect(w.get(gift.id)).toBeUndefined();
    for (const n of bird.nests) {
      expect((n.front() as NumberThing).value.toString()).toBe('7');
    }
  });

  it('a bird with no nest does nothing', () => {
    const w = new World();
    const bird = w.add(new Bird()) as Bird;
    const gift = w.add(new NumberThing({ value: 1 }));
    expect(resolveDrop(w, gift, bird)).toBe('none');
    expect(w.get(gift.id)).toBeDefined();
  });

  it('refuses anything but pads/boxes (bird.cpp acceptable)', () => {
    const w = new World();
    const nest = w.add(new Nest()) as Nest;
    const bird = w.add(new Bird({ nests: [nest] })) as Bird;
    // a robot is not acceptable cargo — the bird refuses it
    const robot = w.add(new Robot());
    expect(resolveDrop(w, robot, bird)).toBe('none');
    expect(w.get(robot.id)).toBeDefined();
    expect(nest.contents).toHaveLength(0);
    // a box, though, is fine
    expect(resolveDrop(w, w.add(new Box({ size: 1 })), bird)).toBe('delivered');
    expect(nest.contents).toHaveLength(1);
  });
});

describe('combining nests', () => {
  it('merges deliveries and re-points the feeding bird', () => {
    const w = new World();
    const a = w.add(new Nest()) as Nest;
    const b = w.add(new Nest()) as Nest;
    const bird = w.add(new Bird({ nests: [a] })) as Bird;
    a.receive(new NumberThing({ value: 1 }));

    expect(resolveDrop(w, a, b)).toBe('combined');
    expect(w.get(a.id)).toBeUndefined();          // dragged nest consumed
    expect(b.contents).toHaveLength(1);            // its delivery moved to b
    expect(bird.nests).toEqual([b]);               // the bird now feeds b

    resolveDrop(w, w.add(new NumberThing({ value: 9 })), bird);
    expect(b.contents).toHaveLength(2);            // delivery reaches the merged nest
  });
});

import { hatchFromNest } from '../src/model/bird';

describe('hatching a bird from an egg', () => {
  it('an empty nest with no bird hatches a fresh one feeding it', () => {
    const w = new World();
    const nest = w.add(new Nest()) as Nest;
    const bird = hatchFromNest(w, nest, 5, 6);
    expect(bird).not.toBeNull();
    expect(bird!.nests).toEqual([nest]);
    expect(w.get(bird!.id)).toBeDefined();
  });

  it('does not hatch if a bird already feeds the nest or it has contents', () => {
    const w = new World();
    const nest = w.add(new Nest()) as Nest;
    w.add(new Bird({ nests: [nest] }));
    expect(hatchFromNest(w, nest, 0, 0)).toBeNull(); // already has a bird

    const nest2 = w.add(new Nest()) as Nest;
    nest2.receive(new NumberThing({ value: 1 }));
    expect(hatchFromNest(w, nest2, 0, 0)).toBeNull(); // not empty
  });
});
