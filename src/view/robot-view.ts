/**
 * Draws a robot sprite, its given NAME (so what it does is clear), a small badge
 * of how many actions it knows, and — once trained — a thought bubble showing its
 * condition as a little box: each hole shows the exact value it requires (a
 * guard), or an ERASED (faded) thing of that kind if it was generalised.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Robot } from '../model/robot';
import type { Thing, ThingKind } from '../model/thing';
import { NumberThing } from '../model/number';
import { TextThing } from '../model/text';
import { Box } from '../model/box';
import { Scale } from '../model/scale';
import { renderThingDisplay } from './display';
import { makeIdleSprite } from './animation';

/** A faded, value-less thing of `kind` — the "erased" wildcard shown in a thought
 * bubble for a generalised hole (a blank number/text pad, an empty box). */
function erasedSample(kind: ThingKind): Thing | null {
  let t: Thing | null;
  switch (kind) {
    case 'number': t = new NumberThing({ value: 0 }); break;
    case 'text': t = new TextThing({ value: '' }); break;
    case 'box': t = new Box({ size: 1 }); break; // a box-in-box wildcard
    case 'scale': return new Scale(); // a scale shows its tilt, not an "erased" form
    default: return null;
  }
  t.erased = true;
  return t;
}

export class RobotView extends ThingView {
  protected build(): void {
    const robot = this.thing as Robot;
    const tex = this.textures.get('robot') ?? PIXI.Texture.WHITE;

    // A team's members are SEPARATE floor robots lined up behind the lead (each
    // its own view), so nothing extra is drawn here for teammates.
    if (this.theme.dropShadow) {
      const shadow = new PIXI.Sprite(tex);
      shadow.anchor.set(0.5);
      shadow.tint = 0x000000;
      shadow.alpha = 0.25;
      shadow.position.set(3, 4);
      this.container.addChild(shadow);
    }

    // Resting in Tooly (static): the still Lego robot (RB00). On the floor it's
    // the clay "alive" fidget (robot-wait), morphing to Lego only at rest.
    const sprite = this.staticDisplay
      ? new PIXI.Sprite(tex)
      : (makeIdleSprite('robot-wait') ?? new PIXI.Sprite(tex));
    sprite.anchor.set(0.5);
    this.container.addChild(sprite);

    // The name (if any) on a pill below the robot, then the action-count badge.
    let infoY = sprite.height / 2 + 10;
    if (robot.name) {
      const nameT = new PIXI.Text(robot.name, {
        fontFamily: 'Tahoma, system-ui, sans-serif',
        fontSize: 13,
        fill: 0x1c3a4a,
        fontWeight: 'bold',
      });
      nameT.anchor.set(0.5);
      nameT.position.set(0, infoY);
      const pill = new PIXI.Graphics();
      pill.beginFill(0xffffff, 0.92);
      pill.lineStyle(1.5, 0x2e6e8e, 1);
      pill.drawRoundedRect(-nameT.width / 2 - 7, infoY - nameT.height / 2 - 2, nameT.width + 14, nameT.height + 4, 6);
      pill.endFill();
      this.container.addChild(pill, nameT);
      infoY += nameT.height + 8;
    }

    if (robot.actions.length > 0) {
      const badge = new PIXI.Text(`${robot.actions.length}⚙`, {
        fontFamily: 'Tahoma, system-ui, sans-serif',
        fontSize: 13,
        fill: 0x224466,
        fontWeight: 'bold',
      });
      badge.anchor.set(0.5);
      badge.position.set(0, infoY);
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

      if (kind === null) continue; // an empty-required hole stays an empty cell
      const exact = robot.exactValues[i];
      if (exact) {
        // A value guard: show the EXACT thing it must equal (kept after training).
        const node = renderThingDisplay(exact, this.textures, this.theme, cell - 4);
        node.position.set(cx, by);
        this.container.addChild(node);
      } else {
        // Generalised: show an ERASED (faded) thing of that kind — not the word
        // "any" (the robot was erased here after training, or was a wildcard).
        const sample = erasedSample(kind);
        if (sample) {
          const node = renderThingDisplay(sample, this.textures, this.theme, cell - 4, { scaleUp: true });
          node.position.set(cx, by);
          node.alpha = 0.6;
          this.container.addChild(node);
        }
      }
    }
  }
}
