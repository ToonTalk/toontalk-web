/**
 * Draws a text pad: the string value on the authentic pink lego plate
 * (TEXTPLT1, nine-sliced), falling back to a drawn pad if the bitmap is missing.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { TextThing } from '../model/text';
import { isSensor, SENSORS, type Sensor } from '../model/sensor';
import { drawPad } from './pad';
import { drawPlate } from './plate';
import { addSensorTag } from './sensor-tag';

const TEXTPLAT_INSETS = { left: 28, top: 26, right: 30, bottom: 28 };

export class TextView extends ThingView {
  protected build(): void {
    const t = this.thing as TextThing;
    // Erased (Dusty) → a BLANK plate: "any text" for a robot.
    const label = t.erased || t.value.length === 0 ? ' ' : t.value;

    let width: number;
    let height: number;
    const tex = this.textures.get('textplat');
    if (tex && tex !== PIXI.Texture.WHITE) {
      const plate = drawPlate(label, tex, TEXTPLAT_INSETS, this.theme, { minWidth: 52 });
      this.container.addChild(plate.node);
      width = plate.width;
      height = plate.height;
    } else {
      const pad = drawPad(label, 0xf2ddc2, this.theme, { borderColor: 0xb8966e });
      this.container.addChild(pad.node);
      width = pad.width;
      height = pad.height;
    }

    if (isSensor(t)) {
      addSensorTag(this.container, SENSORS[(t as Sensor).sensorType].label, width, height, this.theme);
    }
  }
}
