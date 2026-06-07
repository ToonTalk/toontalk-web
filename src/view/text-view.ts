/**
 * Draws a text pad: the string value on a light pad.
 */
import { ThingView } from './thing-view';
import { TextThing } from '../model/text';
import { drawPad } from './pad';

export class TextView extends ThingView {
  protected build(): void {
    const t = this.thing as TextThing;
    const label = t.value.length > 0 ? t.value : ' ';
    // Authentic ToonTalk text-pad palette (tan), sampled from TEXTPLT1.BMP.
    const pad = drawPad(label, 0xf2ddc2, this.theme, { borderColor: 0xb8966e });
    this.container.addChild(pad.node);
  }
}
