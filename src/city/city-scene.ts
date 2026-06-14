/**
 * The outdoor city scene.
 *
 * FLYING is now a faithful port: rendered through the `Camera` (camera.ts, a
 * port of screen.cpp) in the original `city_coordinate` system, with the flight
 * dynamics from CityModel (port of Programmer_City_Flying::react). Pointer/arrow
 * deltas are converted to WORLD deltas via the camera, so panning covers more
 * city when you're higher, climbing/descending doubles/halves the scale every
 * ¾ s, and the heading eases via dampen_turn. Descend to the minimum → landing.
 *
 * LANDING / WALKING / the room (`inside`) are still side-elevation views with
 * their own screen scaling (`K_SIDE`/`DEPTH`); their faithful port is a later
 * phase. The ground everywhere uses the original lego brushes (BRUSH*.BRH).
 *
 * Input is the original's RELATIVE_MOUSE_MODE: click to capture the mouse
 * (Pointer Lock), then raw movement steers; arrow keys are the alternative,
 * accelerating with hold duration. Left/Down descend, right/Shift/Up climb.
 */
import * as PIXI from 'pixi.js';
import type { Renderer } from '../view/renderer';
import {
  CityModel,
  type CityMode,
  type House,
  BLOCKS_X,
  BLOCKS_Y,
  BLOCK_W,
  BLOCK_H,
  STREET,
  CITY_W,
  CITY_H,
} from './city-model';
import { Camera, GROUND_SCALE } from './camera';
import { DirectionalSprite, type CityAssets } from './city-sprites';

/** The scene calls back to the app to enter the room (a house / the grass) and
 * to raise the street menu on Escape. */
export interface CitySceneCallbacks {
  onEnter?: (where: 'house' | 'grass', house?: House) => void;
  onEscape?: () => void;
}

const K_SIDE = 0.04; // screen px per city unit, street side view (one house dominant)
const BRUSH_SCALE = 2; // the 8×8 lego brushes run ~2× (constant screen size)
const HOUSE_UNITS = 24000; // a house-top's footprint in city units (≈ a lot width)
const TREE_UNITS = 14000;
// Street side view (original-land.jpg): mostly green lawn, big side houses set
// back to the north, the person/copter in front (lower).
const HELI_LAND_W_FRAC = 0.58; // the landing/landed copter is huge (fraction of W)

// Max pointer speeds in screen-widths/sec (dampen_big_deltas; prgrmmr.cpp ctors)
const FLY_SCREENS_PER_S = 1.6;
const LAND_SCREENS_PER_S = 3;
const WALK_SCREENS_PER_S = 1;
const KEY_RAMP_MS = 800; // held arrow keys ramp to full speed over this long
const KEY_START_FRACTION = 0.3;

export class CityScene {
  readonly container: PIXI.Container;
  readonly model: CityModel;
  private readonly camera = new Camera();

  // flying (top-down, drawn through the camera) — screen-space lego brush tiles
  private readonly waterTile: PIXI.TilingSprite;
  private readonly lawnTile: PIXI.TilingSprite;
  private readonly streetTilesV: PIXI.TilingSprite[] = [];
  private readonly streetTilesH: PIXI.TilingSprite[] = [];
  private groundTier: '1' | '2' | '4' = '4';
  private readonly flyDecor: PIXI.Container; // house-top + tree sprites
  private readonly flyHouses: PIXI.Sprite[] = [];
  private readonly flyTrees: PIXI.Sprite[] = [];

  // street view (landing + walking)
  private readonly sideLawnTile: PIXI.TilingSprite;
  private readonly sideStreetTile: PIXI.TilingSprite;
  private readonly roadBands: PIXI.TilingSprite[] = [];
  private readonly sideWorld: PIXI.Container;
  private readonly sideHouses: { h: House; s: PIXI.Sprite }[] = [];

  // room interior (standing before sitting) — a perspective brick box
  private readonly interior: PIXI.Container;
  private readonly backWall: PIXI.TilingSprite;
  private readonly leftWall: PIXI.SimpleMesh;
  private readonly rightWall: PIXI.SimpleMesh;
  private readonly floorMesh: PIXI.SimpleMesh;
  private readonly doorSprite: PIXI.Sprite;

  private readonly avatar: PIXI.Container;
  private readonly heliFly: DirectionalSprite;
  private readonly heliLand: DirectionalSprite;
  private readonly heliParked: PIXI.Sprite;
  private readonly person: DirectionalSprite;
  private readonly tooly: DirectionalSprite;
  private toolyX = 0;
  private toolyIX = 0.4;
  private toolyIY = 0.8;
  /** Street-view camera centre (world x, y). Follows the walker within a band in
   * BOTH axes so they move on screen before the world scrolls (the walker stays a
   * constant size and the city slides under them — prgrmmr.cpp min_x/max_x). */
  private streetCamCx = 0;
  private streetCamCy = 0;

  private active = false;
  private buttons = { left: false, right: false };
  readonly keys = new Set<string>();
  private readonly keyStart = new Map<string, number>();
  private mouseDX = 0;
  private mouseDY = 0;
  private locked = false;
  private lockUnavailable = false;

  constructor(
    private readonly renderer: Renderer,
    private readonly assets: CityAssets,
    private readonly cb: CitySceneCallbacks = {},
    opts: { trees?: boolean } = {},
  ) {
    this.model = new CityModel({ trees: opts.trees });
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.container.zIndex = 500;

    const tile = (key: string): PIXI.TilingSprite => {
      const t = new PIXI.TilingSprite(assets.brushes[key] ?? PIXI.Texture.WHITE, 64, 64);
      t.tileScale.set(BRUSH_SCALE);
      return t;
    };

    // flying ground
    this.waterTile = tile('water4');
    this.lawnTile = tile('lawn4');
    this.container.addChild(this.waterTile, this.lawnTile);
    for (let i = 0; i <= BLOCKS_X; i++) {
      const s = tile('street4');
      this.streetTilesV.push(s);
      this.container.addChild(s);
    }
    for (let j = 0; j <= BLOCKS_Y; j++) {
      const s = tile('street4');
      this.streetTilesH.push(s);
      this.container.addChild(s);
    }
    this.flyDecor = new PIXI.Container();
    this.container.addChild(this.flyDecor);
    for (const h of this.model.houses) {
      const s = new PIXI.Sprite(assets.houses[h.style] ?? assets.houses['b']!);
      s.anchor.set(0.5, 0.5);
      this.flyHouses.push(s);
      this.flyDecor.addChild(s);
    }
    for (const _t of this.model.trees) {
      const s = new PIXI.Sprite(assets.tree);
      s.anchor.set(0.5, 0.85);
      this.flyTrees.push(s);
      this.flyDecor.addChild(s);
    }

    // street view — a side-scroller that follows the walker in BOTH axes:
    // a full-screen lawn, horizontal road bands at each block boundary, and the
    // houses / parked copter placed in perspective by world coords.
    this.sideLawnTile = tile('lawn4');
    this.sideStreetTile = tile('street4'); // unused base; roads come from the pool
    this.sideStreetTile.visible = false;
    this.sideLawnTile.visible = false;
    this.container.addChild(this.sideLawnTile);
    for (let i = 0; i < 5; i++) {
      const r = tile('street4');
      r.visible = false;
      this.roadBands.push(r);
      this.container.addChild(r);
    }
    this.container.addChild(this.sideStreetTile);
    this.sideWorld = new PIXI.Container();
    this.sideWorld.visible = false;
    this.sideWorld.sortableChildren = true; // depth-sort houses + copter by screen y
    this.container.addChild(this.sideWorld);
    this.buildSideWorld();

    // room interior — a perspective box: white-brick back + side walls, a blue
    // lego floor in perspective, and the red door on the LEFT (original-room.jpg).
    this.interior = new PIXI.Container();
    this.interior.visible = false;
    this.container.addChild(this.interior);
    const brick = assets.wall;
    brick.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    for (const f of Object.values(assets.floors)) f.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    this.backWall = new PIXI.TilingSprite(brick, 64, 64);
    this.backWall.tileScale.set(2.0); // big, clear brick courses (match original)
    const wallUV = (): Float32Array => new Float32Array([0, 0, 1.3, 0, 1.3, 1.4, 0, 1.4]);
    const floorUV = new Float32Array([0, 0, 4.5, 0, 4.5, 3.5, 0, 3.5]); // big lego studs
    const idx = (): Uint16Array => new Uint16Array([0, 1, 2, 0, 2, 3]);
    const mesh = (tex: PIXI.Texture, uv: Float32Array): PIXI.SimpleMesh =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new PIXI.SimpleMesh(tex, new Float32Array(8) as any, uv as any, idx() as any);
    this.leftWall = mesh(brick, wallUV());
    this.rightWall = mesh(brick, wallUV());
    this.leftWall.tint = 0xcfcfcf; // side walls a touch darker for depth
    this.rightWall.tint = 0xcfcfcf;
    this.floorMesh = mesh(assets.floors['b'] ?? PIXI.Texture.WHITE, floorUV);
    this.doorSprite = new PIXI.Sprite(assets.roomdoor);
    this.doorSprite.anchor.set(0.5, 1);
    this.interior.addChild(
      this.backWall,
      this.leftWall,
      this.rightWall,
      this.floorMesh,
      this.doorSprite,
    );

    // avatar
    this.avatar = new PIXI.Container();
    this.container.addChild(this.avatar);
    this.heliFly = new DirectionalSprite(assets.heliFly, 70);
    this.heliLand = new DirectionalSprite(assets.heliLand, 80);
    this.person = new DirectionalSprite(assets.person, 95);
    this.tooly = new DirectionalSprite(assets.tooly, 110);
    fitHeight(this.heliFly.sprite, 130); // re-fit per frame in renderFlying/renderStreet
    fitHeight(this.person.sprite, 116);
    fitHeight(this.tooly.sprite, 64);
    this.heliFly.sprite.anchor.set(0.5, 0.5);
    this.heliLand.sprite.anchor.set(0.5, 1);
    this.person.sprite.anchor.set(0.5, 1);
    this.tooly.sprite.anchor.set(0.5, 1);
    this.heliParked = new PIXI.Sprite(assets.heliParked);
    this.heliParked.anchor.set(0.5, 1);
    this.sideWorld.addChild(this.heliParked);
    this.avatar.addChild(
      this.heliFly.sprite,
      this.heliLand.sprite,
      this.tooly.sprite,
      this.person.sprite, // the walker draws on top of trailing Tooly
    );

    renderer.app.stage.addChild(this.container);
    this.attachInput();
    renderer.app.ticker.add(this.tick);
    this.syncModeVisibility();
  }

  // --- input ----------------------------------------------------------------

  private attachInput(): void {
    const view = this.renderer.view;
    this.renderer.app.stage.on('pointerdown', (e) => {
      if (!this.active) return;
      if (!this.locked && !this.lockUnavailable) {
        const p = view.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === 'function') p.catch(() => (this.lockUnavailable = true));
        if (!view.requestPointerLock) this.lockUnavailable = true;
        return;
      }
      if (e.button === 2) {
        this.buttons.right = true;
      } else {
        this.buttons.left = true;
        // A click sits the avatar down: on the floor in a room, on the grass
        // outside (the floor working view opens for whichever you're on).
        if (this.model.mode === 'walking') this.cb.onEnter?.('grass');
        else if (this.model.mode === 'inside')
          this.cb.onEnter?.('house', this.model.insideHouse ?? undefined);
      }
    });
    this.renderer.app.stage.on('pointerup', () => {
      this.buttons.left = this.buttons.right = false;
    });
    view.addEventListener('mousemove', (e) => {
      if (this.active && this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === view;
    });
    document.addEventListener('pointerlockerror', () => {
      this.lockUnavailable = true;
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (!this.keys.has(e.key)) {
        this.keys.add(e.key);
        this.keyStart.set(e.key, performance.now());
      }
      if (e.key.startsWith('Arrow')) e.preventDefault();
      if (e.key.toLowerCase() === 'h') this.model.callHelicopter();
      if (e.key === 'Escape') {
        if (this.model.mode === 'walking') {
          if (this.locked) document.exitPointerLock?.();
          this.cb.onEscape?.();
        } else if (this.model.mode === 'inside') {
          this.model.leaveRoom();
        }
      }
      if (e.key.toLowerCase() === 's') {
        if (this.model.mode === 'walking') this.cb.onEnter?.('grass');
        else if (this.model.mode === 'inside') this.cb.onEnter?.('house', this.model.insideHouse ?? undefined);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key);
      this.keyStart.delete(e.key);
    });
    view.addEventListener('contextmenu', (ev) => {
      if (this.active) ev.preventDefault();
    });
  }

  setActive(on: boolean): void {
    this.active = on;
    this.container.visible = on;
    if (!on) {
      this.buttons.left = this.buttons.right = false;
      this.keys.clear();
      this.keyStart.clear();
      if (this.locked) document.exitPointerLock?.();
    }
  }
  get isActive(): boolean {
    return this.active;
  }
  resume(): void {
    if (this.model.mode === 'inside') this.model.iy = 0.72;
    else this.model.standUp();
    this.streetCamCx = this.model.cx; // re-centre the street camera on the walker
    this.streetCamCy = this.model.cy;
    this.setActive(true);
  }

  // --- build ----------------------------------------------------------------

  private buildSideWorld(): void {
    for (const h of this.model.houses) {
      const tex = this.assets.houseSides[h.style];
      if (!tex) continue;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5, 1);
      this.sideWorld.addChild(s);
      this.sideHouses.push({ h, s });
    }
  }

  private heliBaseY(): number {
    return this.renderer.height * 0.9; // skids just above the street strip
  }
  /** Screen px per world unit of north–south depth (a block spans ~0.42·H). */
  private vpix(): number {
    return (this.renderer.height * 0.42) / BLOCK_H;
  }
  /** The walker's feet baseline on screen (room to walk north up & south down). */
  private groundY(): number {
    return this.renderer.height * 0.72;
  }

  // --- input helpers --------------------------------------------------------

  private keyRamp(key: string): number {
    if (!this.keys.has(key)) return 0;
    let start = this.keyStart.get(key);
    if (start == null) {
      start = performance.now();
      this.keyStart.set(key, start);
    }
    const held = performance.now() - start;
    return KEY_START_FRACTION + (1 - KEY_START_FRACTION) * Math.min(1, held / KEY_RAMP_MS);
  }
  /** Horizontal pointer input in screen px (mouse + arrows), clamped to max speed. */
  private inputPxX(maxScreensPerS: number, dt: number): number {
    const W = this.renderer.width;
    const maxPx = (maxScreensPerS * W * dt) / 1000;
    const keyVx = (this.keyRamp('ArrowRight') - this.keyRamp('ArrowLeft')) * maxScreensPerS * W;
    return clampAbs(this.mouseDX + (keyVx * dt) / 1000, maxPx);
  }
  private inputPxY(maxScreensPerS: number, dt: number): number {
    const H = this.renderer.height;
    const maxPx = (maxScreensPerS * H * dt) / 1000;
    const keyVy = (this.keyRamp('ArrowDown') - this.keyRamp('ArrowUp')) * maxScreensPerS * H;
    return clampAbs(this.mouseDY + (keyVy * dt) / 1000, maxPx);
  }

  // --- per-frame ------------------------------------------------------------

  private tick = (): void => {
    if (!this.active) return;
    const dt = this.renderer.app.ticker.deltaMS;
    this.camera.setViewport(this.renderer.width, this.renderer.height);

    if (this.model.mode === 'flying') {
      const up = this.buttons.right || this.keys.has('ArrowUp') || this.keys.has('Shift');
      const down = this.buttons.left || this.keys.has('ArrowDown');
      const alt: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      // pointer px → world units (camera-scaled, so higher = covers more ground);
      // mouse up (−screen y) is NORTH (+world y).
      this.camera.set(this.model.cx, this.model.cy, this.model.scale);
      const upp = this.camera.unitsPerPixel;
      // arrow ↑/↓ are altitude only (prgrmmr.cpp: up/down arrows move in z, not
      // y) — so vertical PAN comes from the mouse alone; ←/→ + mouse pan x.
      const maxPxY = (FLY_SCREENS_PER_S * this.renderer.height * dt) / 1000;
      const panX = this.inputPxX(FLY_SCREENS_PER_S, dt) * upp;
      const panY = -clampAbs(this.mouseDY, maxPxY) * upp;
      this.model.fly(panX, panY, alt, dt);
      this.heliFly.setDirection(this.model.dir);
      this.heliFly.update(dt, true);
      if ((this.model.mode as CityMode) === 'landing') this.toolyX = this.model.cx - BLOCK_W * 0.03;
    } else if (this.model.mode === 'landing') {
      const up = this.buttons.right || this.keys.has('ArrowUp');
      const down = this.buttons.left || this.keys.has('ArrowDown');
      const dir: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      const drift = this.inputPxX(LAND_SCREENS_PER_S, dt) / K_SIDE;
      const descentPx = this.heliBaseY() - this.renderer.height * 0.18;
      const dLandY = -this.inputPxY(LAND_SCREENS_PER_S, dt) / descentPx;
      this.model.land(dir, dt, drift, dLandY);
      this.heliLand.update(dt, true);
    } else if (this.model.mode === 'walking') {
      const px = this.inputPxX(WALK_SCREENS_PER_S, dt);
      const py = this.inputPxY(WALK_SCREENS_PER_S, dt);
      const moving = Math.abs(px) > 0.4 || Math.abs(py) > 0.4;
      this.model.walk(px / K_SIDE, -py / this.vpix()); // 1px input ≈ 1px on screen, both axes
      this.person.setDirection(this.model.dir);
      this.person.update(dt, moving);
      this.model.enterHouse(); // only triggers standing at a house's door
      if (this.model.nearHelicopter()) this.model.callHelicopter(); // walk into it → take off
      const behind = this.model.dir >= 5 || this.model.dir === 0 ? -BLOCK_W * 0.06 : BLOCK_W * 0.06;
      const target = this.model.cx + behind;
      this.toolyX += (target - this.toolyX) * Math.min(1, dt / 280);
      this.tooly.setDirection(this.toolyX < target ? 0 : 4);
      this.tooly.update(dt, moving);
    } else {
      // inside (room standing)
      const px = this.inputPxX(WALK_SCREENS_PER_S, dt);
      const py = this.inputPxY(WALK_SCREENS_PER_S, dt);
      const moving = Math.abs(px) > 0.4 || Math.abs(py) > 0.4;
      const result = this.model.walkInside(px / (this.renderer.width * 0.7), py / (this.renderer.height * 0.6));
      this.person.setDirection(this.model.dir);
      this.person.update(dt, moving);
      const tb = this.model.dir >= 5 || this.model.dir === 0 ? -0.08 : 0.08;
      this.toolyIX += (this.model.ix + tb - this.toolyIX) * Math.min(1, dt / 280);
      this.toolyIY += (this.model.iy - this.toolyIY) * Math.min(1, dt / 280);
      this.tooly.setDirection(this.model.dir);
      this.tooly.update(dt, moving);
      if (result === 'sit') this.cb.onEnter?.('house', this.model.insideHouse ?? undefined);
    }

    this.mouseDX = 0;
    this.mouseDY = 0;
    this.syncModeVisibility();
    this.render();
  };

  private syncModeVisibility(): void {
    const m = this.model.mode;
    const flying = m === 'flying';
    const street = m === 'landing' || m === 'walking';
    const inside = m === 'inside';
    this.waterTile.visible = flying;
    this.lawnTile.visible = flying;
    for (const s of this.streetTilesV) s.visible = flying;
    for (const s of this.streetTilesH) s.visible = flying;
    this.flyDecor.visible = flying;
    this.sideLawnTile.visible = street;
    this.sideStreetTile.visible = false; // roads come from the band pool now
    if (!street) for (const r of this.roadBands) r.visible = false;
    this.sideWorld.visible = street;
    this.interior.visible = inside;
    this.heliFly.sprite.visible = flying;
    this.heliLand.sprite.visible = m === 'landing';
    this.heliParked.visible = false; // renderStreet re-enables it (depth-culled) for walking
    this.person.sprite.visible = m === 'walking' || inside;
    this.tooly.sprite.visible = m === 'walking' || inside;
  }

  private render(): void {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const m = this.model;
    if (m.mode === 'flying') this.renderFlying(W, H);
    else if (m.mode === 'inside') this.renderInterior(W, H);
    else this.renderStreet(W, H);
  }

  /** Top-down flyover through the camera (faithful coords + projection). */
  private renderFlying(W: number, H: number): void {
    const cam = this.camera;
    cam.set(this.model.cx, this.model.cy, this.model.scale);

    // brush tier by altitude (street_brush_id/lawn_brush_id: <3 t1, <6 t2, else t4)
    const s = this.model.scale;
    const tier: '1' | '2' | '4' = s < GROUND_SCALE * 3 ? '1' : s < GROUND_SCALE * 6 ? '2' : '4';
    if (tier !== this.groundTier) {
      this.groundTier = tier;
      this.waterTile.texture = this.assets.brushes[`water${tier}`]!;
      this.lawnTile.texture = this.assets.brushes[`lawn${tier}`]!;
      for (const t of [...this.streetTilesV, ...this.streetTilesH]) {
        t.texture = this.assets.brushes[`street${tier}`]!;
      }
    }

    const ox = cam.sx(0); // world origin in screen px — anchors the brush pattern
    const oy = cam.sy(0);
    // water fills the whole screen, behind the (smaller) city
    this.waterTile.position.set(0, 0);
    this.waterTile.width = W;
    this.waterTile.height = H;
    this.waterTile.tilePosition.set(ox, oy);

    // lawn over the city rect (note +y north → screen top)
    const x0 = cam.sx(0);
    const x1 = cam.sx(CITY_W);
    const yTop = cam.sy(CITY_H);
    const yBot = cam.sy(0);
    place(this.lawnTile, x0, yTop, x1 - x0, yBot - yTop, ox, oy);
    const sw = cam.s(STREET);
    for (let i = 0; i <= BLOCKS_X; i++) {
      const vx = cam.sx(i * BLOCK_W);
      place(this.streetTilesV[i]!, vx - sw / 2, yTop, sw, yBot - yTop, ox, oy);
    }
    for (let j = 0; j <= BLOCKS_Y; j++) {
      const hy = cam.sy(j * BLOCK_H);
      place(this.streetTilesH[j]!, x0, hy - sw / 2, x1 - x0, sw, ox, oy);
    }

    // house tops + trees, projected individually
    this.flyDecor.position.set(0, 0);
    this.flyDecor.scale.set(1);
    this.model.houses.forEach((h, i) => {
      const spr = this.flyHouses[i]!;
      spr.position.set(cam.sx(h.x), cam.sy(h.y));
      // scale by the LARGER dimension so the different roof arts get comparable
      // footprints (a short/wide roof shouldn't render tiny). Exact per-house
      // sizes await city reference footage.
      const maxDim = Math.max(spr.texture.width, spr.texture.height);
      spr.scale.set(cam.s(HOUSE_UNITS) / maxDim);
    });
    this.model.trees.forEach((t, i) => {
      const spr = this.flyTrees[i]!;
      spr.position.set(cam.sx(t.x), cam.sy(t.y));
      spr.scale.set(cam.s(TREE_UNITS) / spr.texture.width);
    });

    // The flying helicopter is a constant, LARGE screen size (the original's
    // set_scale(scale) cancels the zoom so it stays a fixed ~⅓-screen size).
    fitHeight(this.heliFly.sprite, Math.min(W, H) * 0.42);
    this.avatar.position.set(0, 0);
    this.heliFly.sprite.position.set(W / 2, H / 2);
  }

  /** Side-scroller street view (landing + walking) — a flat 2.5D ground seen
   * from the south: lawn everywhere, the E–W roads as horizontal bands at each
   * block boundary, the houses set back to the north, the parked copter on its
   * road. The **walker stays a constant size** and moves on screen within a band
   * in BOTH axes; only past the band edge does the city slide under them. So
   * walking reads as the avatar striding across a scrolling city, not a
   * treadmill — and you can roam every street. */
  private renderStreet(W: number, H: number): void {
    const m = this.model;
    const VPIX = this.vpix(); // screen px per world unit of N–S depth
    const GROUND_Y = this.groundY();

    // Camera-follow: centred while landing; a band in each axis while walking, so
    // the walker moves on screen first and the world scrolls only at the edges.
    if (m.mode === 'landing') {
      this.streetCamCx = m.cx;
      this.streetCamCy = m.cy;
    } else {
      const bandX = W * 0.22;
      const psx = W / 2 + (m.cx - this.streetCamCx) * K_SIDE;
      if (psx > W / 2 + bandX) this.streetCamCx = m.cx - bandX / K_SIDE;
      else if (psx < W / 2 - bandX) this.streetCamCx = m.cx + bandX / K_SIDE;
      const bandUp = H * 0.2;
      const bandDn = H * 0.12;
      const psy = GROUND_Y - (m.cy - this.streetCamCy) * VPIX;
      if (psy < GROUND_Y - bandUp) this.streetCamCy = m.cy - bandUp / VPIX;
      else if (psy > GROUND_Y + bandDn) this.streetCamCy = m.cy + bandDn / VPIX;
    }
    const camCx = this.streetCamCx;
    const camCy = this.streetCamCy;
    const camX = W / 2 - camCx * K_SIDE;

    // Flat 2.5D map: world (wx, wy) → screen. North (+y) is up; no perspective
    // foreshortening (constant scale) so figures keep a steady size as in the
    // original front view.
    const sx = (wx: number): number => camX + wx * K_SIDE;
    const sy = (wy: number): number => GROUND_Y - (wy - camCy) * VPIX;

    // lawn fills the screen; its pattern scrolls with the camera so motion shows
    place(this.sideLawnTile, 0, 0, W, H, camX, GROUND_Y + camCy * VPIX);

    // roads: a horizontal band at each block boundary near the camera
    const STREET_HALF = STREET / 2;
    const byMid = Math.round(camCy / BLOCK_H);
    let ri = 0;
    for (let by = byMid - 2; by <= byMid + 2 && ri < this.roadBands.length; by++) {
      if (by < 0 || by > BLOCKS_Y) continue;
      const top = sy(by * BLOCK_H + STREET_HALF);
      const bot = sy(by * BLOCK_H - STREET_HALF);
      const r = this.roadBands[ri++]!;
      if (top > H || bot < 0) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      place(r, 0, top, W, bot - top, camX, top);
    }
    for (; ri < this.roadBands.length; ri++) this.roadBands[ri]!.visible = false;

    // houses: contain-fit into a lot box (so tall/narrow & wide/short arts both
    // look proportionate), set back on their lawn, depth-sorted by screen y
    const boxW = W * 0.32;
    const boxH = H * 0.5;
    for (const { h, s } of this.sideHouses) {
      s.scale.set(Math.min(boxW / s.texture.width, boxH / s.texture.height));
      s.position.set(sx(h.x), sy(h.y));
      s.zIndex = sy(h.y);
    }
    // parked copter, on its road
    this.heliParked.position.set(sx(m.parkedX), sy(m.parkedY));
    fitWidth(this.heliParked, W * HELI_LAND_W_FRAC);
    this.heliParked.zIndex = sy(m.parkedY);
    this.heliParked.visible = m.mode === 'walking';

    this.avatar.position.set(0, 0);
    fitHeight(this.tooly.sprite, H * 0.18); // Tooly trails the walker on the ground
    this.tooly.sprite.position.set(sx(this.toolyX), sy(m.cy));

    if (m.mode === 'landing') {
      fitWidth(this.heliLand.sprite, W * HELI_LAND_W_FRAC);
      const topY = -this.heliLand.sprite.height * 0.1; // starts just above the top
      this.heliLand.sprite.position.set(
        W / 2,
        topY + (1 - Math.min(m.landY, 1)) * (this.heliBaseY() - topY),
      );
    } else {
      // walking: constant size, moving on screen within the follow band
      fitHeight(this.person.sprite, H * 0.26);
      this.person.sprite.position.set(sx(m.cx), sy(m.cy));
    }
  }

  /** The room you stand in after entering a house, before sitting at the floor —
   * a perspective brick box with a blue lego floor and the red door on the left
   * (matches docs/ref/original-room.jpg). */
  private renderInterior(W: number, H: number): void {
    const m = this.model;
    const horizon = H * 0.56; // floor meets the back wall
    const bwL = W * 0.12; // back wall extent (side walls show, gently receding)
    const bwR = W * 0.88;

    // back wall (brick rectangle)
    this.backWall.position.set(bwL, 0);
    this.backWall.width = bwR - bwL;
    this.backWall.height = horizon;
    // side walls (brick quads receding to the screen edges)
    setVerts(this.leftWall, [0, 0, bwL, 0, bwL, horizon, 0, H]);
    setVerts(this.rightWall, [bwR, 0, W, 0, W, H, bwR, horizon]);
    // floor trapezoid: narrow at the back (horizon), full width at the front
    const style = m.insideHouse?.style ?? 'a';
    this.floorMesh.texture = this.assets.floors[style] ?? this.assets.floors['a']!;
    setVerts(this.floorMesh, [bwL, horizon, bwR, horizon, W, H, 0, H]);

    // door on the LEFT wall, upright
    this.doorSprite.scale.set((H * 0.4) / this.doorSprite.texture.height);
    this.doorSprite.position.set(W * 0.1, horizon + (H - horizon) * 0.16);

    // map interior coords (ix 0..1 left→right, iy 0..1 back→front) into the
    // floor trapezoid, scaling the figures by depth for perspective.
    const fx = (ix: number, iy: number): number => {
      const left = bwL + (0 - bwL) * iy;
      const right = bwR + (W - bwR) * iy;
      return left + (right - left) * ix;
    };
    const fy = (iy: number): number => horizon + (H - horizon) * iy;
    const depthScale = (iy: number): number => 0.6 + iy * 0.7;
    this.avatar.position.set(0, 0);
    fitHeight(this.person.sprite, H * 0.34 * depthScale(m.iy));
    this.person.sprite.position.set(fx(m.ix, m.iy), fy(m.iy));
    fitHeight(this.tooly.sprite, H * 0.22 * depthScale(this.toolyIY));
    this.tooly.sprite.position.set(fx(this.toolyIX, this.toolyIY), fy(this.toolyIY));
  }

  destroy(): void {
    this.renderer.app.ticker.remove(this.tick);
    this.container.destroy({ children: true });
  }
}

/** Position a screen-space tiling sprite, keeping its pattern anchored to the
 * world origin at (ox, oy). */
function place(
  t: PIXI.TilingSprite,
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
): void {
  t.position.set(x, y);
  t.width = Math.max(0, w);
  t.height = Math.max(0, h);
  t.tilePosition.set(ox - x, oy - y);
}

/** Update a SimpleMesh's vertex positions (PIXI's typed-array getters need a cast). */
function setVerts(mesh: PIXI.SimpleMesh, xy: number[]): void {
  const buf = mesh.geometry.getBuffer('aVertexPosition');
  (buf.data as unknown as Float32Array).set(xy);
  buf.update();
}

function clampAbs(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}
function fitHeight(s: PIXI.Sprite, px: number): void {
  s.scale.set(px / s.texture.height);
}
function fitWidth(s: PIXI.Sprite, px: number): void {
  s.scale.set(px / s.texture.width);
}
