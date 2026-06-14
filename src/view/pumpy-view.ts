/**
 * Draws Pumpy the resize tool with a badge for its current mode. Hold Pumpy on
 * the cursor, move its hose tip over a thing, then click/space to apply the
 * current default. Mode keys: + bigger · - smaller · w wider · n narrower ·
 * t taller · s shorter · g good (revert); Tab cycles.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Pumpy, type PumpyMode } from '../model/pumpy';

const MODE_LABEL: Record<PumpyMode, string> = {
  bigger: '+',
  smaller: '−',
  wider: '↔',
  narrower: '><',
  taller: '↕',
  shorter: '=',
  good: '○',
};

export class PumpyView extends ThingView {
  protected build(): void {
    const pumpy = this.thing as Pumpy;
    const tex = this.textures.get('pumpy') ?? PIXI.Texture.WHITE;

    // pumpy.png is the baked PUMP00 art (208x174) — shown at native tool size,
    // like Dusty and the wand.
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

    const badge = new PIXI.Graphics();
    badge.beginFill(0x223040, 0.92);
    badge.drawRoundedRect(-15, sprite.height / 2 - 4, 30, 22, 5);
    badge.endFill();
    const label = new PIXI.Text(MODE_LABEL[pumpy.mode], {
      fontFamily: this.theme.fontFamily,
      fontSize: 14,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(0, sprite.height / 2 + 7);
    this.container.addChild(badge, label);
  }
}
