/**
 * Draws a nest sprite and, when a bird has delivered something, shows the most
 * recent delivery rendered as its real self (a box looks like a box) above the
 * nest, plus a count if more than one thing has been delivered.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Nest } from '../model/nest';
import { renderThingDisplay } from './display';

export class NestView extends ThingView {
  private itemNode: PIXI.Container | null = null;

  /** True if a world-space point falls on the delivered item (for grabbing it). */
  pressedOnItem(worldX: number, worldY: number): boolean {
    if (!this.itemNode) return false;
    const b = this.itemNode.getBounds();
    return worldX >= b.x && worldX <= b.x + b.width && worldY >= b.y && worldY <= b.y + b.height;
  }

  protected build(): void {
    this.itemNode = null;
    const nest = this.thing as Nest;
    const tex = this.textures.get('nest') ?? PIXI.Texture.WHITE;

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

    const latest = nest.latest();
    if (latest) {
      // The delivered thing sits ON the nest, covering the egg, and is grabbable.
      const node = renderThingDisplay(latest, this.textures, this.theme, sprite.height * 0.7);
      node.position.set(0, -sprite.height * 0.06);
      this.container.addChild(node);
      this.itemNode = node;

      if (nest.contents.length > 1) {
        const b = node.getBounds();
        const badge = new PIXI.Text(`×${nest.contents.length}`, {
          fontFamily: 'Tahoma, system-ui, sans-serif',
          fontSize: 13,
          fill: 0x884400,
          fontWeight: 'bold',
        });
        badge.anchor.set(0.5);
        badge.position.set(node.x + b.width / 2 + 6, node.y - b.height / 2);
        this.container.addChild(badge);
      }
    }
  }
}
