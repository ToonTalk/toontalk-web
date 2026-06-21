/**
 * Draws Pumpy the resize tool with a badge for its current mode. Hold Pumpy on
 * the cursor, move its hose tip over a thing, then click/space to apply the
 * current default. Mode keys: + bigger · - smaller · w wider · n narrower ·
 * t taller · s shorter · g good (revert); Tab cycles.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Pumpy, type PumpyMode } from '../model/pumpy';
import { addModeButton, toolTipOffset, CLAY_TIP_FRAC } from './lego-button';
import { makeIdleSprite } from './animation';

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
  private heldTip: { x: number; y: number } | null = null;

  protected build(): void {
    const pumpy = this.thing as Pumpy;
    const tex = this.textures.get('pumpy') ?? PIXI.Texture.WHITE; // the Lego pump

    // Held → the clay (alive) Pumpy bobbing; at rest → the Lego pump (tools
    // morph in the hand). The clay is scaled to the Lego footprint.
    const clay = this.alive ? makeIdleSprite('pumpy-pump') : null;
    let bodyW: number;
    let bodyH: number;
    this.heldTip = null;
    if (clay) {
      const legoMax = Math.max(tex.width, tex.height);
      const clayMax = Math.max(clay.width, clay.height);
      // Held → bigger than the Lego footprint so the tool reads as the focus
      // (the hand grips its side, like the original); at rest it's the Lego pump.
      if (clayMax > 0) clay.scale.set((2.4 * legoMax) / clayMax);
      this.container.addChild(clay);
      bodyW = clay.width;
      bodyH = clay.height;
      // Active point = the hose nozzle on the clay, offset from the container
      // origin (the clay's anchor point) so it lands on the cursor when held.
      const [fx, fy] = CLAY_TIP_FRAC.pumpy!;
      this.heldTip = { x: (fx - clay.anchor.x) * clay.width, y: (fy - clay.anchor.y) * clay.height };
    } else {
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
      bodyW = sprite.width;
      bodyH = sprite.height;
    }

    // Mode shown as a 1×1 Lego plate a little below centre on Pumpy.
    addModeButton(this.container, MODE_LABEL[pumpy.mode], this.theme, 'pumpy', bodyW, bodyH, this.textures);
  }

  activeOffset(): { x: number; y: number } {
    return this.heldTip ?? toolTipOffset(this.textures, 'pumpy');
  }
}
