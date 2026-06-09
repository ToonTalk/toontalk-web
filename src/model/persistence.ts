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
import { Wand, type WandSnapshot } from './wand';
import { Dusty, type DustySnapshot } from './dusty';
import { Bomb } from './bomb';
import { Robot, type RobotSnapshot } from './robot';
import { Truck } from './truck';
import { House, type HouseSnapshot } from './house';
import { Notebook, type NotebookSnapshot } from './notebook';
import { Pumpy, type PumpySnapshot } from './pumpy';
import { Scale, type ScaleSnapshot, recomputeScales } from './scale';
import { makeSensor, type SensorType } from './sensor';
import { Rational } from './rational';

export function serialize(world: World): string {
  return JSON.stringify(world.snapshot(), null, 2);
}

/** Rebuild a single thing (and its children) from a snapshot, with a fresh id. */
function buildThing(s: ThingSnapshot): Thing {
  const t = buildByKind(s);
  t.erased = s.erased ?? false;
  t.scaleX = s.scaleX ?? 1;
  t.scaleY = s.scaleY ?? 1;
  return t;
}

function buildByKind(s: ThingSnapshot): Thing {
  switch (s.kind) {
    case 'number': {
      const n = s as NumberSnapshot;
      if (s.sensorType) {
        return makeSensor(s.sensorType as SensorType, { x: s.x, y: s.y, value: Rational.parse(n.value) });
      }
      return new NumberThing({ x: s.x, y: s.y, value: Rational.parse(n.value), operation: n.operation });
    }
    case 'text': {
      const t = s as TextSnapshot;
      if (s.sensorType) {
        return makeSensor(s.sensorType as SensorType, { x: s.x, y: s.y, value: t.value });
      }
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
      return new Bird({ x: s.x, y: s.y, nests: [] }); // nests relinked after build
    case 'wand':
      return new Wand({ x: s.x, y: s.y, mode: (s as WandSnapshot).mode });
    case 'pumpy':
      return new Pumpy({ x: s.x, y: s.y, mode: (s as PumpySnapshot).mode });
    case 'dusty': {
      const d = s as DustySnapshot;
      return new Dusty({ x: s.x, y: s.y, mode: d.mode, stomach: (d.stomach ?? []).map(buildThing) });
    }
    case 'bomb':
      return new Bomb({ x: s.x, y: s.y });
    case 'scale':
      return new Scale({ x: s.x, y: s.y, tilt: (s as ScaleSnapshot).tilt });
    case 'truck':
      return new Truck({ x: s.x, y: s.y });
    case 'notebook': {
      const nb = s as NotebookSnapshot;
      return new Notebook({ x: s.x, y: s.y, pages: nb.pages.map(buildThing), index: nb.index });
    }
    case 'house': {
      const h = s as HouseSnapshot;
      return new House({
        x: s.x,
        y: s.y,
        robot: buildThing(h.robot) as Robot,
        box: buildThing(h.box) as Box,
      });
    }
    case 'robot': {
      const r = s as RobotSnapshot;
      return new Robot({
        x: s.x,
        y: s.y,
        condition: r.condition,
        actions: r.actions,
        exactValues: (r.exactValues ?? []).map((v) => (v ? buildThing(v) : null)),
        team: (r.team ?? []).map((ts) => buildThing(ts) as Robot),
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
      const ids = (s as BirdSnapshot).nestIds ?? [];
      bird.nests = ids.map((id) => byOldId.get(id)).filter((n): n is Nest => n instanceof Nest);
    }
  });

  return things;
}

/** Replace the world's contents with those described by the JSON. */
export function loadWorld(world: World, json: string): void {
  const things = deserialize(json);
  world.clear();
  for (const t of things) world.add(t);
  // Settle scale tilts from neighbours (erased neighbours keep the saved tilt).
  for (const t of things) if (t instanceof Box) recomputeScales(t);
}
