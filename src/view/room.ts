/**
 * The ToonTalk "room" chrome — a reconstruction of the original desktop scene:
 * a tan LEGO-baseplate floor, the open toolbox (top-right) holding the tool
 * icons, an open notebook (bottom), the wand and vacuum tools (left), and the
 * giant hand cursor on a red arm that follows the pointer.
 *
 * This is presentation only: it draws onto the renderer's background (below the
 * interactive things) plus a top cursor layer. It reads textures; it never
 * touches the model.
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

const ARM_COLOR = 0xc65b4e; // sampled from the hand's red sleeve

export class Room {
  private readonly floor: PIXI.TilingSprite;
  private readonly chrome: PIXI.Container;
  private readonly cursor: PIXI.Container;
  private readonly handSprite: PIXI.Sprite;
  private readonly arm: PIXI.Graphics;

  constructor(
    private readonly renderer: Renderer,
    room: Map<string, PIXI.Texture>,
    tools: Map<string, PIXI.Texture>,
    private readonly theme: RenderTheme,
  ) {
    // Floor fills the screen, tiled.
    this.floor = new PIXI.TilingSprite(
      room.get('floor') ?? PIXI.Texture.WHITE,
      renderer.width,
      renderer.height,
    );
    renderer.background.addChild(this.floor);

    // Static chrome (toolbox, notebook, tools) sits above the floor, below things.
    this.chrome = new PIXI.Container();
    renderer.background.addChild(this.chrome);
    this.buildChrome(room, tools);

    // The hand cursor + red arm ride on top of everything.
    this.cursor = new PIXI.Container();
    this.cursor.eventMode = 'none';
    this.arm = new PIXI.Graphics();
    this.handSprite = new PIXI.Sprite(room.get('hand') ?? PIXI.Texture.WHITE);
    this.handSprite.anchor.set(0.42, 0.2); // hotspot near the fingertip
    this.handSprite.scale.set(0.9);
    this.cursor.addChild(this.arm, this.handSprite);
    renderer.app.stage.addChild(this.cursor);
    this.setHand(renderer.width * 0.45, renderer.height * 0.5);
  }

  /** Reposition the floor + chrome when the window resizes. */
  resize(): void {
    this.floor.width = this.renderer.width;
    this.floor.height = this.renderer.height;
    this.chrome.removeChildren().forEach((c) => c.destroy({ children: true }));
    // Rebuild chrome at the new size (cheap; happens rarely).
    // Note: textures are captured in buildChrome's closure via the fields below.
    if (this.rebuild) this.rebuild();
  }

  /** Move the hand so its fingertip points at (x, y); the arm trails to the floor. */
  setHand(x: number, y: number): void {
    this.handSprite.position.set(x, y);
    const h = this.handSprite.height;
    const baseY = y + h * 0.55; // roughly where the wrist meets the sleeve
    const bottom = this.renderer.height + 40;
    const halfW = Math.max(22, h * 0.16);
    this.arm.clear();
    this.arm.beginFill(ARM_COLOR, 1);
    // A simple tapered sleeve from the wrist down off-screen.
    this.arm.drawPolygon([
      x - halfW, baseY,
      x + halfW, baseY,
      x + halfW * 1.3, bottom,
      x - halfW * 1.3, bottom,
    ]);
    this.arm.endFill();
  }

  private rebuild: (() => void) | null = null;

  private buildChrome(room: Map<string, PIXI.Texture>, tools: Map<string, PIXI.Texture>): void {
    this.rebuild = () => this.layoutChrome(room, tools);
    this.layoutChrome(room, tools);
  }

  private layoutChrome(room: Map<string, PIXI.Texture>, tools: Map<string, PIXI.Texture>): void {
    const W = this.renderer.width;
    const H = this.renderer.height;

    // --- Open toolbox, top-right: a tray with a 2x4 grid of tool icons. ---
    const toolbox = this.makeToolbox(tools);
    toolbox.position.set(W - toolbox.width / 2 - 40, toolbox.height / 2 + 30);
    this.chrome.addChild(toolbox);

    // --- Open notebook, bottom-centre. ---
    const nb = this.makeNotebook(room.get('notebook'));
    nb.position.set(W * 0.5, H - nb.height / 2 - 16);
    this.chrome.addChild(nb);

    // --- Wand (with mode 'C') and vacuum (with 'S') resting on the left. ---
    const wand = this.makeTool(tools.get('wand') ?? room.get('wandbar'), 'C', 0x223040, 2.2);
    wand.position.set(150, H * 0.5);
    this.chrome.addChild(wand);

    const vac = this.makeTool(tools.get('dusty'), 'S', 0x223040, 1.0);
    vac.position.set(120, H * 0.5 + 120);
    this.chrome.addChild(vac);
  }

  private makeToolbox(tools: Map<string, PIXI.Texture>): PIXI.Container {
    const box = new PIXI.Container();
    const cols = 2;
    const rows = 4;
    const cell = 60;
    const gap = 8;
    const padding = 14;
    const w = cols * cell + (cols - 1) * gap + padding * 2;
    const h = rows * cell + (rows - 1) * gap + padding * 2;

    const tray = new PIXI.Graphics();
    tray.beginFill(0x000000, 0.25);
    tray.drawRoundedRect(-w / 2 + 5, -h / 2 + 6, w, h, 12);
    tray.endFill();
    tray.lineStyle(3, 0x3a4350, 1);
    tray.beginFill(0x515b68, 1);
    tray.drawRoundedRect(-w / 2, -h / 2, w, h, 12);
    tray.endFill();
    box.addChild(tray);

    // Tool layout matching the video (row-major, 2 columns).
    const grid: Array<{ key?: string; label?: string; fill?: number }> = [
      { label: '1', fill: 0xbff2c9 }, { label: 'A', fill: 0xf2ddc2 },
      { key: 'box' }, { key: 'nest' },
      { key: 'scale' }, { key: 'robot' },
      { key: 'truck' }, { key: 'bomb' },
    ];
    const left = -w / 2 + padding;
    const top = -h / 2 + padding;
    grid.forEach((item, i) => {
      const cx = left + (i % cols) * (cell + gap) + cell / 2;
      const cy = top + Math.floor(i / cols) * (cell + gap) + cell / 2;
      const slot = new PIXI.Graphics();
      slot.lineStyle(1, 0x2c333d, 1);
      slot.beginFill(0x3c4450, 1);
      slot.drawRoundedRect(cx - cell / 2, cy - cell / 2, cell, cell, 6);
      slot.endFill();
      box.addChild(slot);

      if (item.label) {
        box.addChild(this.makeLabelPad(item.label, item.fill ?? 0xffffff, cx, cy));
      } else if (item.key) {
        const tex = tools.get(item.key);
        if (tex && tex !== PIXI.Texture.WHITE) {
          const s = new PIXI.Sprite(tex);
          s.anchor.set(0.5);
          const m = Math.max(s.width, s.height, 1);
          s.scale.set((cell - 12) / m);
          s.position.set(cx, cy);
          box.addChild(s);
        }
      }
    });
    return box;
  }

  private makeLabelPad(label: string, fill: number, cx: number, cy: number): PIXI.Container {
    const c = new PIXI.Container();
    const pad = new PIXI.Graphics();
    pad.lineStyle(2, 0x4e9e63, 1);
    pad.beginFill(fill, 1);
    pad.drawRoundedRect(-18, -22, 36, 44, 3);
    pad.endFill();
    const t = new PIXI.Text(label, {
      fontFamily: this.theme.fontFamily,
      fontSize: 24,
      fill: 0x102030,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    c.addChild(pad, t);
    c.position.set(cx, cy);
    return c;
  }

  private makeNotebook(tex: PIXI.Texture | undefined): PIXI.Container {
    const c = new PIXI.Container();
    const s = new PIXI.Sprite(tex ?? PIXI.Texture.WHITE);
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

  private makeTool(
    tex: PIXI.Texture | undefined,
    mode: string,
    badgeColor: number,
    scale: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const s = new PIXI.Sprite(tex ?? PIXI.Texture.WHITE);
    s.anchor.set(0.5);
    s.scale.set(scale);
    c.addChild(s);

    const badge = new PIXI.Graphics();
    badge.beginFill(badgeColor, 0.9);
    badge.drawRoundedRect(-s.width / 2 - 6, -14, 26, 28, 5);
    badge.endFill();
    const t = new PIXI.Text(mode, {
      fontFamily: this.theme.fontFamily,
      fontSize: 18,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    t.position.set(-s.width / 2 + 7, 0);
    c.addChild(badge, t);
    return c;
  }

  destroy(): void {
    this.floor.destroy();
    this.chrome.destroy({ children: true });
    this.cursor.destroy({ children: true });
  }
}
