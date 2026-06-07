/**
 * Draws a box as a row of holes. Empty holes are outlined cells; filled holes
 * show their contents rendered as their real selves. Exposes holeIndexAt() so
 * the drag controller can tell which hole the cursor is over on drop.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Box } from '../model/box';
import { renderThingDisplay } from './display';

const CELL = 64;
const GAP = 8;

export class BoxView extends ThingView {
  protected build(): void {
    const box = this.thing as Box;
    const n = box.size;
    const totalW = n * CELL + (n - 1) * GAP;
    const left = -totalW / 2;

    const r = this.theme.cornerRadius;
    const bw = this.theme.borderWidth;

    const frame = new PIXI.Graphics();
    if (this.theme.dropShadow) {
      frame.beginFill(0x000000, 0.2);
      frame.drawRoundedRect(left - 6 + 3, -CELL / 2 - 6 + 4, totalW + 12, CELL + 12, r);
      frame.endFill();
    }
    // Authentic ToonTalk box (cubby) palette: blue lego, sampled from CUBBY1.BMP.
    frame.lineStyle(bw + 1, 0x2e6e8e, 1);
    frame.beginFill(0x5aa6c8, 1);
    frame.drawRoundedRect(left - 6, -CELL / 2 - 6, totalW + 12, CELL + 12, r);
    frame.endFill();
    this.container.addChild(frame);

    for (let i = 0; i < n; i++) {
      const cx = left + i * (CELL + GAP) + CELL / 2;
      const cell = new PIXI.Graphics();
      cell.lineStyle(bw, 0x2e6e8e, 1);
      cell.beginFill(0xcdeaf5, 1);
      cell.drawRoundedRect(cx - CELL / 2, -CELL / 2, CELL, CELL, r);
      cell.endFill();
      this.container.addChild(cell);

      const occupant = box.contentsAt(i);
      if (occupant) {
        const node = renderThingDisplay(occupant, this.textures, this.theme, CELL - 12);
        node.position.set(cx, 0);
        this.container.addChild(node);
      }
    }
  }

  /** Index of the hole under a world-space point, or null if none. */
  holeIndexAt(worldX: number, worldY: number): number | null {
    const box = this.thing as Box;
    const n = box.size;
    const totalW = n * CELL + (n - 1) * GAP;
    const left = -totalW / 2;
    const localX = worldX - this.container.position.x;
    const localY = worldY - this.container.position.y;
    if (localY < -CELL / 2 || localY > CELL / 2) return null;
    for (let i = 0; i < n; i++) {
      const cellLeft = left + i * (CELL + GAP);
      if (localX >= cellLeft && localX <= cellLeft + CELL) return i;
    }
    return null;
  }
}
