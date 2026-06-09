/**
 * The outdoor city scene: fly the helicopter, land it, walk around.
 *
 * Renders the pure CityModel. Three looks, driven by model.mode:
 *  - flying:  top-down. A green city of streets/houses/trees scrolls beneath a
 *             centred helicopter; the pointer's offset from centre pans (faster
 *             the higher you are), Up/Down (or right/left mouse) climb/descend.
 *             Descend to the minimum and you switch to landing.
 *  - landing: side elevation. The copter sinks from the sky toward a street;
 *             Down lands (→ walking, the empty copter stays), Up flies again.
 *  - walking: top-down at ground level. A centred lego person walks where you
 *             point; press H to call the helicopter back (→ flying).
 *
 * The avatar stays screen-centred; the world scrolls under it (clamped to the
 * city extent by the model). View-only — all state lives in CityModel.
 */
import * as PIXI from 'pixi.js';
import type { Renderer } from '../view/renderer';
import {
  CityModel,
  BLOCK,
  BLOCKS,
  STREET,
  CITY_MAX,
} from './city-model';
import { DirectionalSprite, type CityAssets } from './city-sprites';

const GROUND_PPU = 0.34; // screen pixels per city unit, on the ground
const PAN_SPEED = 320; // city units/sec of pan at full pointer deflection (flying base)
const WALK_SPEED = 360; // city units/sec walking at full deflection
const DEADZONE = 28; // px around centre with no movement
const HOUSE_UNITS = 360; // a house spans this many city units
const TREE_UNITS = 200;

const COLOR_WATER = 0x2f6fb0;
const COLOR_LAWN = 0x4f9b3f;
const COLOR_STREET = 0x6a6a6a;
const COLOR_SKY = 0x8fc7ec;

export class CityScene {
  readonly container: PIXI.Container;
  readonly model = new CityModel();

  private readonly ground: PIXI.Container; // top-down world (city units, scaled by k)
  private readonly side: PIXI.Container; // landing backdrop (screen space)
  private readonly avatar: PIXI.Container; // screen-centred avatar layer
  private readonly heliFly: DirectionalSprite;
  private readonly heliLand: DirectionalSprite;
  private readonly person: DirectionalSprite;
  private emptyHeli: PIXI.Sprite | null = null;

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
    const water = new PIXI.Graphics();
    this.container.addChild(water);
    this.water = water;

    this.ground = new PIXI.Container();
    this.container.addChild(this.ground);
    this.buildGround();

    this.side = new PIXI.Container();
    this.side.visible = false;
    this.container.addChild(this.side);

    this.avatar = new PIXI.Container();
    this.container.addChild(this.avatar);
    this.heliFly = new DirectionalSprite(assets.heliFly, 70);
    this.heliLand = new DirectionalSprite(assets.heliLand, 80);
    this.person = new DirectionalSprite(assets.person, 95);
    fitHeight(this.heliFly.sprite, 130);
    fitWidth(this.heliLand.sprite, 240);
    fitHeight(this.person.sprite, 116);
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
    renderer.app.renderer.on('resize', () => this.layoutSide());
    this.layoutSide();
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

  // --- build static world ---------------------------------------------------

  private buildGround(): void {
    const g = new PIXI.Graphics();
    // green lawn over the whole city
    g.beginFill(COLOR_LAWN);
    g.drawRect(0, 0, CITY_MAX, CITY_MAX);
    g.endFill();
    // gray street grid on block boundaries
    g.beginFill(COLOR_STREET);
    for (let i = 0; i <= BLOCKS; i++) {
      const p = i * BLOCK;
      g.drawRect(p - STREET / 2, 0, STREET, CITY_MAX); // vertical streets
      g.drawRect(0, p - STREET / 2, CITY_MAX, STREET); // horizontal streets
    }
    g.endFill();
    this.ground.addChild(g);

    // houses + trees as sprites in city-unit space
    for (const h of this.model.houses) {
      const tex = this.assets.houses[h.style] ?? this.assets.houses['b']!;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5, 0.5);
      const sc = HOUSE_UNITS / s.texture.width;
      s.scale.set(sc);
      s.position.set(h.x, h.y);
      this.ground.addChild(s);
    }
    for (const t of this.model.trees) {
      const s = new PIXI.Sprite(this.assets.tree);
      s.anchor.set(0.5, 0.85);
      const sc = TREE_UNITS / s.texture.width;
      s.scale.set(sc);
      s.position.set(t.x, t.y);
      this.ground.addChild(s);
    }
  }

  /** The side-elevation backdrop for landing: sky over a street, a few houses. */
  private layoutSide(): void {
    this.side.removeChildren().forEach((c) => c.destroy());
    const W = this.renderer.width;
    const H = this.renderer.height;
    const streetTop = H * 0.74;
    const g = new PIXI.Graphics();
    g.beginFill(COLOR_SKY);
    g.drawRect(0, 0, W, streetTop);
    g.endFill();
    g.beginFill(COLOR_LAWN);
    g.drawRect(0, streetTop - 14, W, 18);
    g.endFill();
    g.beginFill(COLOR_STREET);
    g.drawRect(0, streetTop, W, H - streetTop);
    g.endFill();
    // lane dashes
    g.beginFill(0xd9d27a);
    for (let x = 20; x < W; x += 90) g.drawRect(x, streetTop + (H - streetTop) / 2 - 4, 46, 8);
    g.endFill();
    this.side.addChild(g);
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
      const up =
        this.buttons.right || this.keys.has('ArrowUp') || this.keys.has('Shift');
      const down = this.buttons.left || this.keys.has('ArrowDown');
      const alt: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      const panX = fx * PAN_SPEED * (dt / 1000);
      const panY = fy * PAN_SPEED * (dt / 1000);
      this.model.fly(panX, panY, alt, dt);
      this.heliFly.setDirection(this.model.dir);
      this.heliFly.update(dt, true); // rotor always spins
    } else if (this.model.mode === 'landing') {
      const up = this.buttons.right || this.keys.has('ArrowUp');
      const down = this.buttons.left || this.keys.has('ArrowDown') || (!up && fy > 0.2);
      const dir: -1 | 0 | 1 = up ? 1 : down ? -1 : 0;
      this.model.land(dir, dt);
      this.heliLand.update(dt, true);
    } else {
      // walking
      const dx = fx * WALK_SPEED * (dt / 1000);
      const dy = fy * WALK_SPEED * (dt / 1000);
      const moving = Math.abs(fx) > 0 || Math.abs(fy) > 0;
      this.model.walk(dx, dy);
      this.person.setDirection(this.model.dir);
      this.person.update(dt, moving);
    }

    this.syncModeVisibility();
    this.render();
  };

  /** When we step out of the copter, leave it parked on the ground (top-down). */
  private ensureEmptyHeli(): void {
    if (this.emptyHeli) {
      this.emptyHeli.position.set(this.model.cx, this.model.cy);
      return;
    }
    const s = new PIXI.Sprite(this.assets.heliFly.textures[2]![0]); // facing south
    s.anchor.set(this.assets.heliFly.anchor[0], this.assets.heliFly.anchor[1]);
    s.scale.set(220 / s.texture.width);
    s.position.set(this.model.cx, this.model.cy);
    this.ground.addChild(s);
    this.emptyHeli = s;
  }

  private syncModeVisibility(): void {
    const m = this.model.mode;
    this.ground.visible = m !== 'landing';
    this.water.visible = m !== 'landing';
    this.side.visible = m === 'landing';
    this.heliFly.sprite.visible = m === 'flying';
    this.heliLand.sprite.visible = m === 'landing';
    this.person.sprite.visible = m === 'walking';
    if (m === 'walking') this.ensureEmptyHeli();
  }

  private render(): void {
    const W = this.renderer.width;
    const H = this.renderer.height;
    const m = this.model;

    if (m.mode !== 'landing') {
      // water backdrop fills the screen
      this.water.clear();
      this.water.beginFill(COLOR_WATER);
      this.water.drawRect(0, 0, W, H);
      this.water.endFill();

      const k = GROUND_PPU / (m.mode === 'flying' ? m.scale : 1);
      this.ground.scale.set(k);
      this.ground.position.set(W / 2 - m.cx * k, H / 2 - m.cy * k);
      this.avatar.position.set(W / 2, H / 2);
    } else {
      // side view: helicopter at landY (1 = top, 0 = street)
      const topY = H * 0.12;
      const groundY = H * 0.66;
      this.heliLand.sprite.position.set(W / 2, topY + (1 - m.landY) * (groundY - topY));
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
  const sc = px / s.texture.height;
  s.scale.set(sc);
}
function fitWidth(s: PIXI.Sprite, px: number): void {
  const sc = px / s.texture.width;
  s.scale.set(sc);
}
