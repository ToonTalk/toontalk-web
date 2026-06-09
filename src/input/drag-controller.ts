/**
 * Pointer-based pick-up / drag / drop with touch support.
 *
 * Two modes:
 *  - Normal: drag a thing; on drop, the dragged object's overlap + center decide
 *    the target, and the pure model (resolveDrop) applies the rules.
 *  - Training: while a Trainer session is active, drags happen *inside* the
 *    training box — press over one hole, release over another, and that becomes
 *    a recorded combine. Normal dragging is suspended.
 */
import * as PIXI from 'pixi.js';
import type { World } from '../model/world';
import type { Thing } from '../model/thing';
import type { DropContext } from '../model/interactions';
import type { Trainer } from '../model/trainer';
import { Box } from '../model/box';
import { Nest } from '../model/nest';
import { Wand } from '../model/wand';
import { NumberThing } from '../model/number';
import type { Renderer } from '../view/renderer';
import type { ThingView } from '../view/thing-view';
import type { RenderTheme } from '../config/render-mode';
import { recomputeScales } from '../model/scale';
import { BoxView } from '../view/box-view';
import { NestView } from '../view/nest-view';
import { renderThingDisplay } from '../view/display';
import { tweenScale } from '../view/animation';

export type DropResolver = (dragged: Thing, target: Thing | undefined, ctx: DropContext) => void;
export type TrainStep = (from: number, to: number) => void;

/** A node that's wiggling for selection feedback, plus its resting position. */
interface WiggleTarget {
  node: PIXI.Container;
  bx: number;
  by: number;
}

export class DragController {
  private dragging: ThingView | null = null;
  private grabOffset = { x: 0, y: 0 };
  private trainFrom: number | null = null;
  /** Floating copy of a hole's contents, shown while demonstrating a combine. */
  private trainGhost: PIXI.Container | null = null;
  /** Last known pointer position, for hover-selection feedback. */
  private pointer = { x: -1, y: -1 };
  /** The node currently wiggling + its base position, for settling. */
  private activeTarget: WiggleTarget | null = null;
  /** Hover wiggle target, recomputed on pointer move (not per frame). */
  private hoverTarget: WiggleTarget | null = null;

  constructor(
    private readonly world: World,
    private readonly renderer: Renderer,
    private readonly views: Map<string, ThingView>,
    private readonly resolve: DropResolver,
    private readonly trainer: Trainer,
    private readonly onTrainStep: TrainStep,
    private readonly textures: Map<string, PIXI.Texture>,
    private readonly theme: RenderTheme,
    /** Notified when a thing is picked up (the thing) or dropped (null). */
    private readonly onGrab: (thing: Thing | null) => void,
  ) {
    const stage = this.renderer.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.renderer.app.screen;
    stage.on('pointerdown', this.onPointerDown);
    stage.on('pointermove', this.onPointerMove);
    stage.on('pointerup', this.onPointerUp);
    stage.on('pointerupoutside', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    this.renderer.app.ticker.add(this.tickWiggle);
  }

  /**
   * Selection feedback: the thing under the hand (or the one being held)
   * wiggles. Matches the original's "circular movement" — a 2px offset stepping
   * right → down → left → up every 100ms (sprite.cpp selection_delta_x/y).
   */
  private tickWiggle = (): void => {
    const target: WiggleTarget | null = this.dragging
      ? { node: this.dragging.container, bx: this.dragging.thing.x, by: this.dragging.thing.y }
      : this.hoverTarget;
    const prev = this.activeTarget;
    if (prev && prev.node !== target?.node && !prev.node.destroyed) {
      prev.node.position.set(prev.bx, prev.by); // settle the previous selection
    }
    this.activeTarget = target;
    if (!target || target.node.destroyed) return;
    const D = 2;
    const phase = Math.floor((performance.now() % 400) / 100);
    const dx = phase === 0 ? D : phase === 2 ? -D : 0;
    const dy = phase === 1 ? D : phase === 3 ? -D : 0;
    target.node.position.set(target.bx + dx, target.by + dy);
  };

  /** Recompute the hovered wiggle target. Cheap per move, not per frame. */
  private updateHoverTarget(): void {
    if (this.dragging || this.trainer.active) {
      this.hoverTarget = null;
      return;
    }
    const hit = this.world.topAt(this.pointer, (thing, p) => {
      const v = this.views.get(thing.id);
      return v ? v.containsPoint(p.x, p.y) : false;
    });
    this.hoverTarget = hit ? this.computeTarget(hit) : null;
  }

  /**
   * The wiggle target for a hovered thing: a number inside a box hole (or an
   * item on a nest) wiggles on its own, not the whole container.
   */
  private computeTarget(hit: Thing): WiggleTarget | null {
    const view = this.views.get(hit.id);
    if (!view) return null;
    if (hit instanceof Box && view instanceof BoxView) {
      const i = view.holeIndexAt(this.pointer.x, this.pointer.y);
      if (i != null && !hit.isHoleEmpty(i)) {
        const hn = view.holeNode(i);
        if (hn) return { node: hn.node, bx: hn.x, by: hn.y };
      }
    } else if (hit instanceof Nest && view instanceof NestView) {
      if (view.pressedOnItem(this.pointer.x, this.pointer.y) && view.item) {
        return { node: view.item, bx: 0, by: 0 };
      }
    }
    return { node: view.container, bx: hit.x, by: hit.y };
  }

  /**
   * While holding a number, set its operation (applied when it's dropped) by
   * pressing a key, matching the original: + add · x/* multiply · / divide ·
   * % remainder · ^ power · = replace · - negate (subtraction is negate-then-add).
   */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.trainer.active) return;
    const thing = this.dragging?.thing;
    if (!(thing instanceof NumberThing)) return;
    let handled = true;
    switch (e.key) {
      case '+': thing.operation = '+'; break;
      case '*':
      case 'x':
      case 'X': thing.operation = '*'; break;
      case '/': thing.operation = '/'; break;
      case '%': thing.operation = '%'; break;
      case '^': thing.operation = '^'; break;
      case '=': thing.operation = '='; break;
      case '-': thing.negate(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.world.notifyChanged(thing);
    }
  };

  private trainingBoxView(): BoxView | null {
    const box = this.trainer.box;
    if (!box) return null;
    const view = this.views.get(box.id);
    return view instanceof BoxView ? view : null;
  }

  private onPointerDown = (e: PIXI.FederatedPointerEvent): void => {
    const { x, y } = e.global;

    // Training: begin a hole-to-hole demonstration, lifting a visible copy of
    // the grabbed hole's contents so the gesture is legible.
    if (this.trainer.active) {
      const bv = this.trainingBoxView();
      this.trainFrom = bv ? bv.holeIndexAt(x, y) : null;
      this.clearTrainGhost();
      const box = this.trainer.box;
      const occupant = this.trainFrom != null ? box?.contentsAt(this.trainFrom) : null;
      if (occupant) {
        const ghost = renderThingDisplay(occupant, this.textures, this.theme, 56);
        ghost.position.set(x, y);
        ghost.alpha = 0.85;
        ghost.zIndex = 5000;
        this.renderer.thingLayer.addChild(ghost);
        this.trainGhost = ghost;
      }
      return;
    }

    const hit = this.world.topAt({ x, y }, (thing, p) => {
      const view = this.views.get(thing.id);
      return view ? view.containsPoint(p.x, p.y) : false;
    });
    if (!hit) return;

    // If the press lands on a thing inside a box hole or on a nest, pull it out
    // and drag *that* instead of the container.
    const picked = this.tryExtract(hit, x, y) ?? hit;
    const view = this.views.get(picked.id);
    if (!view) return;

    this.dragging = view;
    this.grabOffset = { x: picked.x - x, y: picked.y - y };
    view.container.zIndex = 1000;
    view.setDragging(true);
    this.onGrab(picked);
  };

  /** Pull a thing out of a box hole or off a nest; returns it (now top-level). */
  private tryExtract(hit: Thing, x: number, y: number): Thing | null {
    if (hit instanceof Box) {
      const bv = this.views.get(hit.id);
      if (bv instanceof BoxView) {
        const i = bv.holeIndexAt(x, y);
        if (i != null && !hit.isHoleEmpty(i)) {
          const occ = hit.take(i);
          if (occ) {
            occ.moveTo({ x, y });
            recomputeScales(hit);
            this.world.add(occ);
            // Grow back from the hole size to full size as it's pulled out.
            const v = this.views.get(occ.id);
            if (v) tweenScale(v.container, 0.55, 1);
            this.world.notifyChanged(hit);
            return occ;
          }
        }
      }
    } else if (hit instanceof Nest) {
      const nv = this.views.get(hit.id);
      if (nv instanceof NestView && nv.pressedOnItem(x, y)) {
        const occ = hit.takeFront();
        if (occ) {
          occ.moveTo({ x, y });
          this.world.add(occ);
          this.world.notifyChanged(hit);
          return occ;
        }
      }
    }
    return null;
  }

  private onPointerMove = (e: PIXI.FederatedPointerEvent): void => {
    this.pointer = { x: e.global.x, y: e.global.y };
    this.updateHoverTarget();
    if (this.trainer.active) {
      if (this.trainGhost) this.trainGhost.position.set(e.global.x, e.global.y);
      return;
    }
    if (!this.dragging) return;
    const { x, y } = e.global;
    this.world.moveThing(this.dragging.thing.id, {
      x: x + this.grabOffset.x,
      y: y + this.grabOffset.y,
    });
  };

  private clearTrainGhost(): void {
    if (this.trainGhost) {
      this.trainGhost.destroy({ children: true });
      this.trainGhost = null;
    }
  }

  private onPointerUp = (e: PIXI.FederatedPointerEvent): void => {
    // Training: complete a hole-to-hole demonstration.
    if (this.trainer.active) {
      this.clearTrainGhost();
      if (this.trainFrom != null) {
        const bv = this.trainingBoxView();
        const to = bv ? bv.holeIndexAt(e.global.x, e.global.y) : null;
        if (to != null && to !== this.trainFrom) this.onTrainStep(this.trainFrom, to);
        this.trainFrom = null;
      }
      return;
    }

    if (!this.dragging) return;
    const dragged = this.dragging;

    dragged.setDragging(false);
    dragged.container.zIndex = 0;
    this.dragging = null;

    // The magic wand selects what its TIP touches (far end of the sprite),
    // rather than its overall overlap.
    if (dragged.thing instanceof Wand) {
      const wb = dragged.container.getBounds();
      const tipX = wb.x + wb.width * 0.04;
      const tipY = wb.y + wb.height * 0.3;
      const tipTarget = this.world.topAt({ x: tipX, y: tipY }, (thing, p) => {
        if (thing.id === dragged.thing.id) return false;
        const view = this.views.get(thing.id);
        return view ? view.containsPoint(p.x, p.y) : false;
      });
      this.resolve(dragged.thing, tipTarget, {});
      this.onGrab(null);
      return;
    }

    // Use the dragged object's own geometry (not the cursor tip) to decide what
    // it landed on, matching the original ToonTalk "drop it on the side" feel.
    const draggedBounds = dragged.container.getBounds();
    const cx = dragged.thing.x;
    const cy = dragged.thing.y;

    let target: Thing | undefined;
    let bestArea = 0;
    for (const thing of this.world.all()) {
      if (thing.id === dragged.thing.id) continue;
      const view = this.views.get(thing.id);
      if (!view) continue;
      const area = overlapArea(draggedBounds, view.container.getBounds());
      if (area > bestArea) {
        bestArea = area;
        target = thing;
      }
    }
    if (bestArea <= 0) target = undefined;

    const ctx: DropContext = {};
    if (target) {
      const tv = this.views.get(target.id);
      if (tv instanceof BoxView) {
        const hole = tv.holeIndexAt(cx, cy);
        if (hole != null) ctx.holeIndex = hole;
        // Dropped on the box's edge (not over a hole) → record a side so two
        // boxes can join.
        else ctx.side = cx < target.x ? 'left' : 'right';
      } else {
        ctx.side = cx < target.x ? 'left' : 'right';
      }
    }

    this.resolve(dragged.thing, target, ctx);
    this.onGrab(null);
  };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return w * h;
}
