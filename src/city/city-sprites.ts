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
  houses: Record<string, PIXI.Texture>;
  tree: PIXI.Texture;
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
        `/assets/city/${meta.name}/${d}/${String(f).padStart(2, '0')}.png`,
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
    manifest = (await (await fetch('/assets/city/city-sprites.json')).json()) as Manifest;
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

  const houseB = (await loadTex('/assets/city/house-b.png', scaleMode)) ?? PIXI.Texture.WHITE;
  const houseC = (await loadTex('/assets/city/house-c.png', scaleMode)) ?? PIXI.Texture.WHITE;
  const tree = (await loadTex('/assets/city/tree.png', scaleMode)) ?? PIXI.Texture.WHITE;

  return {
    heliFly,
    heliLand,
    person,
    houses: { a: houseC, b: houseB, c: houseC },
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
    private readonly spec: DirSpec,
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
