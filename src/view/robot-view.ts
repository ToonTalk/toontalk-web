/**
 * Draws a robot sprite, a small badge of how many actions it knows, and — once
 * trained — a thought bubble showing its condition as a little box: each hole
 * shows the exact value it requires (a guard), or a faded "any" if erased.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Robot } from '../model/robot';
import { renderThingDisplay } from './display';

export class RobotView extends ThingView {
  protected build(): void {
    const robot = this.thing as Robot;
    const tex = this.textures.get('robot') ?? PIXI.Texture.WHITE;

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

    if (robot.actions.length > 0) {
      const badge = new PIXI.Text(`${robot.actions.length}⚙`, {
        fontFamily: 'Tahoma, system-ui, sans-serif',
        fontSize: 13,
        fill: 0x224466,
        fontWeight: 'bold',
      });
      badge.anchor.set(0.5);
      badge.position.set(0, sprite.height / 2 + 8);
      this.container.addChild(badge);
    }

    if (robot.condition.length > 0) {
      this.drawThoughtBubble(robot, sprite.height);
    }
  }

  private drawThoughtBubble(robot: Robot, robotHeight: number): void {
    const bubbleTex = this.textures.get('bubble');
    if (!bubbleTex) return;

    const bubble = new PIXI.Sprite(bubbleTex);
    bubble.anchor.set(0.5);
    bubble.scale.set(0.72);
    bubble.position.set(46, -robotHeight / 2 - bubble.height / 2 + 14);
    this.container.addChild(bubble);

    const n = robot.condition.length;
    const cell = 28;
    const gap = 5;
    const pad = 7;
    const totalW = n * cell + (n - 1) * gap;
    const bx = bubble.x;
    const by = bubble.y - bubble.height * 0.12;

    // The condition box frame (matches the blue lego box style).
    const frame = new PIXI.Graphics();
    frame.lineStyle(2, 0x2e6e8e, 1);
    frame.beginFill(0x5aa6c8, 1);
    frame.drawRoundedRect(bx - totalW / 2 - pad, by - cell / 2 - pad, totalW + pad * 2, cell + pad * 2, 6);
    frame.endFill();
    this.container.addChild(frame);

    const startX = bx - totalW / 2 + cell / 2;
    for (let i = 0; i < n; i++) {
      const cx = startX + i * (cell + gap);
      const kind = robot.condition[i];

      const hole = new PIXI.Graphics();
      hole.lineStyle(1, 0x2e6e8e, 1);
      hole.beginFill(0xcdeaf5, 1);
      hole.drawRoundedRect(cx - cell / 2, by - cell / 2, cell, cell, 4);
      hole.endFill();
      this.container.addChild(hole);

      if (kind === null) continue;
      const exact = robot.exactValues[i];
      if (exact) {
        const node = renderThingDisplay(exact, this.textures, this.theme, cell - 4);
        node.position.set(cx, by);
        this.container.addChild(node);
      } else {
        const label = new PIXI.Text('any', {
          fontFamily: 'Tahoma, system-ui, sans-serif',
          fontSize: 11,
          fill: 0x4477aa,
        });
        label.anchor.set(0.5);
        label.position.set(cx, by);
        this.container.addChild(label);
      }
    }
  }
}
