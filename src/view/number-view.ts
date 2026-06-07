/**
 * Draws a number pad: the exact value plus a small badge showing the operation
 * that will be applied when this number is dropped onto another.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { NumberThing } from '../model/number';
import { drawPad } from './pad';

const OP_GLYPH: Record<string, string> = {
  '+': '+', '*': '×', '/': '÷', '%': '%', '^': '^', '=': '=',
};

export class NumberView extends ThingView {
  protected build(): void {
    const n = this.thing as NumberThing;
    // Authentic ToonTalk number-pad palette (green), sampled from NUMBPLAT.BMP.
    const pad = drawPad(n.value.toString(), 0xbff2c9, this.theme, { borderColor: 0x4e9e63 });
    this.container.addChild(pad.node);

    // Operation badge (top-left), only meaningful for non-default ops shown subtly.
    const badge = new PIXI.Text(OP_GLYPH[n.operation] ?? '+', {
      fontFamily: this.theme.fontFamily,
      fontSize: 14,
      fill: 0x884400,
      fontWeight: 'bold',
    });
    badge.anchor.set(0.5);
    badge.position.set(-pad.width / 2 + 8, -pad.height / 2 + 8);
    this.container.addChild(badge);
  }
}
