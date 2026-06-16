/**
 * Draws a notebook: the page sprite with the current page's contents rendered on
 * it and a "page n / m" label. Pull a page off (drag) to get a copy; drop a
 * thing on it to file a new page; drop a number to flip to that page.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Notebook } from '../model/notebook';
import { renderThingDisplay } from './display';
import { floorCamera } from './floor-camera';

export class NotebookView extends ThingView {
  private pageNode: PIXI.Container | null = null;

  /** True if a world-space point falls on the shown page (for grabbing a copy). */
  pressedOnPage(worldX: number, worldY: number): boolean {
    if (!this.pageNode) return false;
    const b = this.pageNode.getBounds(); // screen; shift into world (floor camera)
    return (
      worldX >= b.x + floorCamera.x &&
      worldX <= b.x + b.width + floorCamera.x &&
      worldY >= b.y + floorCamera.y &&
      worldY <= b.y + b.height + floorCamera.y
    );
  }

  protected build(): void {
    this.pageNode = null;
    const nb = this.thing as Notebook;
    const tex = this.textures.get('notebook') ?? PIXI.Texture.WHITE;

    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(tex);
      shadow.anchor.set(0.5);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    this.container.addChild(sprite);

    const w = sprite.width;
    const h = sprite.height;
    // The notebook is an OPEN two-page spread (spiral down the middle): the
    // current page sits on the LEFT leaf, the next page previews on the RIGHT,
    // as in the original. Each page is a pink-bordered CARD (the original's look),
    // its contents sitting inside, clear of the central binding.
    const cy = -h * 0.04;
    const cardW = w * 0.33;
    const cardH = h * 0.58;
    const drawCard = (cx: number): void => {
      const card = new PIXI.Graphics();
      card.beginFill(0xfdeef6, 1); // near-white pink card
      card.lineStyle(3, 0xe23a93, 1); // hot-pink border, like the original
      card.drawRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 6);
      card.endFill();
      this.container.addChild(card);
    };
    const page = nb.current();
    if (page) {
      drawCard(-w * 0.24);
      const node = renderThingDisplay(page, this.textures, this.theme, h * 0.46);
      node.position.set(-w * 0.24, cy);
      this.container.addChild(node);
      this.pageNode = node;
    }
    const next = nb.pages[nb.index + 1] ?? null;
    if (next) {
      drawCard(w * 0.24);
      const rnode = renderThingDisplay(next, this.textures, this.theme, h * 0.46);
      rnode.position.set(w * 0.24, cy);
      this.container.addChild(rnode);
    }

    // A page number on each leaf (left = current, right = next), like the
    // original's "1 … 2" along the bottom.
    const pageNum = (n: number, x: number): void => {
      const t = new PIXI.Text(String(n), {
        fontFamily: this.theme.fontFamily,
        fontSize: 12,
        fill: 0x555555,
        fontWeight: 'bold',
      });
      t.anchor.set(0.5);
      t.position.set(x, h / 2 - 12);
      this.container.addChild(t);
    };
    if (nb.count > 0) pageNum(nb.index + 1, -w * 0.3);
    if (next) pageNum(nb.index + 2, w * 0.3);

    // The notebook's name along the bottom centre (the original's "claude 1"),
    // on a small pill so it reads over the spiral binding.
    if (nb.name) {
      const nameT = new PIXI.Text(nb.name, {
        fontFamily: this.theme.fontFamily,
        fontSize: 13,
        fill: 0x333333,
        fontWeight: 'bold',
      });
      nameT.anchor.set(0.5);
      nameT.position.set(0, h / 2 - 11);
      const pill = new PIXI.Graphics();
      pill.beginFill(0xfdeef6, 0.92);
      pill.lineStyle(1.5, 0xe23a93, 1);
      pill.drawRoundedRect(-nameT.width / 2 - 6, h / 2 - 11 - nameT.height / 2 - 1, nameT.width + 12, nameT.height + 2, 4);
      pill.endFill();
      this.container.addChild(pill, nameT);
    }

    // Page-turn cues (← / →); turn pages with the arrow keys while pointing at
    // the notebook (drop a number/text to jump). Dim at the ends.
    const hw = sprite.width / 2;
    const arrows = new PIXI.Graphics();
    const tri = (x: number, dir: 1 | -1, on: boolean) => {
      arrows.beginFill(0x333333, on ? 0.85 : 0.2);
      arrows.moveTo(x, -6);
      arrows.lineTo(x - 7 * dir, 0);
      arrows.lineTo(x, 6);
      arrows.closePath();
      arrows.endFill();
    };
    tri(-hw + 12, -1, nb.index > 0);
    tri(hw - 12, 1, nb.index < nb.count - 1);
    arrows.position.set(0, sprite.height / 2 - 12);
    this.container.addChild(arrows);

    // The main (toolbox) notebook — the one that persists — gets a star.
    if (nb.isMain) {
      const star = new PIXI.Text('★', {
        fontFamily: this.theme.fontFamily,
        fontSize: 16,
        fill: 0xe8b800,
      });
      star.anchor.set(0.5);
      star.position.set(0, -sprite.height / 2 + 12);
      this.container.addChild(star);
    }
  }
}
