/**
 * The ToonTalk "room" chrome — a reconstruction of the original desktop scene:
 * a tan LEGO-baseplate floor, the open toolbox (top-right) whose icons can be
 * picked to drop a fresh element on the floor, an open notebook (bottom), the
 * wand and vacuum tools (left), and the giant hand cursor on a red arm that
 * follows the pointer.
 *
 * Presentation only: it draws onto the renderer's background (below the
 * interactive things) plus a top cursor layer. It reads textures and emits
 * pick events; it never touches the model directly.
 */
import * as PIXI from 'pixi.js';
import type { Renderer } from './renderer';
import type { RenderTheme } from '../config/render-mode';
import type { Thing } from '../model/thing';
import { NumberThing } from '../model/number';
import { TextThing } from '../model/text';
import { Box } from '../model/box';
import { Nest } from '../model/nest';
import { Scale } from '../model/scale';
import { Robot } from '../model/robot';
import { Truck } from '../model/truck';
import { Bomb } from '../model/bomb';
import { renderThingDisplay } from './display';

const ROOM_KEYS = ['floor', 'toolbox', 'toolbox-open', 'notebook', 'hand', 'hand-point', 'hand-grab', 'hand-wand', 'truck'] as const;

export async function loadRoomTextures(theme: RenderTheme): Promise<Map<string, PIXI.Texture>> {
  const scaleMode =
    theme.scaleMode === 'nearest' ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;
  const map = new Map<string, PIXI.Texture>();
  await Promise.all(
    ROOM_KEYS.map(async (key) => {
      try {
        const tex = await PIXI.Assets.load(`/assets/room/${key}.png`);
        tex.baseTexture.scaleMode = scaleMode;
        map.set(key, tex);
      } catch {
        map.set(key, PIXI.Texture.WHITE);
      }
    }),
  );
  // Per-house-style floor baseplates (a=tan, b=blue, c=green) so the working
  // floor matches the house you entered (city-baked FLOOR arts).
  await Promise.all(
    (['a', 'b', 'c'] as const).map(async (s) => {
      try {
        const tex = await PIXI.Assets.load(`/assets/city/floor-${s}.png`);
        tex.baseTexture.scaleMode = scaleMode;
        map.set(`floor-${s}`, tex);
      } catch {
        /* fall back to the default tan floor */
      }
    }),
  );
  return map;
}

/** Called when a toolbox/tool icon is clicked; spawns that element in the world. */
/** Take a fresh copy of a toolbox element out at (x, y) — an infinite stack. */
export type PickHandler = (key: string, x: number, y: number) => void;

const ARM_COLOR = 0xbb5d64; // sampled from the hand texture's wrist stub

/**
 * Per-pose cursor calibration. Each hand frame has its hotspot (anchor) and a
 * red wrist stub the sleeve must continue — stub centre offset (`cx`, fraction
 * of width from centre), width (`w`), and where it starts down the sprite
 * (`top`), all measured from the bitmaps.
 */
type HandPose = 'open' | 'grab' | 'holdwand';
interface PoseSpec {
  key: string;
  anchor: [number, number];
  scale: number;
  cx: number;
  w: number;
  top: number;
}
const HAND_POSES: Record<HandPose, PoseSpec> = {
  // Empty: the POINTING hand (HAND04) — index extended, others curled, like the
  // original's idle cursor. Hotspot at the fingertip (top); red wrist stub at the
  // bottom-centre.
  open: { key: 'hand-point', anchor: [0.5, 0.08], scale: 1.05, cx: 0.06, w: 0.3, top: 0.72 },
  grab: { key: 'hand-grab', anchor: [0.5, 0.2], scale: 1.2, cx: 0.24, w: 0.41, top: 0.62 },
  // Holding the wand: the hand grips it on the right, tip points left (hotspot);
  // wrist is far right (~0.83w). Wide sprite, so scaled down. (May need tuning.)
  holdwand: { key: 'hand-wand', anchor: [0.06, 0.42], scale: 0.85, cx: 0.77, w: 0.33, top: 0.16 },
};

export class Room {
  private readonly floor: PIXI.TilingSprite;
  private readonly chrome: PIXI.Container;
  private readonly cursor: PIXI.Container;
  private readonly handSprite: PIXI.Sprite;
  private readonly arm: PIXI.Graphics;

  constructor(
    private readonly renderer: Renderer,
    private readonly room: Map<string, PIXI.Texture>,
    private readonly tools: Map<string, PIXI.Texture>,
    private readonly theme: RenderTheme,
    private readonly onPick: PickHandler,
  ) {
    this.floor = new PIXI.TilingSprite(
      room.get('floor') ?? PIXI.Texture.WHITE,
      renderer.width,
      renderer.height,
    );
    renderer.background.addChild(this.floor);

    this.chrome = new PIXI.Container();
    renderer.background.addChild(this.chrome);
    this.layoutChrome();

    this.cursor = new PIXI.Container();
    this.cursor.eventMode = 'none';
    this.arm = new PIXI.Graphics();
    this.handSprite = new PIXI.Sprite();
    this.cursor.addChild(this.arm, this.handSprite);
    renderer.app.stage.addChild(this.cursor);
    this.applyPose('open');
    this.setHand(renderer.width * 0.45, renderer.height * 0.45);

    // (Cursor pose is driven by the drag controller via setPose, based on what
    // the hand is holding.)

    // Keep the floor + chrome covering the whole canvas on any renderer resize
    // (fires on the initial auto-resize too, so the floor always fills the tab).
    renderer.app.renderer.on('resize', () => this.resize());
  }

  private pose: HandPose = 'open';
  private handX = 0;
  private handY = 0;
  /** Tooly starts closed (the green box-creature); click opens the tray. */
  private toolboxOpen = true;

  private applyPose(pose: HandPose): void {
    this.pose = pose;
    const spec = HAND_POSES[pose];
    this.handSprite.texture = this.room.get(spec.key) ?? PIXI.Texture.WHITE;
    this.handSprite.anchor.set(spec.anchor[0], spec.anchor[1]);
    this.handSprite.scale.set(spec.scale);
  }

  setPose(pose: HandPose): void {
    if (pose === this.pose) return;
    this.applyPose(pose);
    this.setHand(this.handX, this.handY);
  }

  resize(): void {
    this.floor.width = this.renderer.width;
    this.floor.height = this.renderer.height;
    this.chrome.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.layoutChrome();
  }

  /** Set the floor baseplate to the entered house's style (a=tan, b=blue,
   * c=green) so the working floor matches the house outside. */
  setFloorStyle(style: 'a' | 'b' | 'c'): void {
    const tex = this.room.get(`floor-${style}`) ?? this.room.get('floor');
    if (tex) this.floor.texture = tex;
  }

  /** Scroll the floor baseplate to match the floor camera (the toolbox chrome
   * stays put), so the studs slide as you sit at different spots. */
  setFloorPan(camX: number, camY: number): void {
    this.floor.tilePosition.set(-camX, -camY);
  }

  /** Show/hide the whole room (floor, chrome, hand cursor) — used when the
   * city scene is on top. Presentation only. */
  setVisible(v: boolean): void {
    this.floor.visible = v;
    this.chrome.visible = v;
    this.cursor.visible = v;
  }

  /** Move the hand so its fingertip points at (x, y); the sleeve continues the
   * hand texture's wrist stub (same colour, position and width) down off-screen. */
  setHand(x: number, y: number): void {
    this.handX = x;
    this.handY = y;
    this.handSprite.position.set(x, y);
    const spec = HAND_POSES[this.pose];
    const w = this.handSprite.width;
    const h = this.handSprite.height;
    const armCx = x + w * spec.cx;
    const armW = w * spec.w;
    const wristY = y + h * spec.top; // starts inside the hand, emerges at the wrist
    const bottom = this.renderer.height + 40;
    this.arm.clear();
    this.arm.beginFill(ARM_COLOR, 1);
    this.arm.drawRoundedRect(armCx - armW / 2, wristY, armW, bottom - wristY, armW * 0.5);
    this.arm.endFill();
  }

  // --- chrome layout -------------------------------------------------------

  private layoutChrome(): void {
    const W = this.renderer.width;

    // Tooly the toolbox lives at hand (top-right, screen-fixed so it "follows"
    // you). Closed it's the green box-creature; click it to OPEN the tray with
    // the tool stacks + the hand tools (faithful to the original — Video 8). The
    // tools stay inside Tooly (hidden) until it's open.
    if (!this.toolboxOpen) {
      const tooly = this.makeToolyClosed();
      tooly.position.set(W - 130, 150);
      this.chrome.addChild(tooly);
      return;
    }

    const toolbox = this.makeToolbox();
    toolbox.position.set(W - 235, 245);
    this.chrome.addChild(toolbox);

    // Opening Tooly SPILLS the hand tools out onto the floor below it (the wand,
    // Dusty the vacuum, Pumpy the pump), as in the original — each is its own
    // sprite at a tilt; picking one pulls a fresh copy out at the cursor.
    const spill: Array<[string, string, number, number, number]> = [
      ['wand', 'C', W - 330, 505, -0.25],
      ['dusty', 'S', W - 235, 520, 0.1],
      ['pumpy', '+', W - 150, 505, 0.2],
    ];
    for (const [pick, badge, x, y, tilt] of spill) {
      const chip = this.makeToolChip(pick, badge, tilt);
      chip.position.set(x, y);
      this.chrome.addChild(chip);
    }
    // The `claude 1` main notebook is the real interactive World object (filed
    // pages persist), so it's not chrome.
  }

  /** Open/close Tooly (rebuild the chrome). */
  private toggleToolbox(): void {
    this.toolboxOpen = !this.toolboxOpen;
    this.chrome.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.layoutChrome();
  }

  /** Closed Tooly — the real claymation toolbox (toolbox.png from M22): a
   * blue-grey lego box with a red handle and little feet. Click to open. */
  private makeToolyClosed(): PIXI.Container {
    const c = new PIXI.Container();
    const tex = this.room.get('toolbox');
    if (tex && tex !== PIXI.Texture.WHITE) {
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      s.scale.set(160 / Math.max(s.width, 1)); // display ~160px wide
      c.addChild(s);
      c.hitArea = new PIXI.Rectangle(-s.width / 2, -s.height / 2, s.width, s.height);
    } else {
      const g = new PIXI.Graphics(); // fallback if the bitmap is missing
      g.beginFill(0x6b8aa0, 1);
      g.drawRoundedRect(-66, -40, 132, 92, 14);
      g.endFill();
      g.beginFill(0xc23b34, 1);
      g.drawRoundedRect(-30, -52, 60, 14, 7);
      g.endFill();
      c.addChild(g);
      c.hitArea = new PIXI.Rectangle(-66, -54, 132, 110);
    }
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointerdown', () => this.toggleToolbox());
    return c;
  }

  /** A toolbox hand-tool chip (chrome): the tool's icon + a small mode badge;
   * clicking pulls a fresh copy out at the cursor. */
  /** A hand tool spilled onto the floor by the open Tooly — the tool's own
   * sprite (no UI tray) at a slight tilt, with a small mode badge; clicking pulls
   * a fresh copy out at the cursor. */
  private makeToolChip(pick: string, badge: string, tilt = 0): PIXI.Container {
    const c = new PIXI.Container();
    // Pumpy keeps a crisp vector glyph (the detailed pump sprite goes muddy small).
    const icon = pick === 'pumpy' ? this.pumpGlyph() : this.makeIcon(pick, 56);
    c.addChild(icon);
    const b = new PIXI.Graphics();
    b.beginFill(0x223040, 0.92);
    b.drawCircle(22, 18, 11);
    b.endFill();
    const t = new PIXI.Text(badge, {
      fontFamily: this.theme.fontFamily,
      fontSize: 13,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    t.position.set(22, 18);
    c.addChild(b, t);
    c.rotation = tilt;
    c.hitArea = new PIXI.Rectangle(-30, -22, 64, 48);
    c.eventMode = 'static';
    c.cursor = 'grab';
    // Handle the pick here and stop it bubbling to the stage, so the tool is put
    // straight into the hand (via onPick) rather than the stage also reacting.
    c.on('pointerdown', (e) => {
      e.stopPropagation();
      this.onPick(pick, e.global.x, e.global.y);
    });
    return c;
  }

  /** A simple bicycle-pump glyph for the Pumpy toolbox chip — a crisp vector
   * that stays legible at chip size, where the detailed pump sprite goes muddy. */
  private pumpGlyph(): PIXI.Container {
    const g = new PIXI.Graphics();
    g.beginFill(0x3a6ea5, 1); // barrel
    g.drawRoundedRect(-4, -12, 9, 22, 3);
    g.endFill();
    g.beginFill(0x1c1f24, 1); // T-handle
    g.drawRoundedRect(-12, -17, 22, 5, 2);
    g.drawRoundedRect(-2, -16, 4, 8, 2);
    g.endFill();
    g.beginFill(0x565e69, 1); // foot/base
    g.drawRoundedRect(-9, 9, 18, 5, 2);
    g.endFill();
    g.lineStyle(3, 0x2c2f36, 1); // hose
    g.moveTo(5, 4);
    g.bezierCurveTo(16, 6, 15, 14, 11, 14);
    const c = new PIXI.Container();
    c.addChild(g);
    return c;
  }

  /** A studded lego panel (the toolbox lid). Tinted to Tooly's green by default. */
  private studdedPanel(
    w: number,
    h: number,
    base = 0x8d8896,
    studLight = 0xa7a2b0,
    studDark = 0x6a6675,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.lineStyle(2, studDark, 1);
    g.beginFill(base, 1);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.endFill();
    const step = 18;
    g.lineStyle(0);
    for (let sx = -w / 2 + step; sx < w / 2 - 4; sx += step) {
      for (let sy = -h / 2 + step; sy < h / 2 - 4; sy += step) {
        g.beginFill(studLight, 1);
        g.drawCircle(sx, sy, 4);
        g.endFill();
        g.beginFill(studDark, 0.6);
        g.drawCircle(sx + 1, sy + 2, 4);
        g.endFill();
      }
    }
    c.addChild(g);
    return c;
  }

  /** Tooly open: the real cropped photo of the original toolbox if we have it,
   * else the drawn grey-lego reconstruction. */
  private makeToolbox(): PIXI.Container {
    const tex = this.room.get('toolbox-open');
    if (tex && tex !== PIXI.Texture.WHITE) return this.makeToolboxImage(tex);
    return this.makeToolboxDrawn();
  }

  /** The open toolbox as the original artwork (cropped from the reference) with
   * invisible hit areas over each compartment that pick that element. */
  private makeToolboxImage(tex: PIXI.Texture): PIXI.Container {
    const box = new PIXI.Container();
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(420 / Math.max(sprite.width, 1)); // ~420px wide (matches the original's footprint)
    box.addChild(sprite);
    const W = sprite.width;
    const H = sprite.height;
    // Compartment centres as fractions of the image (measured from the crop):
    // number, text / box, nest / scale, robot / truck, bomb.
    const slots: Array<[string, number, number]> = [
      ['number', 0.26, 0.27], ['text', 0.49, 0.27],
      ['box', 0.27, 0.45], ['nest', 0.49, 0.45],
      ['scale', 0.27, 0.59], ['robot', 0.48, 0.60],
      ['truck', 0.27, 0.74], ['bomb', 0.49, 0.74],
    ];
    for (const [pick, fx, fy] of slots) {
      const hit = new PIXI.Container();
      hit.position.set((fx - 0.5) * W, (fy - 0.5) * H);
      hit.hitArea = new PIXI.Rectangle(-W * 0.1, -H * 0.075, W * 0.2, H * 0.15);
      hit.eventMode = 'static';
      hit.cursor = 'grab';
      // Handle here and don't bubble: the pick "births" the element in place
      // (lego brick + bam-mouse morph), rather than the stage dragging it away.
      hit.on('pointerdown', (e) => {
        e.stopPropagation();
        this.onPick(pick, e.global.x, e.global.y);
      });
      box.addChild(hit);
    }
    return box;
  }

  private makeToolboxDrawn(): PIXI.Container {
    const box = new PIXI.Container();
    const cols = 2;
    const rows = 4;
    const cell = 56;
    const gap = 10;
    const pad = 16;
    const w = cols * cell + (cols - 1) * gap + pad * 2;
    const h = rows * cell + (rows - 1) * gap + pad * 2;
    const depth = 16; // how tall the tray's 3-D front/side walls read

    // Open lid: a studded lego panel hinged up to the right, tilted back so we
    // see it edge-on (foreshortened), with hinge knobs joining it to the tray.
    const lid = this.studdedPanel(h * 0.84, h * 0.92);
    lid.position.set(w / 2 + h * 0.27, -h * 0.04);
    lid.rotation = 0.5;
    lid.scale.set(0.58, 0.96); // narrow → reads as an open lid seen at an angle
    lid.eventMode = 'static'; // click the lid to close Tooly
    lid.cursor = 'pointer';
    lid.on('pointerdown', () => this.toggleToolbox());
    box.addChild(lid);
    const hinges = new PIXI.Graphics();
    for (let k = -1; k <= 1; k++) {
      const hy = k * h * 0.26;
      hinges.beginFill(0x9aa1ab, 1);
      hinges.drawCircle(w / 2 + 3, hy, 7);
      hinges.endFill();
      hinges.beginFill(0x5b626c, 1);
      hinges.drawCircle(w / 2 + 3, hy, 3.2);
      hinges.endFill();
    }
    box.addChild(hinges);

    // Tray as a 3-D lego box: a dark front/side wall offset downward for depth,
    // a lighter top rim with studs around the border, and a recessed dark well.
    const tray = new PIXI.Graphics();
    tray.beginFill(0x000000, 0.28); // ground shadow
    tray.drawRoundedRect(-w / 2 + 8, -h / 2 + depth + 8, w, h, 12);
    tray.endFill();
    tray.beginFill(0x4e535a, 1); // front/side walls (the box's grey lego depth)
    tray.drawRoundedRect(-w / 2, -h / 2 + depth, w, h, 12);
    tray.endFill();
    tray.beginFill(0x8f949c, 1); // top rim (grey lego, lit)
    tray.drawRoundedRect(-w / 2, -h / 2, w, h, 12);
    tray.endFill();
    tray.beginFill(0xaab0b8, 1); // rim highlight (top edge)
    tray.drawRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, 6, 4);
    tray.endFill();
    tray.beginFill(0x2f3338, 1); // recessed well (dark grey interior)
    tray.drawRoundedRect(-w / 2 + pad - 6, -h / 2 + pad - 6, w - 2 * (pad - 6), h - 2 * (pad - 6), 8);
    tray.endFill();
    box.addChild(tray);

    const left = -w / 2 + pad;
    const top = -h / 2 + pad;
    // Raised lego dividers between the compartments (so each tool sits in its
    // own recess, like the original).
    const div = new PIXI.Graphics();
    div.beginFill(0x6e727a, 1); // grey dividers
    for (let c = 1; c < cols; c++) {
      const x = left + c * cell + (c - 0.5) * gap;
      div.drawRoundedRect(x - gap / 2, -h / 2 + pad - 6, gap, h - 2 * (pad - 6), 3);
    }
    for (let r = 1; r < rows; r++) {
      const y = top + r * cell + (r - 0.5) * gap;
      div.drawRoundedRect(-w / 2 + pad - 6, y - gap / 2, w - 2 * (pad - 6), gap, 3);
    }
    div.endFill();
    box.addChild(div);

    // 2x4 grid of element stacks, in the source order (constant.h:1049 +
    // tools.cpp:4024): number, text / box, nest / scale, robot / truck, bomb.
    // (The wand, vacuum, pump and notebook are FLOOR items, not toolbox stacks.)
    // Each icon is rendered with renderThingDisplay, so it's the *real* element
    // art (green number plate, pink text plate, lego box, robot…) exactly as it
    // appears once pulled onto the floor.
    const picks = ['number', 'text', 'box', 'nest', 'scale', 'robot', 'truck', 'bomb'];
    picks.forEach((pick, i) => {
      const cx = left + (i % cols) * (cell + gap) + cell / 2;
      const cy = top + Math.floor(i / cols) * (cell + gap) + cell / 2;

      const slot = new PIXI.Graphics();
      slot.beginFill(0x26292e, 1); // recessed dark-grey compartment floor
      slot.drawRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, 5);
      slot.endFill();
      slot.lineStyle(1.5, 0x14161a, 0.5); // inner shadow at the top-left
      slot.moveTo(cx - cell / 2 + 2, cy + cell / 2 - 2);
      slot.lineTo(cx - cell / 2 + 2, cy - cell / 2 + 2);
      slot.lineTo(cx + cell / 2 - 2, cy - cell / 2 + 2);
      box.addChild(slot);

      const sample = this.sampleThing(pick);
      const iconNode = sample
        ? renderThingDisplay(sample, this.tools, this.theme, cell - 14)
        : this.makeIcon(pick, cell - 12);
      iconNode.position.set(cx, cy);
      box.addChild(iconNode);

      const hit = new PIXI.Container();
      hit.position.set(cx, cy);
      hit.hitArea = new PIXI.Rectangle(-cell / 2, -cell / 2, cell, cell);
      hit.eventMode = 'static';
      hit.on('pointerdown', (e) => this.onPick(pick, e.global.x, e.global.y));
      box.addChild(hit);
    });
    return box;
  }

  /** A throwaway sample element for a toolbox slot, rendered with the real art. */
  private sampleThing(pick: string): Thing | null {
    switch (pick) {
      case 'number': return new NumberThing({ value: 1 });
      case 'text': return new TextThing({ value: 'A' });
      case 'box': return new Box({ size: 1 });
      case 'nest': return new Nest();
      case 'scale': return new Scale();
      case 'robot': return new Robot();
      case 'truck': return new Truck();
      case 'bomb': return new Bomb();
      default: return null;
    }
  }

  private makeIcon(key: string | undefined, size: number): PIXI.Container {
    const c = new PIXI.Container();
    const tex = key ? this.tools.get(key) : undefined;
    if (tex && tex !== PIXI.Texture.WHITE) {
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      const m = Math.max(s.width, s.height, 1);
      s.scale.set(size / m);
      c.addChild(s);
    }
    return c;
  }

  destroy(): void {
    this.floor.destroy();
    this.chrome.destroy({ children: true });
    this.cursor.destroy({ children: true });
  }
}
