/**
 * Draws a notebook: the page sprite with the current page's contents rendered on
 * it and a "page n / m" label. Pull a page off (drag) to get a copy; drop a
 * thing on it to file a new page; drop a number to flip to that page.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Notebook } from '../model/notebook';
import { renderThingDisplay } from './display';

export class NotebookView extends ThingView {
  private pageNode: PIXI.Container | null = null;

  /** True if a world-space point falls on the shown page (for grabbing a copy). */
  pressedOnPage(worldX: number, worldY: number): boolean {
    if (!this.pageNode) return false;
    const b = this.pageNode.getBounds();
    return worldX >= b.x && worldX <= b.x + b.width && worldY >= b.y && worldY <= b.y + b.height;
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

    const page = nb.current();
    if (page) {
      const node = renderThingDisplay(page, this.textures, this.theme, sprite.height * 0.5);
      node.position.set(0, -sprite.height * 0.05);
      this.container.addChild(node);
      this.pageNode = node;
    }

    const label = new PIXI.Text(nb.count > 0 ? `page ${nb.index + 1} / ${nb.count}` : 'empty', {
      fontFamily: this.theme.fontFamily,
      fontSize: 12,
      fill: 0x333333,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(0, sprite.height / 2 - 12);
    this.container.addChild(label);

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
