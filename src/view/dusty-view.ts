/**
 * Draws Dusty the vacuum with a small badge for its current mode (E erase ·
 * S suck · R reverse) and, when it has sucked things, a count of its stomach.
 * Hover/hold Dusty and press E/S/R (or space to cycle) to change the mode.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Dusty, type VacuumMode } from '../model/dusty';

const MODE_LABEL: Record<VacuumMode, string> = { erase: 'E', suck: 'S', reverse: 'R' };

export class DustyView extends ThingView {
  protected build(): void {
    const dusty = this.thing as Dusty;
    const tex = this.textures.get('dusty') ?? PIXI.Texture.WHITE;

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

    // Mode badge near the nozzle.
    const badge = new PIXI.Graphics();
    badge.beginFill(0x223040, 0.92);
    badge.drawRoundedRect(-13, sprite.height / 2 - 4, 26, 22, 5);
    badge.endFill();
    const label = new PIXI.Text(MODE_LABEL[dusty.mode], {
      fontFamily: this.theme.fontFamily,
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(0, sprite.height / 2 + 7);
    this.container.addChild(badge, label);

    if (dusty.stomach.length > 0) {
      const count = new PIXI.Text(`×${dusty.stomach.length}`, {
        fontFamily: this.theme.fontFamily,
        fontSize: 12,
        fill: 0x884400,
        fontWeight: 'bold',
      });
      count.anchor.set(0.5);
      count.position.set(sprite.width / 2 - 4, -sprite.height / 2 + 6);
      this.container.addChild(count);
    }
  }
}
