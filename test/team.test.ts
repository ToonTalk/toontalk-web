import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Box } from '../src/model/box';
import { Robot, runRobot, expandTeam } from '../src/model/robot';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld } from '../src/model/persistence';
import { Wand } from '../src/model/wand';
import { Notebook } from '../src/model/notebook';

const numBox = (a: number, b: number) =>
  new Box({ holes: [new NumberThing({ value: a }), new NumberThing({ value: b })] });

describe('robot teams', () => {
  it('drop robot-on-robot forms a team of separate, lined-up robots', () => {
    const w = new World();
    const lead = w.add(new Robot()) as Robot;
    const mate = w.add(new Robot()) as Robot;
    expect(resolveDrop(w, mate, lead)).toBe('teamed');
    expect(lead.team).toEqual([mate]);
    expect(w.get(mate.id)).toBe(mate); // teammate STAYS a separate world robot…
    expect(mate.leader).toBe(lead); // …linked to its lead
    expect(mate.x).toBeGreaterThan(lead.x); // …lined up behind it
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

  const teamOf = (w: World) => {
    const lead = w.add(new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] })) as Robot;
    const mate = w.add(new Robot({ condition: ['text'], actions: [{ type: 'remove', hole: 0 }] })) as Robot;
    resolveDrop(w, mate, lead); // a team of two separate floor robots
    return { lead, mate };
  };
  const robotsIn = (w: World) => w.all().filter((t) => t instanceof Robot) as Robot[];

  it('wand "S" copies a whole team as separate floor robots', () => {
    const w = new World();
    const { lead, mate } = teamOf(w);
    expect(robotsIn(w).length).toBe(2);

    resolveDrop(w, new Wand({ mode: 'S' }), lead); // copy the lead + its team
    expect(robotsIn(w).length).toBe(4); // original team (2) + copied team (2)

    const leads = robotsIn(w).filter((r) => r.leader === null);
    expect(leads.length).toBe(2);
    const copyLead = leads.find((r) => r !== lead)!;
    expect(copyLead.team.length).toBe(1);
    const copyMate = copyLead.team[0]!;
    expect(w.get(copyMate.id)).toBe(copyMate); // a SEPARATE world robot…
    expect(copyMate.leader).toBe(copyLead); // …linked to the copy…
    expect(copyMate.x).toBeGreaterThan(copyLead.x); // …lined up behind it
    expect(lead.team).toEqual([mate]); // the original team is untouched
  });

  it('filing a team lead gathers its teammates off the floor', () => {
    const w = new World();
    const { lead, mate } = teamOf(w);
    const nb = w.add(new Notebook()) as Notebook;

    expect(resolveDrop(w, lead, nb)).toBe('stored');
    expect(w.get(lead.id)).toBeUndefined(); // the lead is filed…
    expect(w.get(mate.id)).toBeUndefined(); // …and its teammate gathered off the floor
    const page = nb.current() as Robot;
    expect(page).toBeInstanceOf(Robot);
    expect(page.team.length).toBe(1); // the whole team is one page
  });

  it('unfiling a team lead expands it back into separate floor robots', () => {
    const w = new World();
    const filed = new Robot({ condition: ['number'], actions: [{ type: 'remove', hole: 0 }] });
    filed.team = [new Robot({ condition: ['text'], actions: [{ type: 'remove', hole: 0 }] })];
    const nb = w.add(new Notebook({ pages: [filed] })) as Notebook;

    // Taking the page out: a fresh copy placed on the floor, its team expanded.
    const copy = nb.current()!.copy() as Robot;
    w.add(copy);
    expandTeam(w, copy);

    expect(copy.team.length).toBe(1);
    const mate = copy.team[0]!;
    expect(w.get(mate.id)).toBe(mate);
    expect(mate.leader).toBe(copy);
    expect(mate.x).toBeGreaterThan(copy.x);
    expect(nb.current()).toBe(filed); // the notebook keeps its own copy
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

  it('holeStates flags exactly the holes that do not match (reddish feedback)', () => {
    const r = new Robot({
      condition: ['number', 'number'],
      exactValues: [new NumberThing({ value: 3 }), new NumberThing({ value: 5 })],
      actions: [{ type: 'combine', from: 1, to: 0 }],
    });
    expect(r.holeStates(numBox(3, 5))).toEqual(['match', 'match']);
    expect(r.holeStates(numBox(3, 9))).toEqual(['match', 'mismatch']); // 9 ≠ 5
    const wrongKind = new Box({ holes: [new NumberThing({ value: 3 }), new TextThing({ value: 'x' })] });
    expect(r.holeStates(wrongKind)).toEqual(['match', 'mismatch']);
    // a wrong-size box has nothing lined up → every hole is a mismatch
    expect(r.holeStates(new Box({ holes: [new NumberThing({ value: 3 })] }))).toEqual(['mismatch']);
  });

  it('a robot keeps its name through copy and save/load', () => {
    const w = new World();
    const r = new Robot({ name: 'Add', condition: ['number', 'number'], actions: [{ type: 'combine', from: 1, to: 0 }] });
    expect(r.copy().name).toBe('Add');
    w.add(r);
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const loaded = w2.all().find((t) => t instanceof Robot) as Robot;
    expect(loaded.name).toBe('Add');
  });
});
