/**
 * The ToonTalk city — pure model, ported to the ORIGINAL coordinate system
 * (constant.h / globals.cpp / block.cpp) so the camera (camera.ts) and the
 * flight dynamics match source/prgrmmr.cpp rather than approximating them.
 *
 * Units are `city_coordinate`. +y is NORTH (up), matching utils.cpp direction().
 * Flying is a faithful port of Programmer_City_Flying::react (scale grows/shrinks
 * ¾ s to double/halve, pan deltas already altitude-scaled by the camera, heading
 * eased with dampen_turn, descend to the minimum → land). Landing / walking /
 * inside keep their prior logic for now (rescaled to real units) — they get the
 * same faithful-port treatment in later phases.
 */
import { IDEAL_W, GROUND_SCALE } from './camera';

/** 8 compass headings in the original's Direction enum order. */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // E,SE,S,SW,W,NW,N,NE
export type CityMode = 'flying' | 'landing' | 'walking' | 'inside';
export type HouseStyle = 'a' | 'b' | 'c';

// --- city geometry (globals.cpp / block.cpp) -------------------------------
export const TILE_W = 1600; // constant.h tile_width
export const TILE_H = 1200; // constant.h tile_height
export const BLOCK_W = 4 * IDEAL_W; // globals.cpp tt_default_block_width = 4·ideal_w = 128000
export const BLOCK_H = IDEAL_W; // block.cpp ideal_block_height = ideal_screen_width = 32000
export const HOUSES_PER_BLOCK = 4; // globals.cpp tt_houses_to_a_block
export const BLOCKS_X = 3; // default tt_city_size
export const BLOCKS_Y = 3;
export const CITY_W = BLOCKS_X * BLOCK_W;
export const CITY_H = BLOCKS_Y * BLOCK_H;
export const STREET = 4 * TILE_W; // drawn street width (≈ a lane)

// --- flying altitude (prgrmmr.cpp) -----------------------------------------
export { GROUND_SCALE };
export const MIN_FLYING_SCALE = GROUND_SCALE; // tt_min_flying_scale = ground_scale → land
export const INITIAL_SCALE = 10 * GROUND_SCALE; // constant.h initial_scale (1000)
export const MAX_FLYING_SCALE = BLOCKS_X * 125 * HOUSES_PER_BLOCK; // prgrmmr.cpp max_scale (1500)
export const LIFTOFF_SCALE = 3 * GROUND_SCALE; // climb clear of the landing threshold on takeoff
const SCALE_DOUBLE_MS = 750; // ¾ s to double / halve (prgrmmr.cpp grow_value/shrink_value)

// --- walking / room (rescaled; faithful port lands in later phases) --------
export const WALK_BAND_N = 8 * TILE_H; // depth north toward the house fronts
export const WALK_BAND_S = 4 * TILE_H; // depth south toward the viewer
export const ENTER_DEPTH = 6 * TILE_H; // walk this far north at a door → enter
export const DOOR_REACH = 8 * TILE_W; // horizontal reach of a door / the copter

export interface House {
  bx: number;
  lot: number;
  x: number; // city-unit centre of the lot
  y: number;
  style: HouseStyle;
}
export interface Tree {
  x: number;
  y: number;
}

/** utils.cpp direction(): compass heading 0..7 for a delta (+y = NORTH), or null. */
export function directionFromDelta(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === 0) return null;
  if (dx === 0) return (dy > 0 ? 6 : 2) as Direction; // N / S
  let r = (dy * 1000) / dx;
  if (r < 0) r = -r;
  if (r > 2414) return (dy > 0 ? 6 : 2) as Direction; // > 67.5° → N / S
  if (r > 414) {
    // 22.5°–67.5° → a diagonal
    if (dy > 0) return (dx > 0 ? 7 : 5) as Direction; // NE / NW
    return (dx > 0 ? 1 : 3) as Direction; // SE / SW
  }
  return (dx > 0 ? 0 : 4) as Direction; // E / W
}

/** utils.cpp dampen_turn(): step the heading one of 8 toward the target, the
 * short way around — so the helicopter rotates gradually, never snaps. */
export function dampenTurn(target: Direction, current: Direction): Direction {
  let c: number = current;
  if (current < target) c = target - current < 4 ? c + 1 : c - 1;
  else if (current > target) c = current - target < 4 ? c - 1 : c + 1;
  return (((c % 8) + 8) % 8) as Direction;
}

/** grow_value/shrink_value: v doubles/halves every `doubleEvery` ms. */
export function growValue(v: number, dtMs: number, doubleEvery = SCALE_DOUBLE_MS): number {
  return v * Math.pow(2, dtMs / doubleEvery);
}
export function shrinkValue(v: number, dtMs: number, doubleEvery = SCALE_DOUBLE_MS): number {
  return v * Math.pow(2, -dtMs / doubleEvery);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** The horizontal block-boundary (street) y nearest a city y. */
export function nearestStreetY(cy: number): number {
  return clamp(Math.round(cy / BLOCK_H), 0, BLOCKS_Y) * BLOCK_H;
}

/** block.cpp Block::city_location — the centre of lot `i` (0..3) in block `bx`. */
export function lotX(bx: number, i: number): number {
  return bx * BLOCK_W + ((i + 1) * BLOCK_W) / (HOUSES_PER_BLOCK + 1) + BLOCK_W / 30;
}
export function lotY(by: number): number {
  return by * BLOCK_H + (2 * BLOCK_H) / 3;
}

/**
 * city.cpp build_initial_houses: THREE houses, consecutive lots of the centre
 * block, styles cycling A,B,C. Trees are a web extra — off by default.
 */
export function buildCity(withTrees = false): { houses: House[]; trees: Tree[] } {
  const styles: HouseStyle[] = ['a', 'b', 'c'];
  const bx = Math.floor(BLOCKS_X / 2);
  const by = Math.floor(BLOCKS_Y / 2);
  const houses: House[] = styles.map((style, i) => ({
    bx,
    lot: i,
    x: lotX(bx, i),
    y: lotY(by),
    style,
  }));
  const trees: Tree[] = withTrees
    ? [
        { x: lotX(0, 1), y: lotY(0) },
        { x: lotX(2, 2), y: lotY(0) },
        { x: lotX(0, 2), y: lotY(2) },
        { x: lotX(2, 1), y: lotY(2) },
      ]
    : [];
  return { houses, trees };
}

export class CityModel {
  mode: CityMode = 'flying';
  /** Camera/avatar centre in city units (+y north). */
  cx = CITY_W / 2;
  cy = CITY_H / 2;
  scale = INITIAL_SCALE;
  dir: Direction = 0;
  /** Reorient only after travelling a tile (prgrmmr minimum_distance_to_reorient). */
  private minReorient = TILE_W;
  /** Normalized helicopter height while landing: 1 = top of view, 0 = street. */
  landY = 1;
  streetY = nearestStreetY(CITY_H / 2);
  landX = CITY_W / 2;
  insideHouse: House | null = null;
  ix = 0.5;
  iy = 0.8;
  readonly houses: House[];
  readonly trees: Tree[];

  constructor(opts: { trees?: boolean } = {}) {
    const c = buildCity(opts.trees ?? false);
    this.houses = c.houses;
    this.trees = c.trees;
  }

  /**
   * Flying — port of Programmer_City_Flying::react. `panX`/`panY` are WORLD
   * deltas (the scene converts mouse pixels → world via the camera, so they are
   * already altitude-scaled). `altitude` +1 climbs (scale grows), -1 descends.
   */
  fly(panX: number, panY: number, altitude: -1 | 0 | 1, dtMs: number): void {
    if (this.mode !== 'flying') return;
    const dt = Math.min(dtMs, SCALE_DOUBLE_MS); // limit a single huge step
    if (altitude > 0) this.scale = Math.min(MAX_FLYING_SCALE, growValue(this.scale, dt));
    else if (altitude < 0) this.scale = Math.max(MIN_FLYING_SCALE, shrinkValue(this.scale, dt));

    if (panX !== 0 || panY !== 0) {
      this.minReorient -= Math.abs(panX) + Math.abs(panY);
      if (this.minReorient < 0) {
        this.minReorient = TILE_W;
        const nd = directionFromDelta(panX, panY);
        if (nd != null) this.dir = dampenTurn(nd, this.dir);
      }
      this.cx = clamp(this.cx + panX, 0, CITY_W);
      this.cy = clamp(this.cy + panY, 0, CITY_H);
    }

    if (this.scale <= MIN_FLYING_SCALE) {
      this.mode = 'landing';
      this.scale = GROUND_SCALE;
      this.landY = 1;
      this.streetY = nearestStreetY(this.cy);
      this.cy = this.streetY;
      this.landX = this.cx;
    }
  }

  land(dir: -1 | 0 | 1, dtMs: number, driftX = 0, dLandY = 0): void {
    if (this.mode !== 'landing') return;
    if (driftX !== 0) this.cx = clamp(this.cx + driftX, 0, CITY_W);
    this.landY = this.landY + dir * 0.9 * (dtMs / 1000) + dLandY;
    if (this.landY > 1 && dir >= 0 && dLandY > 0) {
      this.mode = 'flying';
      this.scale = LIFTOFF_SCALE;
      this.landY = 1;
      return;
    }
    this.landY = Math.min(this.landY, 1.05);
    if (this.landY >= 1 && dir > 0) {
      this.mode = 'flying';
      this.scale = LIFTOFF_SCALE;
      this.landY = 1;
    } else if (this.landY <= 0) {
      this.landY = 0;
      this.landX = this.cx;
      this.cx = clamp(this.landX + DOOR_REACH, 0, CITY_W);
      this.mode = 'walking';
    }
  }

  walk(dx: number, dy = 0): void {
    if (this.mode !== 'walking' || (dx === 0 && dy === 0)) return;
    const d = directionFromDelta(dx, dy);
    if (d != null) this.dir = d;
    this.cx = clamp(this.cx + dx, 0, CITY_W);
    // +y is north (toward the house fronts); south (toward the viewer) is -y.
    this.cy = clamp(this.cy + dy, this.streetY - WALK_BAND_S, this.streetY + WALK_BAND_N);
  }

  enterableHouse(): House | null {
    if (this.mode !== 'walking') return null;
    if (this.cy - this.streetY < ENTER_DEPTH) return null; // walked north up to the doors
    return this.houses.find((h) => Math.abs(this.cx - h.x) <= DOOR_REACH) ?? null;
  }

  enterHouse(): boolean {
    const h = this.enterableHouse();
    if (!h) return false;
    this.insideHouse = h;
    this.ix = 0.5;
    this.iy = 0.78;
    this.dir = 6;
    this.mode = 'inside';
    return true;
  }

  walkInside(dx: number, dy: number): 'leave' | 'sit' | null {
    if (this.mode !== 'inside') return null;
    const d = directionFromDelta(dx, -dy); // screen-down dy → south
    if (d != null) this.dir = d;
    this.ix += dx;
    this.iy += dy;
    if (this.ix <= 0 || this.ix >= 1) {
      this.leaveRoom();
      return 'leave';
    }
    this.iy = clamp(this.iy, 0.08, 1);
    return this.iy >= 1 ? 'sit' : null;
  }

  leaveRoom(): void {
    if (this.mode !== 'inside') return;
    const h = this.insideHouse;
    this.insideHouse = null;
    this.mode = 'walking';
    if (h) {
      this.cx = h.x;
      this.streetY = nearestStreetY(h.y);
      this.cy = this.streetY;
    }
  }

  /** Walk into the parked copter (down by the street) → board & take off. */
  boardHelicopter(): boolean {
    if (this.mode !== 'walking') return false;
    if (Math.abs(this.cx - this.landX) > DOOR_REACH) return false;
    if (this.cy - this.streetY > WALK_BAND_N * 0.5) return false; // up at the houses, not the copter
    this.cx = this.landX;
    this.cy = this.streetY;
    this.landY = 0.05;
    this.mode = 'landing';
    return true;
  }

  standUp(): void {
    if (this.mode !== 'walking') return;
    this.cy = this.streetY;
  }

  callHelicopter(): void {
    if (this.mode !== 'walking') return;
    this.mode = 'flying';
    this.scale = LIFTOFF_SCALE;
  }
}
