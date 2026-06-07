/**
 * Save/load a world to and from JSON, using each Thing's serializable snapshot.
 *
 * On load, every thing is rebuilt with a fresh id (avoiding collisions with the
 * running session), and bird→nest links are restored by mapping each bird's
 * stored nestId through the old→new id map. This is also the groundwork for
 * importing the original `.tt` world files later.
 */
import type { World, WorldSnapshot } from './world';
import { Thing, type ThingSnapshot } from './thing';
import { NumberThing, type NumberSnapshot } from './number';
import { TextThing, type TextSnapshot } from './text';
import { Box, type BoxSnapshot } from './box';
import { Nest, type NestSnapshot } from './nest';
import { Bird, type BirdSnapshot } from './bird';
import { Wand } from './wand';
import { Dusty } from './dusty';
import { Robot, type RobotSnapshot } from './robot';
import { Rational } from './rational';

export function serialize(world: World): string {
  return JSON.stringify(world.snapshot(), null, 2);
}

/** Rebuild a single thing (and its children) from a snapshot, with a fresh id. */
function buildThing(s: ThingSnapshot): Thing {
  const t = buildByKind(s);
  t.erased = s.erased ?? false;
  return t;
}

function buildByKind(s: ThingSnapshot): Thing {
  switch (s.kind) {
    case 'number': {
      const n = s as NumberSnapshot;
      return new NumberThing({ x: s.x, y: s.y, value: Rational.parse(n.value), operation: n.operation });
    }
    case 'text': {
      const t = s as TextSnapshot;
      return new TextThing({ x: s.x, y: s.y, value: t.value });
    }
    case 'box': {
      const b = s as BoxSnapshot;
      return new Box({ x: s.x, y: s.y, holes: b.holes.map((h) => (h ? buildThing(h) : null)) });
    }
    case 'nest': {
      const ns = s as NestSnapshot;
      return new Nest({ x: s.x, y: s.y, contents: ns.contents.map(buildThing) });
    }
    case 'bird':
      return new Bird({ x: s.x, y: s.y, nest: null });
    case 'wand':
      return new Wand({ x: s.x, y: s.y });
    case 'dusty':
      return new Dusty({ x: s.x, y: s.y });
    case 'robot': {
      const r = s as RobotSnapshot;
      return new Robot({
        x: s.x,
        y: s.y,
        condition: r.condition,
        actions: r.actions,
        exactValues: (r.exactValues ?? []).map((v) => (v ? buildThing(v) : null)),
      });
    }
    default:
      throw new Error(`persistence: cannot rebuild kind "${s.kind}"`);
  }
}

export function deserialize(json: string): Thing[] {
  const snap = JSON.parse(json) as WorldSnapshot;
  const things = snap.things.map(buildThing);

  // Relink birds to their nests via the original ids.
  const byOldId = new Map<string, Thing>();
  snap.things.forEach((s, i) => byOldId.set(s.id, things[i]!));
  snap.things.forEach((s, i) => {
    if (s.kind === 'bird') {
      const bird = things[i] as Bird;
      const nestId = (s as BirdSnapshot).nestId;
      const nest = nestId ? byOldId.get(nestId) : null;
      bird.nest = nest instanceof Nest ? nest : null;
    }
  });

  return things;
}

/** Replace the world's contents with those described by the JSON. */
export function loadWorld(world: World, json: string): void {
  const things = deserialize(json);
  world.clear();
  for (const t of things) world.add(t);
}
