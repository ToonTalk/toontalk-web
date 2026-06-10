/**
 * The outdoor city scene: fly the helicopter, land it, walk around.
 *
 * Renders the pure CityModel. Two looks, driven by model.mode:
 *  - flying:  top-down. The rectangular 3×3-block city (street grid, the three
 *             starter houses, trees) scrolls beneath a centred helicopter; the
 *             pointer's offset from centre pans (faster the higher you are),
 *             Up/right-button climb, Down/left-button descend. Descending to
 *             the minimum altitude switches to…
 *  - landing + walking: the HORIZONTAL street view. Sky over lawn over street;
 *             the houses of the street you chose drawn with their side-view
 *             art. The helicopter (side-view art) sinks toward the street —
 *             Down lands, Up flies again. On touchdown the copter swaps to its
 *             parked art and stays put; the lego person steps out and walks the
 *             street (E/W where you point), with Tooly the toolbox trailing
 *             behind. H calls the helicopter back (→ flying).
 *
 * The avatar stays screen-centred; the world scrolls under it (clamped by the
 * model). View-only — all state lives in CityModel.
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
const PAN_SPEED = 320; // city units/sec of pan at full pointer deflection (flying)
const WALK_SPEED = 300; // city units/sec walking at full deflection
const DEADZONE = 28; // px around centre with no movement
const HOUSE_UNITS = 210; // a house's top-down footprint (lot is BLOCK_W/3 ≈ 267)
const TREE_UNITS = 120;

const COLOR_WATER = 0x2f6fb0;
const COLOR_LAWN = 0x4f9b3f;
const COLOR_STREET = 0x6a6a6a;
const COLOR_SKY = 0x8fc7ec;

export class CityScene {
  readonly container: PIXI.Container;
  readonly model = new CityModel();

  private readonly ground: PIXI.Container; // top-down world (city units, scaled)
  private readonly sideBg: PIXI.Graphics; // street view backdrop (screen space)
  private readonly sideWorld: PIXI.Container; // street view world (scrolls with camera)
  private readonly avatar: PIXI.Container; // screen-centred avatar layer
  private readonly heliFly: DirectionalSprite;
  private readonly heliLand: DirectionalSprite; // descending (animated rotors)
  private readonly heliParked: PIXI.Sprite; // static, stays where it touched down
  private readonly person: DirectionalSprite;
  private readonly tooly: DirectionalSprite; // Tooly the toolbox, follows the walker
  private toolyX = 0; // Tooly's own world x (trails the person)

  private active = false;
  private pointer = { x: 0, y: 0 };
  private buttons = { left: false, right: false };
  private keys = new Set<string>();

  constructor(
    private readonly renderer: Renderer,
    private readonly assets: CityAssets,
  ) {
    this.container = new PIXI.Container();
    this.container.visible = false;
    this.container.zIndex = 500;

    // Blue water fills everything behind the (smaller) green city.
    this.water = new PIXI.Graphics();
    this.container.addChild(this.water);

    this.ground = new PIXI.Container();
    this.container.addChild(this.ground);
    this.buildGround();

    // The street view: fixed backdrop + a world layer that scrolls with you.
    this.sideBg = new PIXI.Graphics();
    this.sideBg.visible = false;
    this.container.addChild(this.sideBg);
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
    // Predictable registration: flying heli centred; everything that stands on
    // the street is anchored at its feet (bottom-centre).
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

    // Input (all gated by `active`).
    const stage = renderer.app.stage;
    stage.on('pointermove', (e) => {
      this.pointer = { x: e.global.x, y: e.global.y };
    });
    stage.on('pointerdown', (e) => {
      if (e.button === 2) this.buttons.right = true;
      else this.buttons.left = true;
    });
    stage.on('pointerup', () => {
      this.buttons.left = this.buttons.right = false;
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      this.keys.add(e.key);
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
      if (e.key.toLowerCase() === 'h') this.model.callHelicopter();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    // Suppress the browser context menu so the right button can mean "ascend".
    renderer.view.addEventListener('contextmenu', (ev) => {
      if (this.active) ev.preventDefault();
    });

    renderer.app.ticker.add(this.tick);
    renderer.app.renderer.on('resize', () => this.layoutSideBg());
    this.layoutSideBg();
    this.syncModeVisibility();
  }

  private water!: PIXI.Graphics;

  setActive(on: boolean): void {
    this.active = on;
    this.container.visible = on;
    if (!on) {
      this.buttons.left = this.buttons.right = false;
      this.keys.clear();
    } else {
      this.pointer = { x: this.renderer.width / 2, y: this.renderer.height / 2 };
    }
  }

  get isActive(): boolean {
    return this.active;
  }

  // --- build static worlds ---------------------------------------------------

  /** Top-down: lawn, street grid, the three houses (top art), trees. */
  private buildGround(): void {
    const g = new PIXI.Graphics();
    g.beginFill(COLOR_LAWN);
    g.drawRect(0, 0, CITY_W, CITY_H);
    g.endFill();
    g.beginFill(COLOR_STREET);
    for (let i = 0; i <= BLOCKS_X; i++) {
      g.drawRect(i * BLOCK_W - STREET / 2, 0, STREET, CITY_H); // vertical streets
    }
    for (let j = 0; j <= BLOCKS_Y; j++) {
      g.drawRect(0, j * BLOCK_H - STREET / 2, CITY_W, STREET); // horizontal streets
    }
    g.endFill();
    this.ground.addChild(g);

    for (const h of this.model.houses) {
      const tex = this.assets.houses[h.style] ?? this.assets.houses['b']!;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5, 0.5);
      s.scale.set(HOUSE_UNITS / s.texture.width);
      s.position.set(h.x, h.y);
      this.ground.addChild(s);
    }
    for (const t of this.model.trees) {
      const s = new PIXI.Sprite(this.assets.tree);
      s.anchor.set(0.5, 0.85);
      s.scale.set(TREE_UNITS / s.texture.width);
      s.position.set(t.x, t.y);
      this.ground.addChild(s);
    }
  }

  /** Street view world: the houses with their side-view art, at world x. */
  private buildSideWorld(): void {
    for (const h of this.model.houses) {
      const tex = this.assets.houseSides[h.style];
      if (!tex) continue;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5, 1); // baseline at the lawn/street boundary
      s.position.set(h.x * K_SIDE, 0); // y set in layoutSideBg (screen-height bound)
      this.sideWorld.addChild(s);
    }
  }

  /** Screen-space backdrop for the street view: sky, lawn strip, street. */
  private layoutSideBg(): void {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const streetTop = this.streetTop();
    const g = this.sideBg;
    g.clear();
    g.beginFill(COLOR_SKY);
    g.drawRect(0, 0, W, streetTop - 16);
    g.endFill();
    g.beginFill(COLOR_LAWN); // the lawn strip the houses stand on
    g.drawRect(0, streetTop - 16, W, 16);
    g.endFill();
    g.beginFill(COLOR_STREET);
    g.drawRect(0, streetTop, W, H - streetTop);
    g.endFill();
    g.beginFill(0xd9d27a); // lane dashes
    for (let x = 20; x < W; x += 90) g.drawRect(x, streetTop + (H - streetTop) * 0.55, 46, 8);
    g.endFill();

    // re-seat world baselines that depend on screen height
    for (const child of this.sideWorld.children) {
      if (child === this.heliParked) child.y = this.heliBaseY();
      else if (child === this.tooly.sprite) child.y = this.walkBaseY();
      else child.y = streetTop - 12; // houses on their lawn
    }
  }

  private streetTop(): number {
    return this.renderer.height * 0.72;
  }
  private walkBaseY(): number {
    return this.renderer.height * 0.88; // the person's feet, on the street
  }
  private heliBaseY(): number {
    return this.renderer.height * 0.85;
  }

  // --- per-frame ------------------------------------------------------------

  private tick = (): void => {
    if (!this.active) return;
    const dt = this.renderer.app.ticker.deltaMS;
    const W = this.renderer.width;
    const H = this.renderer.height;

    // pointer offset from centre, with a deadzone, as a -1..1 fraction
    const ox = this.pointer.x - W / 2;
    const oy = this.pointer.y - H / 2;
    const maxR = Math.min(W, H) / 2;
    const fx = frac(ox, maxR);
    const fy = frac(oy, maxR);

    if (this.model.mode === 'flying') {
      const up = this.buttons.right || this.keys.has('ArrowUp') || this.keys.has('Shift');
      const down = this.buttons.left || this.keys.has('ArrowDown');
      const alt: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      const panX = fx * PAN_SPEED * (dt / 1000);
      const panY = fy * PAN_SPEED * (dt / 1000);
      this.model.fly(panX, panY, alt, dt);
      this.heliFly.setDirection(this.model.dir);
      this.heliFly.update(dt, true); // rotor always spins
      const after = this.model.mode as CityMode; // fly() may have switched modes
      if (after === 'landing') this.toolyX = this.model.cx - 130; // pre-seat Tooly
    } else if (this.model.mode === 'landing') {
      const up = this.buttons.right || this.keys.has('ArrowUp');
      const down = this.buttons.left || this.keys.has('ArrowDown') || (!up && fy > 0.2);
      const dir: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      this.model.land(dir, dt);
      this.heliLand.update(dt, true);
    } else {
      // walking the street (side view)
      const dx = fx * WALK_SPEED * (dt / 1000);
      this.model.walk(dx);
      this.person.setDirection(this.model.dir);
      this.person.update(dt, Math.abs(fx) > 0);

      // Tooly trails the walker: eases toward a point just behind them.
      const behind = this.model.dir === 0 ? -110 : 110;
      const target = this.model.cx + behind;
      const step = (target - this.toolyX) * Math.min(1, dt / 280);
      this.toolyX += step;
      this.tooly.setDirection(step > 0 ? 0 : 4);
      this.tooly.update(dt, Math.abs(step) > 0.25);
    }

    this.syncModeVisibility();
    this.render();
  };

  private syncModeVisibility(): void {
    const m = this.model.mode;
    const flying = m === 'flying';
    this.ground.visible = flying;
    this.water.visible = flying;
    this.sideBg.visible = !flying;
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
      this.water.clear();
      this.water.beginFill(COLOR_WATER);
      this.water.drawRect(0, 0, W, H);
      this.water.endFill();

      const k = GROUND_PPU / m.scale;
      this.ground.scale.set(k);
      this.ground.position.set(W / 2 - m.cx * k, H / 2 - m.cy * k);
      this.avatar.position.set(W / 2, H / 2);
      return;
    }

    // Street view: camera follows the copter (landing) / the walker (walking).
    this.sideWorld.position.set(W / 2 - m.cx * K_SIDE, 0);
    this.heliParked.position.set(m.landX * K_SIDE, this.heliBaseY());
    this.tooly.sprite.position.set(this.toolyX * K_SIDE, this.walkBaseY());

    if (m.mode === 'landing') {
      // The copter descends at the camera centre: landY 1 = near the top,
      // 0 = on the street. (Bottom-anchored, so y is where its skids are.)
      const topY = H * 0.3;
      this.heliLand.sprite.position.set(
        W / 2,
        topY + (1 - m.landY) * (this.heliBaseY() - topY),
      );
      this.avatar.position.set(0, 0);
    } else {
      // walking: the person is screen-centred at street level
      this.person.sprite.position.set(W / 2, this.walkBaseY());
      this.avatar.position.set(0, 0);
    }
  }

  destroy(): void {
    this.renderer.app.ticker.remove(this.tick);
    this.container.destroy({ children: true });
  }
}

/** Pointer-offset to a -1..1 fraction with a centre deadzone. */
function frac(offset: number, maxR: number): number {
  const sign = Math.sign(offset);
  const mag = Math.abs(offset);
  if (mag < DEADZONE) return 0;
  return sign * Math.min(1, (mag - DEADZONE) / (maxR - DEADZONE));
}

function fitHeight(s: PIXI.Sprite, px: number): void {
  s.scale.set(px / s.texture.height);
}
function fitWidth(s: PIXI.Sprite, px: number): void {
  s.scale.set(px / s.texture.width);
}
