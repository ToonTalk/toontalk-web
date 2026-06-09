import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Robot, runRobot } from '../src/model/robot';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';

const numBox = (a: number, b: number) =>
  new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });

describe('robot teams', () => {
  it('drop robot-on-robot forms a team behind the target', () => {
    const w = new World();
    const lead = w.add(new Robot()) as Robot;
    const mate = w.add(new Robot()) as Robot;
    expect(resolveDrop(w, mate, lead)).toBe('teamed');
    expect(lead.team).toEqual([mate]);
    expect(w.get(mate.id)).toBeUndefined(); // teammate is no longer a world thing
  });

  it('the first matching robot in the team runs', () => {
    const w = new World();
    // Front robot matches a 2-number box and adds; teammate matches text boxes.
    const adder = new Robot({
      condition: ['number', 'number'],
      actions: [{ type: 'combine', from: 1, to: 0 }],
    });
    const joiner = new Robot({
      condition: ['text', 'text'],
      actions: [{ type: 'combine', from: 1, to: 0 }],
    });
    adder.team = [joiner];

    const nbox = numBox(4, 5);
    expect(runRobot(w, adder, nbox)).toBe(true);
    expect((nbox.contentsAt(0) as NumberThing).value.toString()).toBe('9'); // adder ran

    const tbox = new Box({ holes: [new TextThing({ value: 'a' }), new TextThing({ value: 'b' })] });
    expect(runRobot(w, adder, tbox)).toBe(true); // front passes; teammate matches
    expect((tbox.contentsAt(0) as TextThing).value).toBe('ab');
  });

  it('does not run when no teammate matches', () => {
    const w = new World();
    const lead = new Robot({ condition: ['number', 'number'], actions: [{ type: 'remove', hole: 0 }] });
    lead.team = [new Robot({ condition: ['text', 'text'], actions: [{ type: 'remove', hole: 0 }] })];
    const box = new Box({ holes: [new TextThing({ value: 'a' }), new NumberThing({ value: 1 })] });
    expect(runRobot(w, lead, box)).toBe(false);
  });

  it('round-trips a team through save/load', () => {
    const w = new World();
    const lead = new Robot({ condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    lead.team = [new Robot({ condition: ['text'], actions: [] })];
    w.add(lead);
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const loaded = w2.all().find((t) => t instanceof Robot) as Robot;
    expect(loaded.team.length).toBe(1);
    expect(loaded.team[0]!.condition).toEqual(['text']);
  });
});
