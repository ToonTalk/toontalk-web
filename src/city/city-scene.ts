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
  type House,
  BLOCKS_X,
  BLOCKS_Y,
  BLOCK_W,
  BLOCK_H,
  STREET,
  CITY_W,
  CITY_H,
} from './city-model';
import { DirectionalSprite, type CityAssets } from './city-sprites';

/** The scene calls back to the app to enter the room (a house / the grass) and
 * to raise the street menu on Escape. */
export interface CitySceneCallbacks {
  onEnter?: (where: 'house' | 'grass', house?: House) => void;
  onEscape?: () => void;
}

const GROUND_PPU = 1.8; // screen px per city unit at scale 1 (top-down)
const K_SIDE = 1.6; // screen px per city unit in the street view (horizontal)
const DEPTH = 1.35; // screen px per city unit of walking *depth* (toward houses)
const BRUSH_SCALE = 2; // the 8×8 brushes were drawn 1:1 at 640×480; we run ~2×
const HELI_LAND_W = 560; // the landing/landed copter is BIG (near native art size)
const WALK_BASE_FRAC = 0.86; // the walker's feet at street centre (fraction of H)

// Max speeds in screen-widths/sec (dampen_big_deltas; prgrmmr.cpp ctors)
const FLY_SCREENS_PER_S = 2; // "1/2 second to cross the screen"
const LAND_SCREENS_PER_S = 3; // "1/3 second to cross the screen"
const WALK_SCREENS_PER_S = 1; // "1 second to cross the screen"
/** Held arrow keys ramp from this fraction of max speed to full over RAMP ms. */
const KEY_RAMP_MS = 800;
const KEY_START_FRACTION = 0.3;

export class CityScene {
  readonly container: PIXI.Container;
  readonly model: CityModel;

  // top-down ground: screen-space Lego-brush tiling, world-anchored pattern
  private readonly waterTile: PIXI.TilingSprite;
  private readonly lawnTile: PIXI.TilingSprite;
  private readonly streetTilesV: PIXI.TilingSprite[] = [];
  private readonly streetTilesH: PIXI.TilingSprite[] = [];
  private groundTier: '1' | '2' = '1';
  private readonly decor: PIXI.Container; // houses (top art) + trees, world units

  // street view
  private readonly sideLawnTile: PIXI.TilingSprite;
  private readonly sideStreetTile: PIXI.TilingSprite;
  private readonly sideWorld: PIXI.Container; // houses (side art), parked heli, Tooly

  // room-interior view (standing in a house before sitting at the floor)
  private readonly interior: PIXI.Container;
  private readonly floorTile: PIXI.TilingSprite;
  private readonly wallStrip: PIXI.Sprite; // BACKWALL across the top
  private readonly wallFill: PIXI.Graphics; // plain wall above the strip
  private readonly doorSprite: PIXI.Sprite; // ROOMDOOR — the way out

  private readonly avatar: PIXI.Container;
  private readonly heliFly: DirectionalSprite;
  private readonly heliLand: DirectionalSprite;
  private readonly heliParked: PIXI.Sprite;
  private readonly person: DirectionalSprite;
  private readonly tooly: DirectionalSprite;
  private toolyX = 0; // Tooly's own world x (trails the person, street view)
  private toolyIX = 0.4; // Tooly's interior position (trails the person inside)
  private toolyIY = 0.8;
  private personBaseScale = 1; // the walking person's natural scale (interior scales by depth)

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
  /** True between boarding the parked copter and becoming airborne again. */
  private takingOff = false;

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
    this.sideLawnTile = tile('lawn4');
    this.sideStreetTile = tile('street4');
    this.sideLawnTile.visible = this.sideStreetTile.visible = false;
    this.container.addChild(this.sideLawnTile, this.sideStreetTile);
    this.sideWorld = new PIXI.Container();
    this.sideWorld.visible = false;
    this.container.addChild(this.sideWorld);
    this.buildSideWorld();

    // --- room interior (standing view) ---
    this.interior = new PIXI.Container();
    this.interior.visible = false;
    this.container.addChild(this.interior);
    this.wallFill = new PIXI.Graphics();
    this.floorTile = new PIXI.TilingSprite(assets.floors['a'] ?? PIXI.Texture.WHITE, 64, 64);
    this.wallStrip = new PIXI.Sprite(assets.backwall);
    this.doorSprite = new PIXI.Sprite(assets.roomdoor);
    this.doorSprite.anchor.set(0.5, 1);
    this.interior.addChild(this.wallFill, this.floorTile, this.wallStrip, this.doorSprite);

    this.avatar = new PIXI.Container();
    this.container.addChild(this.avatar);
    this.heliFly = new DirectionalSprite(assets.heliFly, 70);
    this.heliLand = new DirectionalSprite(assets.heliLand, 80);
    this.person = new DirectionalSprite(assets.person, 95);
    this.tooly = new DirectionalSprite(assets.tooly, 110);
    fitHeight(this.heliFly.sprite, 130);
    fitWidth(this.heliLand.sprite, HELI_LAND_W); // big when landing
    fitHeight(this.person.sprite, 116);
    this.personBaseScale = this.person.sprite.scale.x;
    fitHeight(this.tooly.sprite, 64);
    this.heliFly.sprite.anchor.set(0.5, 0.5);
    this.heliLand.sprite.anchor.set(0.5, 1);
    this.person.sprite.anchor.set(0.5, 1);
    this.tooly.sprite.anchor.set(0.5, 1);
    this.heliParked = new PIXI.Sprite(assets.heliParked);
    this.heliParked.anchor.set(0.5, 1);
    this.heliParked.scale.set(HELI_LAND_W / this.heliParked.texture.width); // big when landed
    this.sideWorld.addChild(this.heliParked);
    // Tooly + the person live in the avatar layer (screen space) so they show in
    // both the street and the room; the avatar layer is positioned per mode.
    this.avatar.addChild(
      this.heliFly.sprite,
      this.heliLand.sprite,
      this.person.sprite,
      this.tooly.sprite,
    );

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
      if (e.key === 'Escape') {
        if (this.model.mode === 'walking') {
          if (this.locked) document.exitPointerLock?.(); // free the mouse for the menu
          this.cb.onEscape?.();
        } else if (this.model.mode === 'inside') {
          this.model.leaveRoom(); // step back out to the street
        }
      }
      if (e.key.toLowerCase() === 's') {
        if (this.model.mode === 'walking') this.cb.onEnter?.('grass'); // sit on the grass
        else if (this.model.mode === 'inside') this.cb.onEnter?.('house', this.model.insideHouse ?? undefined); // sit at the floor
      }
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

  /** Come back after sitting at the floor. If we entered a house we return to
   * the room standing view (stepped back from the floor so we don't instantly
   * re-sit, matching at_floor → stand up → room_walking); if we sat on the
   * grass we return to the street. */
  resume(): void {
    this.takingOff = false;
    if (this.model.mode === 'inside') this.model.iy = 0.72; // back off the floor front
    else this.model.standUp();
    this.setActive(true);
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
    return this.renderer.height * WALK_BASE_FRAC;
  }
  private heliBaseY(): number {
    return this.renderer.height * 0.92;
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
      // After boarding the parked copter we auto-climb until airborne.
      const up = this.takingOff || this.buttons.right || this.keys.has('ArrowUp');
      const down = !this.takingOff && (this.buttons.left || this.keys.has('ArrowDown'));
      const dir: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      const drift = this.takingOff ? 0 : this.inputPxX(LAND_SCREENS_PER_S, dt) / K_SIDE;
      // Mouse y flies the copter directly (prgrmmr.cpp:4338 — y += delta_y).
      const descentPx = this.heliBaseY() - this.renderer.height * 0.3;
      const dLandY = this.takingOff ? 0 : -this.inputPxY(LAND_SCREENS_PER_S, dt) / descentPx;
      this.model.land(dir, dt, drift, dLandY);
      this.heliLand.update(dt, true);
      if ((this.model.mode as CityMode) === 'flying') this.takingOff = false; // airborne
    } else if (this.model.mode === 'walking') {
      // walking the street (side view) — fully 8-directional
      const px = this.inputPxX(WALK_SCREENS_PER_S, dt);
      const keyVy = (this.keyRamp('ArrowDown') - this.keyRamp('ArrowUp')) * WALK_SCREENS_PER_S;
      const pyMax = (WALK_SCREENS_PER_S * this.renderer.height * dt) / 1000;
      const py = clampAbs(this.mouseDY + (keyVy * this.renderer.height * dt) / 1000, pyMax);
      this.model.walk(px / K_SIDE, py / DEPTH);
      this.person.setDirection(this.model.dir);
      this.person.update(dt, Math.abs(px) > 0.4 || Math.abs(py) > 0.4);

      // Walked into the parked copter → take off. Walked up to a door → step
      // into the room (the standing view) before sitting at the floor.
      if (this.model.boardHelicopter()) {
        this.takingOff = true;
      } else {
        this.model.enterHouse();
      }

      // Tooly trails the walker: eases toward a point just behind them.
      const behind = this.model.dir >= 5 || this.model.dir === 0 ? -110 : 110;
      const target = this.model.cx + behind;
      const step = (target - this.toolyX) * Math.min(1, dt / 280);
      this.toolyX += step;
      this.tooly.setDirection(step > 0 ? 0 : 4);
      this.tooly.update(dt, Math.abs(step) > 0.25);
    }
    // Standing in the room: walk around, then sit at the floor or leave.
    if (this.model.mode === 'inside') {
      const px = this.inputPxX(WALK_SCREENS_PER_S, dt);
      const keyVy = (this.keyRamp('ArrowDown') - this.keyRamp('ArrowUp')) * WALK_SCREENS_PER_S;
      const py = this.mouseDY + (keyVy * this.renderer.height * dt) / 1000;
      const moving = Math.abs(px) > 0.4 || Math.abs(py) > 0.4;
      // interior coords are normalised; convert screen px → 0..1 over the room
      const result = this.model.walkInside(px / (this.renderer.width * 0.7), py / (this.renderer.height * 0.6));
      this.person.setDirection(this.model.dir);
      this.person.update(dt, moving);
      // Tooly trails in interior space too.
      const tb = this.model.dir >= 5 || this.model.dir === 0 ? -0.08 : 0.08;
      this.toolyIX += (this.model.ix + tb - this.toolyIX) * Math.min(1, dt / 280);
      this.toolyIY += (this.model.iy - this.toolyIY) * Math.min(1, dt / 280);
      this.tooly.setDirection(this.model.dir);
      this.tooly.update(dt, moving);
      if (result === 'sit') this.cb.onEnter?.('house', this.model.insideHouse ?? undefined);
      // 'leave' already flipped the model back to 'walking'; nothing to do.
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
    this.decor.visible = flying;
    this.sideLawnTile.visible = street;
    this.sideStreetTile.visible = street;
    this.sideWorld.visible = street;
    this.interior.visible = inside;
    this.heliFly.sprite.visible = flying;
    this.heliLand.sprite.visible = m === 'landing';
    this.heliParked.visible = m === 'walking';
    // the lego person + Tooly appear both on the street and in the room
    this.person.sprite.visible = m === 'walking' || inside;
    this.tooly.sprite.visible = m === 'walking' || inside;
    // Tooly lives in sideWorld (street) but is repositioned to the avatar layer
    // feel via render(); keep it parented to sideWorld and just toggle here.
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

    if (m.mode === 'inside') {
      this.renderInterior(W, H);
      return;
    }

    // Street view: camera follows the copter (landing) / the walker (walking).
    // The backdrop is the GREEN LEGO lawn brush (the original front view clears
    // with the lawn brush — no blue sky), with the street brush at the bottom.
    const streetTop = this.streetTop();
    const camX = W / 2 - m.cx * K_SIDE; // world-origin screen x

    place(this.sideLawnTile, 0, 0, W, streetTop, camX, 0); // green lego backdrop
    place(this.sideStreetTile, 0, streetTop, W, H - streetTop, camX, 0);

    this.sideWorld.position.set(camX, 0);
    for (const child of this.sideWorld.children) {
      if (child === this.heliParked) child.y = this.heliBaseY();
      else child.y = streetTop + 6; // houses stand on the lawn/street line
    }
    this.heliParked.x = m.landX * K_SIDE;
    this.avatar.position.set(0, 0); // screen space
    this.tooly.sprite.position.set(camX + this.toolyX * K_SIDE, this.walkBaseY());

    if (m.mode === 'landing') {
      // The copter descends at the camera centre: landY 1 = near the top,
      // 0 = on the street. (Bottom-anchored, so y is where its skids are.)
      const topY = H * 0.18;
      this.heliLand.sprite.position.set(
        W / 2,
        topY + (1 - Math.min(m.landY, 1)) * (this.heliBaseY() - topY),
      );
      this.avatar.position.set(0, 0);
    } else {
      // walking: the person is screen-centred horizontally; vertical position
      // reflects how far they've walked toward the houses (depth).
      const depthY = (m.cy - m.streetY) * DEPTH;
      this.person.sprite.scale.set(this.personBaseScale); // undo interior perspective
      this.person.sprite.position.set(W / 2, this.walkBaseY() + depthY);
      this.avatar.position.set(0, 0);
    }
  }

  /** The room you stand in after entering a house (Programmer_Room_Walking):
   * the floor baseplate (by house style) with a back wall and the door. You
   * walk here, then walk to the front of the floor (or click/key) to sit. */
  private renderInterior(W: number, H: number): void {
    const m = this.model;
    const wallBottom = H * 0.3; // floor starts here
    // back wall: a plain band with the BACKWALL strip along its foot
    this.wallFill.clear();
    this.wallFill.beginFill(0x6b5240); // warm wall colour behind the strip
    this.wallFill.drawRect(0, 0, W, wallBottom);
    this.wallFill.endFill();
    this.wallStrip.texture = this.assets.backwall;
    this.wallStrip.width = W;
    this.wallStrip.height = 40;
    this.wallStrip.position.set(0, wallBottom - 40);
    // floor: the lego baseplate (by style), tiled across the lower area
    const style = m.insideHouse?.style ?? 'a';
    this.floorTile.texture = this.assets.floors[style] ?? this.assets.floors['a']!;
    this.floorTile.tileScale.set(0.6);
    this.floorTile.position.set(0, wallBottom);
    this.floorTile.width = W;
    this.floorTile.height = H - wallBottom;
    // door (the way out) on the right wall
    this.doorSprite.height = wallBottom * 0.92;
    this.doorSprite.scale.x = this.doorSprite.scale.y;
    this.doorSprite.position.set(W * 0.9, wallBottom + 6);

    // map interior coords → screen; a little perspective scaling by depth
    const sx = (ix: number): number => W * 0.12 + ix * W * 0.76;
    const sy = (iy: number): number => wallBottom + 20 + iy * (H * 0.92 - (wallBottom + 20));
    const depthScale = (iy: number): number => 0.82 + iy * 0.3;

    this.avatar.position.set(0, 0);
    this.person.sprite.position.set(sx(m.ix), sy(m.iy));
    this.person.sprite.scale.set(this.personBaseScale * depthScale(m.iy));
    this.tooly.sprite.position.set(sx(this.toolyIX), sy(this.toolyIY));
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
