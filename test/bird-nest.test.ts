import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { Nest } from '../src/model/nest';
import { Bird } from '../src/model/bird';
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
});
