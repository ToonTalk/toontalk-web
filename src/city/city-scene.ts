/**
 * The outdoor city scene: fly the helicopter, land it, walk around.
 *
 * Renders the pure CityModel. Two looks, driven by model.mode:
 *  - flying:  top-down. The rectangular 3×3-block city scrolls beneath a
 *             centred helicopter. The ground is drawn with the ORIGINAL
 *             Lego-stud brushes (BRUSH*.BRH → lawn/street/water patterns,
 *             city.cpp draw_streets): screen-space tiling, pattern anchored to
 *             the world, with the brush tier switching by altitude exactly as
 *             `street_brush_id`/`lawn_brush_id` do (scale < 3 → tier 1, else
 *             tier 2; the side view uses tier 4).
 *  - landing + walking: the HORIZONTAL street view (sky / lawn strip / street,
 *             side-view house art). The copter sinks to the street; on
 *             touchdown it parks and the person walks with Tooly following.
 *
 * INPUT is faithful to the original's RELATIVE_MOUSE_MODE (the default,
 * globals.cpp:729): click the city to capture the mouse (Pointer Lock, cursor
 * hidden — show_cursor(FALSE) in the original); raw mouse MOVEMENT then steers
 * directly, clamped per frame to the state's max speed via dampen_big_deltas:
 *   flying  2 screen-widths/sec; mouse pans (deltas scale with altitude),
 *           left button / ↓ descends, right button / Shift / ↑ climbs
 *   landing 3 screens/sec; mouse x drifts along the street, mouse y flies the
 *           copter up/down directly (prgrmmr.cpp:4338 y += delta_y)
 *   walking 1 screen/sec; mouse x walks
 * ARROW KEYS are the keyboard alternative (winmain.cpp read_arrow_keys): held
 * keys produce the same deltas, accelerating with hold duration; while flying,
 * ↑/↓ from the keyboard mean climb/descend (prgrmmr.cpp:4012).
 */
import * as PIXI from 'pixi.js';
import type { Renderer } from '../view/renderer';
import {
  CityModel,
  type CityMode,
  BLOCKS_X,
  BLOCKS_Y,
  BLOCK_W,
  BLOCK_H,
  STREET,
  CITY_W,
  CITY_H,
} from './city-model';
import { DirectionalSprite, type CityAssets } from './city-sprites';

const GROUND_PPU = 1.8; // screen px per city unit at scale 1 (top-down)
const K_SIDE = 1.6; // screen px per city unit in the street view
const BRUSH_SCALE = 2; // the 8×8 brushes were drawn 1:1 at 640×480; we run ~2×

// Max speeds in screen-widths/sec (dampen_big_deltas; prgrmmr.cpp ctors)
const FLY_SCREENS_PER_S = 2; // "1/2 second to cross the screen"
const LAND_SCREENS_PER_S = 3; // "1/3 second to cross the screen"
const WALK_SCREENS_PER_S = 1; // "1 second to cross the screen"
/** Held arrow keys ramp from this fraction of max speed to full over RAMP ms. */
const KEY_RAMP_MS = 800;
const KEY_START_FRACTION = 0.3;

const COLOR_SKY = 0x8fc7ec;

export class CityScene {
  readonly container: PIXI.Container;
  readonly model = new CityModel();

  // top-down ground: screen-space Lego-brush tiling, world-anchored pattern
  private readonly waterTile: PIXI.TilingSprite;
  private readonly lawnTile: PIXI.TilingSprite;
  private readonly streetTilesV: PIXI.TilingSprite[] = [];
  private readonly streetTilesH: PIXI.TilingSprite[] = [];
  private groundTier: '1' | '2' = '1';
  private readonly decor: PIXI.Container; // houses (top art) + trees, world units

  // street view
  private readonly skyBg: PIXI.Graphics;
  private readonly sideLawnTile: PIXI.TilingSprite;
  private readonly sideStreetTile: PIXI.TilingSprite;
  private readonly sideWorld: PIXI.Container; // houses (side art), parked heli, Tooly

  private readonly avatar: PIXI.Container;
  private readonly heliFly: DirectionalSprite;
  private readonly heliLand: DirectionalSprite;
  private readonly heliParked: PIXI.Sprite;
  private readonly person: DirectionalSprite;
  private readonly tooly: DirectionalSprite;
  private toolyX = 0; // Tooly's own world x (trails the person)

  private active = false;
  private buttons = { left: false, right: false };
  /** Held keys; `keyStart` records when each went down (for the speed ramp). */
  readonly keys = new Set<string>();
  private readonly keyStart = new Map<string, number>();
  /** Accumulated relative mouse movement since the last frame (Pointer Lock). */
  private mouseDX = 0;
  private mouseDY = 0;
  private locked = false;
  private lockUnavailable = false;

  constructor(
    private readonly renderer: Renderer,
    private readonly assets: CityAssets,
  ) {
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.container.zIndex = 500;

    const tile = (key: string): PIXI.TilingSprite => {
      const t = new PIXI.TilingSprite(assets.brushes[key] ?? PIXI.Texture.WHITE, 64, 64);
      t.tileScale.set(BRUSH_SCALE);
      return t;
    };

    // --- top-down ground (screen-space) ---
    this.waterTile = tile('water1');
    this.lawnTile = tile('lawn1');
    this.container.addChild(this.waterTile, this.lawnTile);
    for (let i = 0; i <= BLOCKS_X; i++) {
      const s = tile('street1');
      this.streetTilesV.push(s);
      this.container.addChild(s);
    }
    for (let j = 0; j <= BLOCKS_Y; j++) {
      const s = tile('street1');
      this.streetTilesH.push(s);
      this.container.addChild(s);
    }
    this.decor = new PIXI.Container();
    this.container.addChild(this.decor);
    this.buildDecor();

    // --- street view ---
    this.skyBg = new PIXI.Graphics();
    this.skyBg.visible = false;
    this.container.addChild(this.skyBg);
    this.sideLawnTile = tile('lawn4');
    this.sideStreetTile = tile('street4');
    this.sideLawnTile.visible = this.sideStreetTile.visible = false;
    this.container.addChild(this.sideLawnTile, this.sideStreetTile);
    this.sideWorld = new PIXI.Container();
    this.sideWorld.visible = false;
    this.container.addChild(this.sideWorld);
    this.buildSideWorld();

    this.avatar = new PIXI.Container();
    this.container.addChild(this.avatar);
    this.heliFly = new DirectionalSprite(assets.heliFly, 70);
    this.heliLand = new DirectionalSprite(assets.heliLand, 80);
    this.person = new DirectionalSprite(assets.person, 95);
    this.tooly = new DirectionalSprite(assets.tooly, 110);
    fitHeight(this.heliFly.sprite, 130);
    fitWidth(this.heliLand.sprite, 330);
    fitHeight(this.person.sprite, 116);
    fitHeight(this.tooly.sprite, 64);
    this.heliFly.sprite.anchor.set(0.5, 0.5);
    this.heliLand.sprite.anchor.set(0.5, 1);
    this.person.sprite.anchor.set(0.5, 1);
    this.tooly.sprite.anchor.set(0.5, 1);
    this.heliParked = new PIXI.Sprite(assets.heliParked);
    this.heliParked.anchor.set(0.5, 1);
    this.heliParked.scale.set(330 / this.heliParked.texture.width);
    this.sideWorld.addChild(this.heliParked);
    this.sideWorld.addChild(this.tooly.sprite);
    this.avatar.addChild(this.heliFly.sprite, this.heliLand.sprite, this.person.sprite);

    renderer.app.stage.addChild(this.container);

    // --- input: relative mouse (Pointer Lock) + buttons + arrow keys ---
    const view = renderer.view;
    renderer.app.stage.on('pointerdown', (e) => {
      if (!this.active) return;
      // First click captures the mouse (the original's relative mouse mode
      // hides the cursor); after that, clicks are the climb/descend buttons.
      if (!this.locked && !this.lockUnavailable) {
        const p = view.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === 'function') p.catch(() => (this.lockUnavailable = true));
        if (!view.requestPointerLock) this.lockUnavailable = true;
        return; // swallow the capturing click
      }
      if (e.button === 2) this.buttons.right = true;
      else this.buttons.left = true;
    });
    renderer.app.stage.on('pointerup', () => {
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
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key);
      this.keyStart.delete(e.key);
    });
    view.addEventListener('contextmenu', (ev) => {
      if (this.active) ev.preventDefault();
    });

    renderer.app.ticker.add(this.tick);
    this.syncModeVisibility();
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

  // --- build static worlds ---------------------------------------------------

  /** Top-down decor: the three houses (top art) + trees, in city units. */
  private buildDecor(): void {
    const HOUSE_UNITS = 210;
    const TREE_UNITS = 120;
    for (const h of this.model.houses) {
      const tex = this.assets.houses[h.style] ?? this.assets.houses['b']!;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5, 0.5);
      s.scale.set(HOUSE_UNITS / s.texture.width);
      s.position.set(h.x, h.y);
      this.decor.addChild(s);
    }
    for (const t of this.model.trees) {
      const s = new PIXI.Sprite(this.assets.tree);
      s.anchor.set(0.5, 0.85);
      s.scale.set(TREE_UNITS / s.texture.width);
      s.position.set(t.x, t.y);
      this.decor.addChild(s);
    }
  }

  /** Street view world: the houses with their side-view art, at world x. */
  private buildSideWorld(): void {
    for (const h of this.model.houses) {
      const tex = this.assets.houseSides[h.style];
      if (!tex) continue;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5, 1); // baseline at the lawn/street boundary
      s.position.set(h.x * K_SIDE, 0); // y per frame (screen-height bound)
      this.sideWorld.addChild(s);
    }
  }

  private streetTop(): number {
    return this.renderer.height * 0.72;
  }
  private walkBaseY(): number {
    return this.renderer.height * 0.88;
  }
  private heliBaseY(): number {
    return this.renderer.height * 0.85;
  }

  // --- input helpers ----------------------------------------------------------

  /** Speed fraction (0..1) for a held key: ramps up with hold duration. */
  private keyRamp(key: string): number {
    if (!this.keys.has(key)) return 0;
    let start = this.keyStart.get(key);
    if (start == null) {
      start = performance.now(); // key injected externally (tools) — start now
      this.keyStart.set(key, start);
    }
    const held = performance.now() - start;
    return KEY_START_FRACTION + (1 - KEY_START_FRACTION) * Math.min(1, held / KEY_RAMP_MS);
  }

  /** Per-frame horizontal input in *screen px*: mouse delta + arrows, clamped
   * to the state's max speed (dampen_big_deltas). */
  private inputPxX(maxScreensPerS: number, dt: number): number {
    const W = this.renderer.width;
    const maxPx = (maxScreensPerS * W * dt) / 1000;
    const keyVx = (this.keyRamp('ArrowRight') - this.keyRamp('ArrowLeft')) * maxScreensPerS * W;
    const px = this.mouseDX + (keyVx * dt) / 1000;
    return clampAbs(px, maxPx);
  }

  private inputPxY(maxScreensPerS: number, dt: number): number {
    const H = this.renderer.height;
    const maxPx = (maxScreensPerS * H * dt) / 1000;
    return clampAbs(this.mouseDY, maxPx);
  }

  // --- per-frame ------------------------------------------------------------

  private tick = (): void => {
    if (!this.active) return;
    const dt = this.renderer.app.ticker.deltaMS;

    if (this.model.mode === 'flying') {
      // Mouse pans; deltas are scaled by altitude inside model.fly (source:
      // delta *= scale/ground_scale). Keyboard ↑/↓ mean climb/descend.
      const up =
        this.buttons.right ||
        this.keys.has('ArrowUp') ||
        this.keys.has('Shift');
      const down = this.buttons.left || this.keys.has('ArrowDown');
      const alt: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      const panX = this.inputPxX(FLY_SCREENS_PER_S, dt) / GROUND_PPU;
      const panY = this.inputPxY(FLY_SCREENS_PER_S, dt) / GROUND_PPU;
      this.model.fly(panX, panY, alt, dt);
      this.heliFly.setDirection(this.model.dir);
      this.heliFly.update(dt, true); // rotor always spins
      const after = this.model.mode as CityMode; // fly() may have switched modes
      if (after === 'landing') this.toolyX = this.model.cx - 130; // pre-seat Tooly
    } else if (this.model.mode === 'landing') {
      const up = this.buttons.right || this.keys.has('ArrowUp');
      const down = this.buttons.left || this.keys.has('ArrowDown');
      const dir: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      const drift = this.inputPxX(LAND_SCREENS_PER_S, dt) / K_SIDE;
      // Mouse y flies the copter directly (prgrmmr.cpp:4338 — y += delta_y).
      const descentPx = this.heliBaseY() - this.renderer.height * 0.3;
      const dLandY = -this.inputPxY(LAND_SCREENS_PER_S, dt) / descentPx;
      this.model.land(dir, dt, drift, dLandY);
      this.heliLand.update(dt, true);
    } else {
      // walking the street (side view)
      const px = this.inputPxX(WALK_SCREENS_PER_S, dt);
      this.model.walk(px / K_SIDE);
      this.person.setDirection(this.model.dir);
      this.person.update(dt, Math.abs(px) > 0.4);

      // Tooly trails the walker: eases toward a point just behind them.
      const behind = this.model.dir === 0 ? -110 : 110;
      const target = this.model.cx + behind;
      const step = (target - this.toolyX) * Math.min(1, dt / 280);
      this.toolyX += step;
      this.tooly.setDirection(step > 0 ? 0 : 4);
      this.tooly.update(dt, Math.abs(step) > 0.25);
    }

    this.mouseDX = 0;
    this.mouseDY = 0;
    this.syncModeVisibility();
    this.render();
  };

  private syncModeVisibility(): void {
    const m = this.model.mode;
    const flying = m === 'flying';
    this.waterTile.visible = flying;
    this.lawnTile.visible = flying;
    for (const s of this.streetTilesV) s.visible = flying;
    for (const s of this.streetTilesH) s.visible = flying;
    this.decor.visible = flying;
    this.skyBg.visible = !flying;
    this.sideLawnTile.visible = !flying;
    this.sideStreetTile.visible = !flying;
    this.sideWorld.visible = !flying;
    this.heliFly.sprite.visible = flying;
    this.heliLand.sprite.visible = m === 'landing';
    this.heliParked.visible = m === 'walking';
    this.person.sprite.visible = m === 'walking';
    this.tooly.sprite.visible = m === 'walking';
  }

  private render(): void {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const m = this.model;

    if (m.mode === 'flying') {
      const k = GROUND_PPU / m.scale;
      // brush tier switches with altitude (street_brush_id / lawn_brush_id)
      const tier: '1' | '2' = m.scale < 3 ? '1' : '2';
      if (tier !== this.groundTier) {
        this.groundTier = tier;
        this.waterTile.texture = this.assets.brushes[`water${tier}`]!;
        this.lawnTile.texture = this.assets.brushes[`lawn${tier}`]!;
        for (const s of [...this.streetTilesV, ...this.streetTilesH]) {
          s.texture = this.assets.brushes[`street${tier}`]!;
        }
      }
      // world origin in screen coords — the brush pattern is anchored to it
      // (set_brush_origin in the original), so the ground scrolls under you
      // while the stud size stays constant on screen.
      const ox = W / 2 - m.cx * k;
      const oy = H / 2 - m.cy * k;

      this.waterTile.position.set(0, 0);
      this.waterTile.width = W;
      this.waterTile.height = H;
      this.waterTile.tilePosition.set(ox, oy);

      place(this.lawnTile, ox, oy, CITY_W * k, CITY_H * k, ox, oy);
      for (let i = 0; i <= BLOCKS_X; i++) {
        place(
          this.streetTilesV[i]!,
          ox + (i * BLOCK_W - STREET / 2) * k,
          oy,
          STREET * k,
          CITY_H * k,
          ox,
          oy,
        );
      }
      for (let j = 0; j <= BLOCKS_Y; j++) {
        place(
          this.streetTilesH[j]!,
          ox,
          oy + (j * BLOCK_H - STREET / 2) * k,
          CITY_W * k,
          STREET * k,
          ox,
          oy,
        );
      }
      this.decor.scale.set(k);
      this.decor.position.set(ox, oy);
      this.avatar.position.set(W / 2, H / 2);
      return;
    }

    // Street view: camera follows the copter (landing) / the walker (walking).
    const streetTop = this.streetTop();
    const camX = W / 2 - m.cx * K_SIDE; // world-origin screen x

    this.skyBg.clear();
    this.skyBg.beginFill(COLOR_SKY);
    this.skyBg.drawRect(0, 0, W, streetTop - 16);
    this.skyBg.endFill();
    place(this.sideLawnTile, 0, streetTop - 16, W, 16, camX, 0);
    place(this.sideStreetTile, 0, streetTop, W, H - streetTop, camX, 0);

    this.sideWorld.position.set(camX, 0);
    for (const child of this.sideWorld.children) {
      if (child === this.heliParked) child.y = this.heliBaseY();
      else if (child === this.tooly.sprite) child.y = this.walkBaseY();
      else child.y = streetTop - 12; // houses on their lawn
    }
    this.heliParked.x = m.landX * K_SIDE;
    this.tooly.sprite.x = this.toolyX * K_SIDE;

    if (m.mode === 'landing') {
      // The copter descends at the camera centre: landY 1 = near the top,
      // 0 = on the street. (Bottom-anchored, so y is where its skids are.)
      const topY = H * 0.3;
      this.heliLand.sprite.position.set(
        W / 2,
        topY + (1 - Math.min(m.landY, 1)) * (this.heliBaseY() - topY),
      );
      this.avatar.position.set(0, 0);
    } else {
      this.person.sprite.position.set(W / 2, this.walkBaseY());
      this.avatar.position.set(0, 0);
    }
  }

  destroy(): void {
    this.renderer.app.ticker.remove(this.tick);
    this.container.destroy({ children: true });
  }
}

/** Position a screen-space tiling sprite, keeping its pattern anchored to the
 * world origin at (ox, oy) — tilePosition is relative to the sprite's corner. */
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

function clampAbs(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}

function fitHeight(s: PIXI.Sprite, px: number): void {
  s.scale.set(px / s.texture.height);
}
function fitWidth(s: PIXI.Sprite, px: number): void {
  s.scale.set(px / s.texture.width);
}
