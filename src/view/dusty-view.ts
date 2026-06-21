/**
 * Draws Dusty the vacuum with a small badge for its current mode (E erase ·
 * S suck · R reverse) and, when it has sucked things, a count of its stomach.
 * Hover/hold Dusty and press E/S/R (or space to cycle) to change the mode.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Dusty, type VacuumMode } from '../model/dusty';
import { addModeButton, toolTipOffset, CLAY_TIP_FRAC } from './lego-button';
import { makeIdleSprite } from './animation';

const MODE_LABEL: Record<VacuumMode, string> = { erase: 'E', suck: 'S', reverse: 'R' };

export class DustyView extends ThingView {
  private heldTip: { x: number; y: number } | null = null;

  protected build(): void {
    const dusty = this.thing as Dusty;
    const tex = this.textures.get('dusty') ?? PIXI.Texture.WHITE;

    // Held → the clay (alive) Dusty; at rest → the Lego brick (tools morph in
    // the hand). The clay is scaled to the Lego footprint.
    const clay = this.alive ? makeIdleSprite('dusty-suck') : null;
    let bodyW: number;
    let bodyH: number;
    this.heldTip = null;
    if (clay) {
      const legoMax = Math.max(tex.width, tex.height);
      const clayMax = Math.max(clay.width, clay.height);
      // Held → the clay is drawn at roughly the SAME size as the Lego brick (its
      // at-rest footprint), so it doesn't balloon in the hand.
      if (clayMax > 0) clay.scale.set(legoMax / clayMax);
      this.container.addChild(clay);
      bodyW = clay.width;
      bodyH = clay.height;
      // Active point = the tip of Dusty's nose on the clay (offset from the
      // container origin = the clay's anchor) so it lands on the cursor when held.
      const [fx, fy] = CLAY_TIP_FRAC.dusty!;
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

    // Mode plate (1×1 Lego button) shown only at REST (on the Lego brick). While
    // held, the clay tool should read cleanly — no button, and no stomach count.
    if (!this.alive) {
      addModeButton(this.container, MODE_LABEL[dusty.mode], this.theme, 'dusty', bodyW, bodyH, this.textures);
    }
  }

  /** Held cursor hot point = the tip of Dusty's nose, so its nose is what
   * sucks/erases (from the clay it morphs into when held). */
  activeOffset(): { x: number; y: number } {
    return this.heldTip ?? toolTipOffset(this.textures, 'dusty');
  }
}
