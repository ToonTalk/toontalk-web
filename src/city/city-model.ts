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
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  DEFAULT_BLOCK_WIDTH,
  IDEAL_BLOCK_HEIGHT,
  HOUSES_TO_A_BLOCK,
  CITY_SIZE,
  GROUND_SCALE,
  INITIAL_SCALE as INITIAL_SCALE_CONST,
  MIN_FLYING_SCALE as MIN_FLYING_SCALE_CONST,
  maxFlyingScale,
} from '../port/constants';

/** 8 compass headings in the original's Direction enum order. */
export type Direction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // E,SE,S,SW,W,NW,N,NE
export type CityMode = 'flying' | 'landing' | 'walking' | 'inside';
export type HouseStyle = 'a' | 'b' | 'c';

// --- city geometry (constant.h / globals.cpp / block.cpp), via the port ----
export const TILE_W = TILE_WIDTH; // constant.h:332
export const TILE_H = TILE_HEIGHT; // constant.h:333
export const BLOCK_W = DEFAULT_BLOCK_WIDTH; // globals.cpp:559 (4·ideal_w = 128000)
export const BLOCK_H = IDEAL_BLOCK_HEIGHT; // block.cpp:37 (ideal_w = 32000)
export const HOUSES_PER_BLOCK = HOUSES_TO_A_BLOCK; // globals.cpp:524 (4)
// Free-play city is tt_city_width × tt_city_height = 10×10 blocks (globals.cpp:
// 260-261); city.cpp only shrinks it to 3×3 in PUZZLE mode. Blocks are 4:1
// (wide & short), so the city is wide & short; the 3 starter houses sit on the
// centre block, the rest is empty green grid (build_initial_houses, city.cpp:172).
export const BLOCKS_X = CITY_SIZE; // 10
export const BLOCKS_Y = CITY_SIZE; // 10
export const CITY_W = BLOCKS_X * BLOCK_W;
export const CITY_H = BLOCKS_Y * BLOCK_H;
export const STREET = 4 * TILE_W; // drawn street width (≈ a lane)

// --- flying altitude (prgrmmr.cpp) -----------------------------------------
export { GROUND_SCALE };
export const MIN_FLYING_SCALE = MIN_FLYING_SCALE_CONST; // globals.cpp:562 = ground_scale → land
export const INITIAL_SCALE = INITIAL_SCALE_CONST; // constant.h:338 (1000)
export const MAX_FLYING_SCALE = maxFlyingScale(BLOCKS_X, BLOCKS_Y); // prgrmmr.cpp:3918 (10·125·4)
export const LIFTOFF_SCALE = 3 * GROUND_SCALE; // climb clear of the landing threshold on takeoff
const SCALE_DOUBLE_MS = 750; // ¾ s to double / halve (prgrmmr.cpp grow_value/shrink_value)

// Landing descent (Programmer_City_Landing, prgrmmr.cpp:4296 + ctor). The copter
// moves in real y between min_y = center−13·tile (leave/ground) and
// max_y = center+10·tile (fly again), starting at center+6·tile, at
// button_speed = 5·tile_height per second while a button is held (4237). We keep
// `landY` normalised (1 = max_y top, 0 = min_y ground) for the Pixi side view, so
// the held-button rate is button_speed / (23·tile) per second and the start is
// (6 − (−13)) / 23.
const LAND_SPAN_TILES = 10 - -13; // (max_y − min_y) in tile_heights = 23
export const LAND_BUTTON_RATE = 5 / LAND_SPAN_TILES; // button_speed / span ≈ 0.217 /s
export const LAND_START = (6 - -13) / LAND_SPAN_TILES; // start near the top ≈ 0.826

// --- walking / room --------------------------------------------------------
// Walking is now world-relative: the avatar roams the whole city (every street),
// the side view scrolls in BOTH axes (renderStreet projects world→screen), and
// you enter a house only by standing at its door.
export const DOOR_REACH = 1.6 * TILE_W; // door half-width: ONLY the door is an entrance
export const DOOR_DEPTH = 2 * TILE_H; // and you must be standing at the house front (in y)
export const STEP_OUT = 9 * TILE_W; // how far beside the copter you step out on landing
export const HELI_REACH = 4 * TILE_W; // walk this close to the parked copter → it takes off
export const HOUSE_HW = 6 * TILE_W; // house footprint half-width (solid; walls block you)
export const HOUSE_HD = 4 * TILE_H; // house footprint half-depth

/** The road (block boundary) along the SOUTH edge of the block containing `y`. */
export function roadYFor(y: number): number {
  return Math.floor(clamp(y, 0, CITY_H - 1) / BLOCK_H) * BLOCK_H;
}

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
  /** During a takeoff we replay the landing view in reverse (copter rises). */
  takingOff = false;
  /** The road the avatar is currently on (south edge of the block at cy). */
  streetY = roadYFor(CITY_H / 2);
  landX = CITY_W / 2;
  /** Where the copter is parked while you walk — walk back into it to take off. */
  parkedX = CITY_W / 2;
  parkedY = roadYFor(CITY_H / 2);
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
   * Flying — port of `Programmer_City_Flying::react` (prgrmmr.cpp:3988).
   * - `altitude` +1 climbs / -1 descends: `grow_value`/`shrink_value`, ¾ s to
   *   double/halve, duration capped at 750 (4036, 4047), clamped to
   *   `[tt_min_flying_scale, max_scale]` (4037, 4048).
   * - heading eases via `dampen_turn` only after travelling `tile_width`
   *   (`minimum_distance_to_reorient`, 4023-4028).
   * - pan: the original does `delta = delta*scale/ground_scale` (4072, 4091) so
   *   you cover more ground when higher; here the scene pre-scales mouse px →
   *   world via the camera, so `panX`/`panY` arrive already altitude-scaled.
   * - descend to `tt_min_flying_scale` → `LANDING` (4048-4050).
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
      this.landY = LAND_START; // copter starts near the top (center+6·tile), prgrmmr.cpp ctor
      // Touch down on the road along the south edge of the block, so the houses
      // (set back to the north) appear ahead of you (original-land.jpg).
      this.cy = roadYFor(this.cy);
      this.streetY = this.cy;
      this.landX = this.cx;
    }
  }

  /**
   * Landing — port of `Programmer_City_Landing::react` (prgrmmr.cpp:4296). The
   * copter moves in y: a held button adds ±`button_speed·duration` (5·tile/s,
   * 4237), the mouse adds its own delta (`dLandY`). `y > max_y → FLYING_AGAIN`
   * (4339), `y < min_y → LEAVE_HELICOPTER` (4345). Horizontally the original pans
   * the city with the copter centred (4350-4368); here `driftX` scrolls the
   * street the same way (the side view keeps the copter centred). `landY` is the
   * normalised height (1 = max_y, 0 = min_y) for the Pixi side view.
   */
  land(dir: -1 | 0 | 1, dtMs: number, driftX = 0, dLandY = 0): void {
    if (this.mode !== 'landing') return;
    if (driftX !== 0) this.cx = clamp(this.cx + driftX, 0, CITY_W);
    this.landY = this.landY + dir * LAND_BUTTON_RATE * (dtMs / 1000) + dLandY;
    if (this.landY > 1 && dir >= 0 && dLandY > 0) {
      this.mode = 'flying';
      this.scale = LIFTOFF_SCALE;
      this.landY = 1;
      this.takingOff = false;
      return;
    }
    this.landY = Math.min(this.landY, 1.05);
    if (this.landY >= 1 && dir > 0) {
      this.mode = 'flying';
      this.scale = LIFTOFF_SCALE;
      this.landY = 1;
      this.takingOff = false;
    } else if (this.landY <= 0 && !this.takingOff) {
      this.landY = 0;
      this.landX = this.cx;
      this.parkedX = this.cx; // the copter stays here on the road
      this.parkedY = this.cy;
      this.cx = clamp(this.landX + STEP_OUT, 0, CITY_W); // step out beside the copter
      this.streetY = roadYFor(this.cy);
      this.mode = 'walking';
    }
  }

  /**
   * Walk the city — port of `Programmer_City_Walking::react` (prgrmmr.cpp:5000):
   * move in real coords (`x += delta_x; y += delta_y`, 5028-5029), clamp to the
   * city bounds (5039-5056), and ease the heading with `dampen_turn` only after
   * travelling `tile_width` (`minimum_distance_to_reorient`, 5031-5036) — not a
   * snap. The camera-follow band (5057-5076) and house collisions
   * (`handle_collisions`, 5082) live in the scene/`blockedByHouse`.
   */
  walk(dx: number, dy = 0): void {
    if (this.mode !== 'walking' || (dx === 0 && dy === 0)) return;
    this.minReorient -= Math.abs(dx) + Math.abs(dy);
    if (this.minReorient < 0) {
      this.minReorient = TILE_W;
      const nd = directionFromDelta(dx, dy);
      if (nd != null) this.dir = dampenTurn(nd, this.dir);
    }
    let nx = clamp(this.cx + dx, 0, CITY_W);
    let ny = clamp(this.cy + dy, 0, CITY_H);
    // axis-separated collision so walking into a wall slides instead of sticking
    if (this.blockedByHouse(nx, this.cy)) nx = this.cx;
    if (this.blockedByHouse(nx, ny)) ny = this.cy;
    this.cx = nx;
    this.cy = ny;
    this.streetY = roadYFor(this.cy);
  }

  /** True if (x, y) is inside a house's solid footprint. The central door column
   * (|x−h.x| ≤ DOOR_REACH) stays passable so you can walk up to the door and
   * enter; every other part of the house is a wall. */
  private blockedByHouse(x: number, y: number): boolean {
    for (const h of this.houses) {
      if (
        Math.abs(x - h.x) <= HOUSE_HW &&
        Math.abs(y - h.y) <= HOUSE_HD &&
        Math.abs(x - h.x) > DOOR_REACH
      ) {
        return true;
      }
    }
    return false;
  }

  /** Standing at a house's door (close in BOTH x and y) → you may enter it. */
  enterableHouse(): House | null {
    if (this.mode !== 'walking') return null;
    return (
      this.houses.find(
        (h) => Math.abs(this.cx - h.x) <= DOOR_REACH && Math.abs(this.cy - h.y) <= DOOR_DEPTH,
      ) ?? null
    );
  }

  /** Standing where the copter is parked → walking into it takes off. */
  nearHelicopter(): boolean {
    return (
      this.mode === 'walking' &&
      Math.abs(this.cx - this.parkedX) <= HELI_REACH &&
      Math.abs(this.cy - this.parkedY) <= HELI_REACH
    );
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

  /**
   * Walk around the room floor (ix/iy normalised 0..1). Faithful to
   * Programmer_Room_Walking::react: only the LEFT wall (the door) leaves the
   * room; the right and front/back walls just stop you. Sitting is a click
   * (handled by the scene), not a wall, in relative-mouse mode.
   */
  walkInside(dx: number, dy: number): 'leave' | null {
    if (this.mode !== 'inside') return null;
    const d = directionFromDelta(dx, -dy); // screen-down dy → south
    if (d != null) this.dir = d;
    this.ix += dx;
    this.iy += dy;
    if (this.ix <= 0) {
      this.leaveRoom(); // the door is on the left wall (min_x → LEAVING_ROOM)
      return 'leave';
    }
    this.ix = clamp(this.ix, 0, 1); // right wall stops you
    this.iy = clamp(this.iy, 0.06, 1); // front/back walls stop you
    return null;
  }

  leaveRoom(): void {
    if (this.mode !== 'inside') return;
    const h = this.insideHouse;
    this.insideHouse = null;
    this.mode = 'walking';
    if (h) {
      // Step OUT to the street, well clear of (and facing away from) the door —
      // not onto the doorstep — so you don't instantly walk back in. (The
      // original drops you into the city in front of the house.)
      this.cx = h.x;
      this.cy = h.y - (HOUSE_HD + STEP_OUT);
      this.dir = 2; // facing south, away from the house
      this.streetY = roadYFor(this.cy);
    }
  }

  standUp(): void {
    // Getting up from a sit leaves you where you were (no position change).
    if (this.mode !== 'walking') return;
  }

  callHelicopter(): void {
    if (this.mode !== 'walking') return;
    // Board the copter where it's parked and play the takeoff — the landing in
    // reverse: the big side-view copter rises from the ground, then we're flying.
    this.cx = this.parkedX;
    this.cy = this.parkedY;
    this.streetY = roadYFor(this.cy);
    this.landX = this.parkedX;
    this.landY = 0; // on the ground
    this.takingOff = true;
    this.mode = 'landing'; // reuse the landing view; the scene drives the ascent
  }
}
