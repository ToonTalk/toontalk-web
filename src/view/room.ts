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

const ROOM_KEYS = ['floor', 'toolbox', 'notebook', 'hand', 'wandbar', 'truck'] as const;

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
  return map;
}

/** Called when a toolbox/tool icon is clicked; spawns that element in the world. */
export type PickHandler = (key: string) => void;

const ARM_COLOR = 0xcb6b5e; // sampled from the hand's coral sleeve

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
    this.handSprite = new PIXI.Sprite(room.get('hand') ?? PIXI.Texture.WHITE);
    this.handSprite.anchor.set(0.5, 0.16); // hotspot near the fingertip
    this.handSprite.scale.set(1.15);
    this.cursor.addChild(this.arm, this.handSprite);
    renderer.app.stage.addChild(this.cursor);
    this.setHand(renderer.width * 0.45, renderer.height * 0.45);
  }

  resize(): void {
    this.floor.width = this.renderer.width;
    this.floor.height = this.renderer.height;
    this.chrome.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.layoutChrome();
  }

  /** Move the hand so its fingertip points at (x, y); a coral arm trails down. */
  setHand(x: number, y: number): void {
    this.handSprite.position.set(x, y);
    const w = this.handSprite.width;
    const h = this.handSprite.height;
    const wristY = y + h * 0.42; // where the hand meets the sleeve
    const bottom = this.renderer.height + 40;
    const armW = w * 0.34;
    this.arm.clear();
    this.arm.beginFill(ARM_COLOR, 1);
    // A rounded, near-constant-width sleeve down to off-screen.
    this.arm.drawRoundedRect(x - armW / 2, wristY, armW, bottom - wristY, armW * 0.5);
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

    const wand = this.makeTool('wandbar', 'wand', 'C', 2.0);
    wand.position.set(150, H * 0.5);
    this.chrome.addChild(wand);

    const vac = this.makeTool('dusty', 'dusty', 'S', 1.0);
    vac.position.set(120, H * 0.5 + 130);
    this.chrome.addChild(vac);
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
    const grid: Array<{ pick?: string; label?: string; fill?: number; icon?: string }> = [
      { label: '1', fill: 0xbff2c9, pick: 'number' }, { label: 'A', fill: 0xf2ddc2, pick: 'text' },
      { icon: 'box', pick: 'box' }, { icon: 'nest', pick: 'nest' },
      { icon: 'scale', pick: 'scale' }, { icon: 'robot', pick: 'robot' },
      { icon: 'truck' }, { icon: 'bomb', pick: 'bomb' },
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
        hit.on('pointertap', () => this.onPick(key));
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

  private makeTool(texKey: string, pick: string, mode: string, scale: number): PIXI.Container {
    const c = new PIXI.Container();
    const s = new PIXI.Sprite(this.tools.get(texKey) ?? this.room.get(texKey) ?? PIXI.Texture.WHITE);
    s.anchor.set(0.5);
    s.scale.set(scale);
    c.addChild(s);

    const badge = new PIXI.Graphics();
    badge.beginFill(0x223040, 0.92);
    badge.drawRoundedRect(-s.width / 2 - 4, -14, 26, 28, 5);
    badge.endFill();
    const t = new PIXI.Text(mode, {
      fontFamily: this.theme.fontFamily,
      fontSize: 18,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    t.position.set(-s.width / 2 + 9, 0);
    c.addChild(badge, t);

    c.hitArea = new PIXI.Rectangle(-s.width / 2, -s.height / 2, s.width, s.height);
    c.eventMode = 'static';
    c.on('pointertap', () => this.onPick(pick));
    return c;
  }

  destroy(): void {
    this.floor.destroy();
    this.chrome.destroy({ children: true });
    this.cursor.destroy({ children: true });
  }
}
