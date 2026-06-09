/**
 * Draws a number pad: the exact value on the authentic green lego plate
 * (NUMBPLAT, nine-sliced), plus a small badge showing the operation that will
 * be applied when this number is dropped onto another. Falls back to a drawn
 * pad if the plate bitmap isn't available.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { NumberThing } from '../model/number';
import { isSensor, SENSORS, type Sensor } from '../model/sensor';
import { drawPad } from './pad';
import { drawPlate } from './plate';
import { addSensorTag } from './sensor-tag';

const OP_GLYPH: Record<string, string> = {
  '+': '+', '*': '×', '/': '÷', '%': '%', '^': '^', '=': '=',
};

const NUMPLAT_INSETS = { left: 28, top: 24, right: 30, bottom: 26 };

export class NumberView extends ThingView {
  protected build(): void {
    const n = this.thing as NumberThing;
    const label = n.value.toString();

    let width: number;
    let height: number;
    const tex = this.textures.get('numplat');
    if (tex && tex !== PIXI.Texture.WHITE) {
      const plate = drawPlate(label, tex, NUMPLAT_INSETS, this.theme, { minWidth: 52 });
      this.container.addChild(plate.node);
      width = plate.width;
      height = plate.height;
    } else {
      const pad = drawPad(label, 0xbff2c9, this.theme, { borderColor: 0x4e9e63 });
      this.container.addChild(pad.node);
      width = pad.width;
      height = pad.height;
    }

    // Operation badge (top-left).
    const badge = new PIXI.Text(OP_GLYPH[n.operation] ?? '+', {
      fontFamily: this.theme.fontFamily,
      fontSize: 14,
      fill: 0x884400,
      fontWeight: 'bold',
    });
    badge.anchor.set(0.5);
    badge.position.set(-width / 2 + 12, -height / 2 + 12);
    this.container.addChild(badge);

    // Live-sensor tag (antenna + label) so it reads as a sensor, not a plain number.
    if (isSensor(n)) {
      addSensorTag(this.container, SENSORS[(n as Sensor).sensorType].label, width, height, this.theme);
    }
  }
}
