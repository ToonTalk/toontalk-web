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

    // The blue Lego robot (RB00), as in the original — the same at rest in Tooly
    // and on the floor. (The clay "alive" fidget is for when it's actually
    // running, not while it sits waiting.)
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    this.container.addChild(sprite);

    // The robot's NAME printed on its chest (the original shows it there, e.g.
    // "Doubler") — not a pill below, and there's NO action-count badge.
    if (robot.name) {
      const nameT = new PIXI.Text(robot.name, {
        fontFamily: 'Tahoma, system-ui, sans-serif',
        fontSize: 11,
        fill: 0xffffff,
        fontWeight: 'bold',
        stroke: 0x10243a,
        strokeThickness: 3,
      });
      nameT.anchor.set(0.5);
      nameT.position.set(0, sprite.height * 0.07); // across the torso
      this.container.addChild(nameT);
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
        // Generalised: show the real ERASED IMAGE of that kind — a blank number
        // plate (NUMPLAT), a blank text plate (TEXTPLAT) or an empty box panel
        // (CUBBYB) — at full strength (the BLANKNESS says "any", not the word).
        const sample = erasedSample(kind);
        if (sample) {
          const node = renderThingDisplay(sample, this.textures, this.theme, cell - 2, { scaleUp: true, stretch: true, maxHeight: cell - 2 });
          node.position.set(cx, by);
          this.container.addChild(node);
        }
      }
    }
  }
}
