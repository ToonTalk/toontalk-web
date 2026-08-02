/**
 * City sprite loading + a small directional animated-sprite helper.
 *
 * The bake (tools/bake-city.py) writes frame sets to
 * /assets/city/<name>/<dir>/NN.png plus a city-sprites.json manifest carrying
 * each sprite's canvas size, registration anchor, and per-direction frame
 * counts. The flying helicopter and walking person have 8 directions (cycle =
 * Direction enum order); the landing helicopter has one.
 */
import * as PIXI from 'pixi.js';
import { assetUrl } from '../config/asset-url';
import type { RenderTheme } from '../config/render-mode';

interface SpriteMeta {
  name: string;
  w: number;
  h: number;
  anchor: [number, number];
  frameCounts: number[];
}
type Manifest = Record<string, SpriteMeta>;

export interface CityAssets {
  heliFly: DirSpec;
  heliLand: DirSpec;
  person: DirSpec;
  /** The walking person with the chosen head composited on (the "choice of
   * heads"): hair = purple-hair girl, hat = red-cap boy. `person` is the plain
   * head. Same 8-dir × 8-frame structure, so they're interchangeable specs. */
  personHair: DirSpec;
  personHat: DirSpec;
  /** Tooly the toolbox (side view, 8 directions) — follows the walker. */
  tooly: DirSpec;
  /** Top-down house art for the flyover, by style. */
  houses: Record<string, PIXI.Texture>;
  /** Side-view house art for the street view, by style. */
  houseSides: Record<string, PIXI.Texture>;
  /** The landed helicopter, parked on the street. */
  heliParked: PIXI.Texture;
  tree: PIXI.Texture;
  /**
   * The original ground "brushes" (8×8 Lego-stud patterns, BRUSH*.BRH):
   * lawn/street/water at zoom tiers 1/2/4 plus the side-view variants.
   * Keys: lawn1, lawn2, lawn4, lawnSide, street1, street2, street4,
   * streetSide, water1, water2, water4.
   */
  brushes: Record<string, PIXI.Texture>;
  /** Room interior (standing view before sitting): floor baseplate by house
   * style, the back-wall strip, and the door. */
  floors: Record<string, PIXI.Texture>;
  backwall: PIXI.Texture;
  /** White lego-brick wall texture (WALL.BMP) for the room interior. */
  wall: PIXI.Texture;
  roomdoor: PIXI.Texture;
  /** Cohesive room-interior backgrounds (ROOM_A/B/C_BACKGROUND): brick walls +
   * perspective lego floor + red door, blitted as one picture (room.cpp:114). */
  rooms: Record<string, PIXI.Texture>;
}

export interface DirSpec {
  /** textures[direction][frame] */
  textures: PIXI.Texture[][];
  anchor: [number, number];
  w: number;
  h: number;
}

async function loadTex(url: string, scaleMode: PIXI.SCALE_MODES): Promise<PIXI.Texture | null> {
  try {
    const t = await PIXI.Assets.load(url);
    t.baseTexture.scaleMode = scaleMode;
    return t;
  } catch {
    return null;
  }
}

async function loadDirSpec(meta: SpriteMeta, scaleMode: PIXI.SCALE_MODES): Promise<DirSpec> {
  const textures: PIXI.Texture[][] = [];
  for (let d = 0; d < meta.frameCounts.length; d++) {
    const frames: PIXI.Texture[] = [];
    for (let f = 0; f < meta.frameCounts[d]!; f++) {
      const t = await loadTex(
        assetUrl(`/assets/city/${meta.name}/${d}/${String(f).padStart(2, '0')}.png`),
        scaleMode,
      );
      if (t) frames.push(t);
    }
    if (frames.length === 0) frames.push(PIXI.Texture.WHITE);
    textures.push(frames);
  }
  return { textures, anchor: meta.anchor, w: meta.w, h: meta.h };
}

export async function loadCityAssets(theme: RenderTheme): Promise<CityAssets> {
  const scaleMode =
    theme.scaleMode === 'nearest' ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;
  let manifest: Manifest = {};
  try {
    manifest = (await (await fetch(assetUrl('/assets/city/city-sprites.json'))).json()) as Manifest;
  } catch {
    // fall back to sane defaults if the manifest is missing
  }
  const fallback = (name: string, dirs: number): SpriteMeta => ({
    name,
    w: 100,
    h: 100,
    anchor: [0.5, 0.9],
    frameCounts: Array(dirs).fill(1),
  });

  const heliFly = await loadDirSpec(manifest['heli-fly'] ?? fallback('heli-fly', 8), scaleMode);
  const heliLand = await loadDirSpec(manifest['heli-land'] ?? fallback('heli-land', 1), scaleMode);
  const person = await loadDirSpec(manifest['person'] ?? fallback('person', 8), scaleMode);
  const personHair = await loadDirSpec(manifest['person-hair'] ?? fallback('person-hair', 8), scaleMode);
  const personHat = await loadDirSpec(manifest['person-hat'] ?? fallback('person-hat', 8), scaleMode);
  const tooly = await loadDirSpec(manifest['tooly'] ?? fallback('tooly', 8), scaleMode);

  const white = PIXI.Texture.WHITE;
  const houseB = (await loadTex(assetUrl('/assets/city/house-b.png'), scaleMode)) ?? white;
  const houseC = (await loadTex(assetUrl('/assets/city/house-c.png'), scaleMode)) ?? white;
  const sideA = (await loadTex(assetUrl('/assets/city/house-a-side.png'), scaleMode)) ?? white;
  const sideB = (await loadTex(assetUrl('/assets/city/house-b-side.png'), scaleMode)) ?? white;
  const sideC = (await loadTex(assetUrl('/assets/city/house-c-side.png'), scaleMode)) ?? white;
  const heliParked = (await loadTex(assetUrl('/assets/city/heli-parked.png'), scaleMode)) ?? white;
  const tree = (await loadTex(assetUrl('/assets/city/tree.png'), scaleMode)) ?? white;

  // Ground brushes: always nearest-neighbour so the 8×8 stud pattern stays crisp.
  const brushes: Record<string, PIXI.Texture> = {};
  const brushFiles: Record<string, string> = {
    lawn1: 'brush-lawn1', lawn2: 'brush-lawn2', lawn4: 'brush-lawn4', lawnSide: 'brush-lawn-side',
    street1: 'brush-street1', street2: 'brush-street2', street4: 'brush-street4',
    streetSide: 'brush-street-side',
    water1: 'brush-water1', water2: 'brush-water2', water4: 'brush-water4',
  };
  for (const [key, file] of Object.entries(brushFiles)) {
    const t = await loadTex(assetUrl(`/assets/city/${file}.png`), PIXI.SCALE_MODES.NEAREST);
    brushes[key] = t ?? white;
  }

  const floors: Record<string, PIXI.Texture> = {
    a: (await loadTex(assetUrl('/assets/city/floor-a.png'), scaleMode)) ?? white,
    b: (await loadTex(assetUrl('/assets/city/floor-b.png'), scaleMode)) ?? white,
    c: (await loadTex(assetUrl('/assets/city/floor-c.png'), scaleMode)) ?? white,
  };
  const backwall = (await loadTex(assetUrl('/assets/city/backwall.png'), scaleMode)) ?? white;
  const wall = (await loadTex(assetUrl('/assets/city/wall.png'), scaleMode)) ?? white;
  const roomdoor = (await loadTex(assetUrl('/assets/city/roomdoor.png'), scaleMode)) ?? white;
  const rooms: Record<string, PIXI.Texture> = {
    a: (await loadTex(assetUrl('/assets/city/room-a.png'), scaleMode)) ?? white,
    b: (await loadTex(assetUrl('/assets/city/room-b.png'), scaleMode)) ?? white,
    c: (await loadTex(assetUrl('/assets/city/room-c.png'), scaleMode)) ?? white,
  };

  return {
    brushes,
    floors,
    backwall,
    wall,
    roomdoor,
    rooms,
    heliFly,
    heliLand,
    person,
    personHair,
    personHat,
    tooly,
    houses: { a: houseC, b: houseB, c: houseC },
    houseSides: { a: sideA, b: sideB, c: sideC },
    heliParked,
    tree,
  };
}

/**
 * One sprite that can face 8 directions and animate its walk/rotor cycle. Call
 * setDirection(d) when the heading changes and update(dt, moving) each tick;
 * frames advance only while moving (matching the original's idle-frame rest).
 */
export class DirectionalSprite {
  readonly sprite: PIXI.Sprite;
  private dir = 0;
  private frame = 0;
  private acc = 0;

  constructor(
    private spec: DirSpec,
    private readonly frameMs = 90,
  ) {
    this.sprite = new PIXI.Sprite(spec.textures[0]![0]);
    this.sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
  }

  setDirection(d: number): void {
    const dir = ((d % this.spec.textures.length) + this.spec.textures.length) % this.spec.textures.length;
    if (dir === this.dir) return;
    this.dir = dir;
    this.frame = this.frame % this.spec.textures[dir]!.length;
    this.sprite.texture = this.spec.textures[dir]![this.frame]!;
  }

  /** Swap the whole sprite sheet (e.g. change the avatar's head), keeping the
   * current direction/frame so the walk cycle doesn't hitch. */
  setSpec(spec: DirSpec): void {
    if (spec === this.spec) return;
    this.spec = spec;
    this.sprite.anchor.set(spec.anchor[0], spec.anchor[1]);
    if (this.dir >= spec.textures.length) this.dir = 0;
    this.frame = this.frame % spec.textures[this.dir]!.length;
    this.sprite.texture = spec.textures[this.dir]![this.frame]!;
  }

  update(dtMs: number, moving: boolean): void {
    if (!moving) return;
    this.acc += dtMs;
    const frames = this.spec.textures[this.dir]!;
    while (this.acc >= this.frameMs) {
      this.acc -= this.frameMs;
      this.frame = (this.frame + 1) % frames.length;
    }
    this.sprite.texture = frames[this.frame]!;
  }
}
