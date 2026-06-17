import { describe, it, expect } from 'vitest';
import { Robot } from '../src/model/robot';
import { Box } from '../src/model/box';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Nest } from '../src/model/nest';

// robot.cpp three-way matching: a box can MATCH (run), be INCOMPLETE (wait for
// the missing thing / a bird), or MISMATCH (stop). Pure model — no rendering.
describe('Robot.matchState', () => {
  const add = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });

  it('matches when every hole fits', () => {
    expect(add.matchState(new Box({ holes: [new NumberThing({ value: 5 }), new NumberThing({ value: 3 })] }))).toBe('match');
  });

  it('waits when a needed hole is empty (the user can still fill it)', () => {
    expect(add.matchState(new Box({ holes: [new NumberThing({ value: 5 }), null] }))).toBe('wait');
  });

  it('mismatches on the wrong kind', () => {
    expect(add.matchState(new Box({ holes: [new NumberThing({ value: 5 }), new TextThing({ value: 'a' })] }))).toBe('mismatch');
  });

  it('mismatches on the wrong box size', () => {
    expect(add.matchState(new Box({ holes: [new NumberThing({ value: 5 })] }))).toBe('mismatch');
  });

  it('waits on an EMPTY nest where content is needed (awaiting a bird)', () => {
    const r = new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] });
    expect(r.matchState(new Box({ holes: [new Nest()] }))).toBe('wait');
  });

  it('matches the thing ON TOP of a nest (the nest itself is transparent)', () => {
    const r = new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] });
    const nest = new Nest({ contents: [new NumberThing({ value: 7 })] });
    expect(r.matchState(new Box({ holes: [nest] }))).toBe('match');
  });

  it('mismatches when the nest top is the wrong kind', () => {
    const r = new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] });
    const nest = new Nest({ contents: [new TextThing({ value: 'x' })] });
    expect(r.matchState(new Box({ holes: [nest] }))).toBe('mismatch');
  });
});
