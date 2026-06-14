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

const ROOM_KEYS = ['floor', 'toolbox', 'notebook', 'hand', 'hand-grab', 'hand-wand', 'truck'] as const;

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
  // Default: point with the leftmost finger — hotspot at that fingertip (0.24w,
  // 0.17h). The wrist stub is at ~0.68w, so the sleeve sits 0.44w right of it.
  open: { key: 'hand', anchor: [0.24, 0.17], scale: 1.15, cx: 0.44, w: 0.32, top: 0.74 },
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
    const H = this.renderer.height;

    const toolbox = this.makeToolbox();
    toolbox.position.set(W - 170, 180);
    this.chrome.addChild(toolbox);

    const nb = this.makeNotebook();
    nb.position.set(W * 0.5, H - nb.height / 2 - 14);
    this.chrome.addChild(nb);
    // The wand and the vacuum are NOT chrome — they're the real hand tools that
    // lie out on the floor (seeded in the World, bottom-left), so we don't draw
    // duplicates here.
  }

  /** A studded grey lego panel (used for the toolbox lid). */
  private studdedPanel(w: number, h: number): PIXI.Container {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.lineStyle(2, 0x4a505a, 1);
    g.beginFill(0x6b7280, 1);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.endFill();
    const step = 18;
    g.lineStyle(0);
    for (let sx = -w / 2 + step; sx < w / 2 - 4; sx += step) {
      for (let sy = -h / 2 + step; sy < h / 2 - 4; sy += step) {
        g.beginFill(0x7c838d, 1);
        g.drawCircle(sx, sy, 4);
        g.endFill();
        g.beginFill(0x595f68, 0.6);
        g.drawCircle(sx + 1, sy + 2, 4);
        g.endFill();
      }
    }
    c.addChild(g);
    return c;
  }

  private makeToolbox(): PIXI.Container {
    const box = new PIXI.Container();
    const cols = 2;
    const rows = 4;
    const cell = 56;
    const gap = 7;
    const pad = 14;
    const w = cols * cell + (cols - 1) * gap + pad * 2;
    const h = rows * cell + (rows - 1) * gap + pad * 2;

    // Open lid: a studded panel hinged up to the right and behind the tray.
    const lid = this.studdedPanel(h * 0.95, h * 0.95);
    lid.position.set(w / 2 + h * 0.34, -h * 0.16);
    lid.rotation = 0.5;
    lid.scale.set(0.92, 0.78); // slight foreshortening
    box.addChild(lid);

    // Charcoal lego tray with a bevelled rim.
    const tray = new PIXI.Graphics();
    tray.beginFill(0x20242a, 0.35);
    tray.drawRoundedRect(-w / 2 + 6, -h / 2 + 8, w, h, 10);
    tray.endFill();
    tray.lineStyle(0);
    tray.beginFill(0x2b3037, 1); // outer rim
    tray.drawRoundedRect(-w / 2, -h / 2, w, h, 10);
    tray.endFill();
    tray.beginFill(0x474e57, 1); // inner face (lighter)
    tray.drawRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 8);
    tray.endFill();
    box.addChild(tray);

    // 2x4 grid of recessed slots holding the tools.
    // Matches the original toolbox grid (ToonTalk - claude 1): number, text,
    // box, wand, scale, bird, truck, bomb.
    const grid: Array<{ pick?: string; label?: string; fill?: number; icon?: string }> = [
      { label: '1', fill: 0xbff2c9, pick: 'number' }, { label: 'A', fill: 0xf2ddc2, pick: 'text' },
      { icon: 'box', pick: 'box' }, { icon: 'wand', pick: 'wand' },
      { icon: 'scale', pick: 'scale' }, { icon: 'bird', pick: 'bird' },
      { icon: 'truck', pick: 'truck' }, { icon: 'bomb', pick: 'bomb' },
    ];
    const left = -w / 2 + pad;
    const top = -h / 2 + pad;
    grid.forEach((item, i) => {
      const cx = left + (i % cols) * (cell + gap) + cell / 2;
      const cy = top + Math.floor(i / cols) * (cell + gap) + cell / 2;

      const slot = new PIXI.Graphics();
      slot.beginFill(0x20242a, 1); // recessed dark
      slot.drawRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, 5);
      slot.endFill();
      slot.lineStyle(1, 0x565e69, 0.8); // top-left highlight rim
      slot.moveTo(cx - cell / 2 + 2, cy + cell / 2 - 2);
      slot.lineTo(cx - cell / 2 + 2, cy - cell / 2 + 2);
      slot.lineTo(cx + cell / 2 - 2, cy - cell / 2 + 2);
      box.addChild(slot);

      const iconNode = item.label
        ? this.makeLabelPad(item.label, item.fill ?? 0xffffff)
        : this.makeIcon(item.icon, cell - 12);
      iconNode.position.set(cx, cy);
      box.addChild(iconNode);

      if (item.pick) {
        const hit = new PIXI.Container();
        hit.position.set(cx, cy);
        hit.hitArea = new PIXI.Rectangle(-cell / 2, -cell / 2, cell, cell);
        hit.eventMode = 'static';
        const key = item.pick;
        hit.on('pointerdown', (e) => this.onPick(key, e.global.x, e.global.y));
        box.addChild(hit);
      }
    });
    return box;
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

  private makeLabelPad(label: string, fill: number): PIXI.Container {
    const c = new PIXI.Container();
    const pad = new PIXI.Graphics();
    pad.lineStyle(2, 0x4e9e63, 1);
    pad.beginFill(fill, 1);
    pad.drawRoundedRect(-17, -21, 34, 42, 3);
    pad.endFill();
    const t = new PIXI.Text(label, {
      fontFamily: this.theme.fontFamily,
      fontSize: 24,
      fill: 0x102030,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    c.addChild(pad, t);
    return c;
  }

  private makeNotebook(): PIXI.Container {
    const c = new PIXI.Container();
    const s = new PIXI.Sprite(this.room.get('notebook') ?? PIXI.Texture.WHITE);
    s.anchor.set(0.5);
    s.scale.set(1.5);
    c.addChild(s);
    const title = new PIXI.Text('claude 1', {
      fontFamily: this.theme.fontFamily,
      fontSize: 18,
      fill: 0x222222,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5);
    title.position.set(0, s.height / 2 - 18);
    c.addChild(title);
    return c;
  }

  destroy(): void {
    this.floor.destroy();
    this.chrome.destroy({ children: true });
    this.cursor.destroy({ children: true });
  }
}
