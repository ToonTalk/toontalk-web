import { describe, it, expect } from 'vitest';
import { Robot } from '../src/model/robot';
import { Box } from '../src/model/box';
import { NumberThing } from '../src/model/number';

// robot.cpp same_type_match: a nested box matches RECURSIVELY (not by exact
// equality) — same shape, each inner hole matched (value, wildcard, or further
// nesting), suspending on an incomplete inner box.
const num = (v: number) => new NumberThing({ value: v });
const erased = (v: number) => {
  const n = new NumberThing({ value: v });
  n.erased = true;
  return n;
};
const nested = (...vals: (number | null)[]) => new Box({ holes: vals.map((v) => (v === null ? null : num(v))) });
const outer = (inner: Box) => new Box({ holes: [inner] });

describe('recursive matching of nested boxes', () => {
  it('matches by recursive structure + values', () => {
    const r = new Robot({ condition: ['box'], exactValues: [nested(3, 7)] });
    expect(r.matchState(outer(nested(3, 7)))).toBe('match');
    expect(r.matchState(outer(nested(3, 8)))).toBe('mismatch'); // inner value differs
    expect(r.matchState(outer(nested(3)))).toBe('mismatch'); // inner size differs
    expect(r.matchState(outer(nested(3, null)))).toBe('wait'); // inner hole missing → suspend
  });

  it('an erased INNER hole generalises just that inner value', () => {
    const guard = new Box({ holes: [num(3), erased(7)] }); // inner hole 1 wildcard
    const r = new Robot({ condition: ['box'], exactValues: [guard] });
    expect(r.matchState(outer(nested(3, 99)))).toBe('match'); // hole 1 any
    expect(r.matchState(outer(nested(5, 99)))).toBe('mismatch'); // hole 0 still guarded (3)
  });
});
