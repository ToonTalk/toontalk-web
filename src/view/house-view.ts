/**
 * Draws a house — a running process built by a truck. We postpone the city, so
 * the house is shown in place: a simple lego house with the box it's working on
 * inside and the team's lead robot peeking out the top. A periodic step in
 * main.ts runs the team on the box, and the box re-renders here on each run.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { House } from '../model/house';
import { renderThingDisplay } from './display';

export class HouseView extends ThingView {
  protected build(): void {
    const house = this.thing as House;
    const W = 150;
    const wallH = 92;
    const roofH = 42;

    if (this.theme.dropShadow) {
      const sh = new PIXI.Graphics();
      sh.beginFill(0x000000, 0.2);
      sh.drawRect(-W / 2 + 4, -wallH / 2 + 5, W, wallH);
      sh.endFill();
      this.container.addChild(sh);
    }

    const g = new PIXI.Graphics();
    // Walls.
    g.lineStyle(3, 0x8a6a3a, 1);
    g.beginFill(0xe2c79b, 1);
    g.drawRect(-W / 2, -wallH / 2, W, wallH);
    g.endFill();
    // Roof.
    g.lineStyle(3, 0x7a3b2e, 1);
    g.beginFill(0xb5503e, 1);
    g.moveTo(-W / 2 - 12, -wallH / 2);
    g.lineTo(0, -wallH / 2 - roofH);
    g.lineTo(W / 2 + 12, -wallH / 2);
    g.closePath();
    g.endFill();
    this.container.addChild(g);

    // The box the team is working on, inside the house.
    const boxNode = renderThingDisplay(house.box, this.textures, this.theme, W - 26);
    boxNode.position.set(0, 8);
    this.container.addChild(boxNode);

    // The lead robot peeking out (a running worker).
    const robotTex = this.textures.get('robot');
    if (robotTex && robotTex !== PIXI.Texture.WHITE) {
      const r = new PIXI.Sprite(robotTex);
      r.anchor.set(0.5, 1);
      r.scale.set(0.42);
      r.position.set(0, -wallH / 2 - 4);
      this.container.addChild(r);
    }
  }
}
