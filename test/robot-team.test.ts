import { describe, it, expect } from 'vitest';
import { Robot, runRobot, teamMatch } from '../src/model/robot';
import { Box } from '../src/model/box';
import { NumberThing } from '../src/model/number';
import { World } from '../src/model/world';

// A team is a line of robots offered the box front-to-back; the first whose
// condition matches runs (robot.htm "the front robot… if it doesn't match, pass
// it along"). Different members handle different cases — conditional/cooperative.
const guard = (v: number) => new Robot({ condition: ['number'], exactValues: [new NumberThing({ value: v })] });
const onlyValue = (box: Box) => (box.contentsAt(0) as NumberThing | null)?.value.toString() ?? 'empty';

describe('teams of robots', () => {
  it('the first matching member runs (conditional)', () => {
    const w = new World();
    const r1 = guard(1); r1.actions = [{ type: 'insert', to: 0, thing: new NumberThing({ value: 100 }) }];
    const r2 = guard(2); r2.actions = [{ type: 'insert', to: 0, thing: new NumberThing({ value: 200 }) }];
    r1.team = [r2]; // r1 leads, r2 behind

    const b1 = w.add(new Box({ holes: [new NumberThing({ value: 1 })] })) as Box;
    expect(runRobot(w, r1, b1)).toBe(true);
    expect(onlyValue(b1)).toBe('101'); // r1 ran (1 + 100)

    const b2 = w.add(new Box({ holes: [new NumberThing({ value: 2 })] })) as Box;
    expect(runRobot(w, r1, b2)).toBe(true);
    expect(onlyValue(b2)).toBe('202'); // r2 ran (2 + 200)

    const b3 = w.add(new Box({ holes: [new NumberThing({ value: 3 })] })) as Box;
    expect(runRobot(w, r1, b3)).toBe(false); // neither matches
  });

  it('members cooperate across a cycle as the box changes', () => {
    const w = new World();
    const r1 = guard(1); r1.actions = [{ type: 'insert', to: 0, thing: new NumberThing({ value: 1 }) }]; // 1 -> 2
    const r2 = guard(2); r2.actions = [{ type: 'remove', hole: 0 }]; // 2 -> empty
    r1.team = [r2];
    const box = new Box({ holes: [new NumberThing({ value: 1 })] });
    w.add(box);

    expect(runRobot(w, r1, box)).toBe(true); // r1: 1 -> 2
    expect(onlyValue(box)).toBe('2');
    expect(runRobot(w, r1, box)).toBe(true); // r2: 2 -> empty
    expect(onlyValue(box)).toBe('empty');
    expect(teamMatch(r1, box).state).toBe('wait'); // empty hole, needs a number → the team waits
  });
});
