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
import { hatchFromNest } from '../model/bird';
import { Notebook } from '../model/notebook';
import { Wand } from '../model/wand';
import { Robot, detachFromTeam, teamPositions, expandTeam } from '../model/robot';
import {
  NumberThing,
  rationalToEditBuffer,
  editBufferToRational,
  applyNumberKeyToBuffer,
} from '../model/number';
import { TextThing } from '../model/text';
import { Dusty } from '../model/dusty';
import { Pumpy } from '../model/pumpy';
import type { Renderer } from '../view/renderer';
import type { ThingView } from '../view/thing-view';
import type { RenderTheme } from '../config/render-mode';
import { recomputeScales } from '../model/scale';
import { BoxView } from '../view/box-view';
import { NestView } from '../view/nest-view';
import { NotebookView } from '../view/notebook-view';
import { renderThingDisplay } from '../view/display';
import { tweenScale, playOnce } from '../view/animation';
import { floorCamera } from '../view/floor-camera';
import { tlog, desc } from '../debug-log';

export type DropResolver = (dragged: Thing, target: Thing | undefined, ctx: DropContext) => void;

/**
 * A demonstrated training gesture (robot.htm). Dispatched to the Trainer by main:
 *  - `combine` — a hole dragged onto another hole (trainer decides move vs combine);
 *  - `remove`  — a hole's thing dragged *out of* the box ("take things out");
 *  - `insert`  — a floor thing dropped *into* a hole ("put things into a box").
 */
export type TrainGesture =
  | { kind: 'combine'; from: number; to: number }
  | { kind: 'remove'; from: number }
  | { kind: 'insert'; to: number; source: Thing }
  | { kind: 'copy'; from: number; to: number };
export type TrainStep = (gesture: TrainGesture) => void;

/** A node that's wiggling for selection feedback, plus its resting position. */
interface WiggleTarget {
  node: PIXI.Container;
  bx: number;
  by: number;
}

/** A held tool is drawn up-and-right of the pointer, so its tip is at the cursor. */
// Where a held tool sits relative to the cursor: down into the hand's curled
// grip (the hand cursor is drawn on top, so the fingers wrap over it).
const HELD_OFFSET = { x: -16, y: 42 };

export class DragController {
  private dragging: ThingView | null = null;
  private grabOffset = { x: 0, y: 0 };
  /** A notebook page pressed but not yet grabbed: taking a copy waits for a real
   * drag (a tap must NOT grab+refile a page — that silently duplicated it). */
  private pendingPage: { nbId: string; index: number; sx: number; sy: number } | null = null;
  /** In-progress notebook page-number entry, so typing consecutive digits jumps to
   * a multi-digit page (e.g. "1" then "4" → page 14), like the original. */
  private nbPageEntry: { id: string; n: number } | null = null;
  private trainFrom: number | null = null;
  /** A floor thing grabbed (outside the box) to be put INTO a hole, or null. */
  private trainInsertThing: Thing | null = null;
  /** True while dragging a wand-copy from `trainFrom` to another hole. */
  private trainWandCopy = false;
  /** Floating copy of a hole's contents, shown while demonstrating a combine. */
  private trainGhost: PIXI.Container | null = null;
  /** Last known pointer position, for hover-selection feedback. */
  private pointer = { x: -1, y: -1 };
  /** The node currently wiggling + its base position, for settling. */
  private activeTarget: WiggleTarget | null = null;
  /** Hover wiggle target, recomputed on pointer move (not per frame). */
  private hoverTarget: WiggleTarget | null = null;
  /** Thing under the hand, for keyboard editing of the selected pad. */
  private hoveredThing: Thing | null = null;
  /** In-progress number-pad typing buffer (so a decimal point / Backspace are
   * exact); reset when the edited pad changes or after any drop. */
  private numEdit: { id: string; text: string } | null = null;
  /** A tool (wand/Dusty/Pumpy) held on the cursor; click/space applies it. */
  private heldTool: ThingView | null = null;
  /** True between a toolbox pickup's pointer-down and -up, so the very click that
   * pulled the tool out can't also "apply"/drop it (the pickup may double-fire). */
  private justGrabbedTool = false;
  /** When false (e.g. the city scene is on top), ignore all pointer/key input. */
  private enabled = true;

  /** Enable/disable the whole controller (city scene takes over input). */
  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  /** Debug snapshot of what's currently held/dragged + trainer state, for the
   * verify harness (read via `window.__ttDrag.debug`). */
  get debug(): { heldTool: string | null; dragging: string | null; trainerActive: boolean } {
    return {
      heldTool: this.heldTool?.thing.kind ?? null,
      dragging: this.dragging?.thing.kind ?? null,
      trainerActive: this.trainer.active,
    };
  }

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
    stage.on('rightdown', this.onRightDown); // right-click → notebook next page
    window.addEventListener('keydown', this.onKeyDown);
    // Suppress the browser context menu so right-click is ours (page-turn).
    this.renderer.view.addEventListener('contextmenu', (e) => e.preventDefault());
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
    if (this.dragging) {
      this.hoverTarget = null;
      return;
    }
    if (this.trainer.active) {
      // In the thought bubble the active point is the hot spot: wiggle the hole's
      // content it's over, so you see WHAT a combine/erase/wand will act on (not
      // just the robot, which is the cursor).
      this.hoverTarget = this.trainingHoverTarget();
      return;
    }
    const hit = this.world.topAt(this.pointer, (thing, p) => {
      if (this.heldTool && thing.id === this.heldTool.thing.id) return false; // not the tool itself
      const v = this.views.get(thing.id);
      return v ? v.containsPoint(p.x, p.y) : false;
    });
    if ((hit ?? null) !== this.hoveredThing) this.numEdit = null; // moved off the pad → end its edit
    this.hoveredThing = hit ?? null;
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
      const i = view.contentIndexAt(this.pointer.x, this.pointer.y);
      if (i != null && !hit.isHoleEmpty(i)) {
        const hn = view.holeNode(i);
        if (hn) return { node: hn.node, bx: hn.x, by: hn.y }; // over the item → it wiggles (pull it out)
      }
      // else: over the box frame/gaps → the whole box wiggles (pick it up)
    } else if (hit instanceof Nest && view instanceof NestView) {
      if (view.pressedOnItem(this.pointer.x, this.pointer.y) && view.item) {
        return { node: view.item, bx: 0, by: 0 };
      }
    }
    return { node: view.container, bx: hit.x, by: hit.y };
  }

  /** Wiggle target while training: the content of the training box's hole the
   * active point is over (so the thing a tool/drop will act on shimmers). Empty
   * holes have no node to wiggle; off the box → nothing. */
  private trainingHoverTarget(): WiggleTarget | null {
    const bv = this.trainingBoxView();
    const box = this.trainer.box;
    if (!bv || !box) return null;
    const i = bv.holeIndexAt(this.pointer.x, this.pointer.y);
    if (i == null || box.isHoleEmpty(i)) return null;
    const hn = bv.holeNode(i);
    return hn ? { node: hn.node, bx: hn.x, by: hn.y } : null;
  }

  /**
   * Keyboard edits the **selected pad** (the one held, or hovered under the
   * hand). Numbers: digits append, Backspace deletes a digit, `-` negates, and
   * `+ x/* / % ^ =` set the operation applied on drop. Text: characters append,
   * Backspace deletes.
   */
  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey) return;

    // While training (the thought bubble) the only keys we act on are a held
    // tool's MODE keys — e.g. E/S/R to switch Dusty to erase/suck/reverse, so
    // you can generalise a hole, not just remove it. Esc/Backspace are the
    // trainer's done/cancel (handled separately) and pad-editing is off here.
    if (this.trainer.active) {
      if (this.heldTool && this.setToolMode(this.heldTool.thing, e.key)) {
        e.preventDefault();
        this.world.notifyChanged(this.heldTool.thing);
      }
      return;
    }

    // Holding something: Escape puts it down. A held number/text PAD is EDITED
    // by typing (digits/characters), as in the original — take a pad out and
    // type its value, then click to drop it. A held TOOL instead applies on
    // space and retunes its mode on its letter keys.
    if (this.heldTool) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.putDownTool();
        return;
      }
      const held = this.heldTool.thing;
      if (held instanceof NumberThing || held instanceof TextThing) {
        const ok = held instanceof NumberThing ? this.editNumber(held, e.key) : this.editText(held, e.key);
        if (ok) {
          e.preventDefault();
          this.world.notifyChanged(held);
        }
        return; // a held pad is for editing, not "apply" — drop it with a click
      }
      if (e.key === ' ') {
        e.preventDefault();
        this.applyHeldTool(this.pointer.x, this.pointer.y, true); // space = use; never drops on empty
        return;
      }
      if (this.setToolMode(held, e.key)) {
        e.preventDefault();
        this.world.notifyChanged(held);
      }
      return;
    }

    // Otherwise: edit the hovered/held pad, or set a hovered tool's mode.
    const thing = this.dragging?.thing ?? this.hoveredThing;
    if (!thing) return;
    const handled =
      thing instanceof NumberThing
        ? this.editNumber(thing, e.key)
        : thing instanceof TextThing
          ? this.editText(thing, e.key)
          : thing instanceof Notebook
            ? this.editNotebook(thing, e.key)
            : thing instanceof Robot
              ? this.editRobotName(thing, e.key)
              : this.setToolMode(thing, e.key);
    if (handled) {
      e.preventDefault();
      this.world.notifyChanged(thing);
    }
  };

  /**
   * Notebook keyboard navigation, matching the original (pad.cpp
   * `respond_to_keyboard`) while holding or pointing at it: SPACE (or `+`, or →)
   * → next page; RUBOUT/Backspace (or `-`, or ←) → previous page; a DIGIT goes to
   * that page, **accumulating** across consecutive digits (type "1" then "4" →
   * page 14), exactly as `go_to_page(current*10 + digit)`. Any other key clears
   * the digit run.
   */
  private editNotebook(nb: Notebook, key: string): boolean {
    if (key === ' ' || key === '+' || key === 'ArrowRight') {
      nb.flip(1);
      this.nbPageEntry = null;
      return true;
    }
    if (key === 'Backspace' || key === '-' || key === 'ArrowLeft') {
      nb.flip(-1);
      this.nbPageEntry = null;
      return true;
    }
    if (key.length === 1 && key >= '0' && key <= '9') {
      const digit = key.charCodeAt(0) - 48;
      const n = this.nbPageEntry?.id === nb.id ? this.nbPageEntry.n * 10 + digit : digit;
      nb.goTo(n); // 1-based; clamps to the last page
      this.nbPageEntry = { id: nb.id, n };
      return true;
    }
    this.nbPageEntry = null; // any other key ends the page-number run
    return false;
  }

  /** Set a tool's current mode/default from a key (the tool's button). */
  private setToolMode(thing: Thing, key: string): boolean {
    if (thing instanceof Pumpy) return this.editPumpy(thing, key);
    if (thing instanceof Dusty) return this.editDusty(thing, key);
    if (thing instanceof Wand) return this.editWand(thing, key);
    return false;
  }

  private editNumber(n: NumberThing, key: string): boolean {
    switch (key) {
      case '+': n.operation = '+'; return true;
      case '*':
      case 'x':
      case 'X': n.operation = '*'; return true;
      case '/': n.operation = '/'; return true;
      case '%': n.operation = '%'; return true;
      case '^': n.operation = '^'; return true;
      case '=': n.operation = '='; return true;
      case '-': n.negate(); this.numEdit = null; return true; // re-seed buffer from the negated value
    }
    // Value editing through a string buffer so a decimal point and Backspace work
    // exactly (digits append, '.' once, Backspace removes a char).
    const buf0 = this.numEdit?.id === n.id ? this.numEdit.text : rationalToEditBuffer(n.value);
    const buf = applyNumberKeyToBuffer(buf0, key);
    if (buf == null) return false;
    this.numEdit = { id: n.id, text: buf };
    n.value = editBufferToRational(buf);
    return true;
  }

  /**
   * Pumpy's mode keys (space applies it to the thing under the hose tip).
   * + / b bigger · - smaller · w wider · n narrower · t taller · s shorter ·
   * g good (revert to normal). Tab cycles through the defaults in order.
   */
  private editPumpy(p: Pumpy, key: string): boolean {
    switch (key) {
      case '+':
      case 'b': p.mode = 'bigger'; return true;
      case '-': p.mode = 'smaller'; return true;
      case 'w': p.mode = 'wider'; return true;
      case 'n': p.mode = 'narrower'; return true;
      case 't': p.mode = 'taller'; return true;
      case 's': p.mode = 'shorter'; return true;
      case 'g': p.mode = 'good'; return true;
      case 'Tab': p.cycleMode(); return true;
    }
    return false;
  }

  /** The wand's mode keys: C copy · O original · S copy-self · Tab cycles. */
  private editWand(w: Wand, key: string): boolean {
    switch (key.toLowerCase()) {
      case 'c': w.mode = 'C'; return true;
      case 'o': w.mode = 'O'; return true;
      case 's': w.mode = 'S'; return true;
      case 'tab': w.cycleMode(); return true;
    }
    return false;
  }

  /** Dusty's mode keys: E erase · S suck · R reverse · Tab cycles. */
  private editDusty(d: Dusty, key: string): boolean {
    switch (key.toLowerCase()) {
      case 'e': d.mode = 'erase'; return true;
      case 's': d.mode = 'suck'; return true;
      case 'r': d.mode = 'reverse'; return true;
      case 'tab': d.cycleMode(); return true;
    }
    return false;
  }

  private editText(t: TextThing, key: string): boolean {
    if (key === 'Backspace') {
      t.value = t.value.slice(0, -1);
      return true;
    }
    if (key.length === 1) {
      t.value += key;
      return true;
    }
    return false;
  }

  /** Type a NAME onto a robot you're holding/pointing at (so what it does is
   * clear) — characters append, Backspace deletes (robot.htm: robots are named). */
  private editRobotName(robot: Robot, key: string): boolean {
    if (key === 'Backspace') {
      robot.name = robot.name.slice(0, -1);
      return true;
    }
    if (key.length === 1 && key >= ' ') {
      robot.name += key;
      return true;
    }
    return false;
  }

  private trainingBoxView(): BoxView | null {
    const box = this.trainer.box;
    if (!box) return null;
    const view = this.views.get(box.id);
    return view instanceof BoxView ? view : null;
  }

  /** Format a WORLD point as on-screen coords for the debug log. */
  private scr(x: number, y: number): string {
    return `screen(${Math.round(x - floorCamera.x)},${Math.round(y - floorCamera.y)})`;
  }

  /** Where the training box sits on screen, for the debug log. */
  private boxAt(): string {
    const box = this.trainer.box;
    if (!box) return 'no box';
    return `box centre ~${this.scr(box.x, box.y)} (${box.size} hole${box.size === 1 ? '' : 's'})`;
  }

  /** Where a held tool/element is drawn relative to the active point. On the
   * floor it hangs below-right of the (hidden) pointer. In a robot's thoughts
   * the active point IS the reticle at the robot's hand, so the tool sits right
   * on it — you aim the tool at a hole and that exact spot is what's clicked.
   * (Before this, Dusty/wand were drawn ~HELD_OFFSET below the active point, so
   * aiming the nozzle put the real hit-point above the hole and the click
   * missed — `holeIndexAt` is not forgiving the way put-in's `dropHole` is.) */
  private heldOffset(): { x: number; y: number } {
    return this.trainer.active ? { x: 0, y: 0 } : HELD_OFFSET;
  }

  /** Where to draw a held thing relative to the active point (cursor/reticle).
   * A TOOL is offset so its business end — Dusty's nose, the wand's tip
   * (`ThingView.activeOffset`) — lands exactly on the active point, so aiming
   * the tip is what gets clicked (floor and bubble alike). A carried element
   * keeps the plain hand offset. */
  private heldVec(view: ThingView): { x: number; y: number } {
    if (this.isTool(view.thing)) {
      // The tool's active point — Pumpy's hose nozzle, Dusty's nose tip, the
      // wand's star (ThingView.activeOffset) — lands on the cursor; the rest of
      // the tool extends from it, above/beside the pointing hand so you see it.
      const o = view.activeOffset();
      return { x: -o.x * view.container.scale.x, y: -o.y * view.container.scale.y };
    }
    return this.heldOffset();
  }

  /** Cursor → world: the floor view is panned by the floor camera, so a screen
   * point maps to a world point by adding the camera offset. All placement and
   * hit-testing here works in WORLD coords. */
  private worldPt(p: { x: number; y: number }): { x: number; y: number } {
    return { x: p.x + floorCamera.x, y: p.y + floorCamera.y };
  }

  /** Right-click flips the notebook to the NEXT page (the original scheme: space /
   * right-click forward, rubout back). It does nothing else. Separate from
   * onPointerDown so a right press never starts a drag. */
  private onRightDown = (e: PIXI.FederatedPointerEvent): void => {
    if (!this.enabled) return;
    const { x, y } = this.worldPt(e.global);
    const hit = this.world.topAt({ x, y }, (thing, p) => {
      const v = this.views.get(thing.id);
      return v ? v.containsPoint(p.x, p.y) : false;
    });
    if (hit instanceof Notebook) {
      hit.flip(1);
      this.world.notifyChanged(hit);
      tlog(`notebook: right-click → next page ${hit.index + 1}/${hit.count}`);
    }
  };

  private onPointerDown = (e: PIXI.FederatedPointerEvent): void => {
    if (!this.enabled) return;
    if (e.button !== 0) return; // left button only; right-click is onRightDown
    const { x, y } = this.worldPt(e.global);

    // Training: begin a demonstration, lifting a visible ghost of what's grabbed.
    // Inside the box → grab a hole's thing (→ combine/move, or take-out if
    // released off the box). Outside the box → grab a floor thing to put IN.
    if (this.trainer.active) {
      if (this.heldTool && !this.justGrabbedTool) {
        // The magic wand COPIES: drag from a filled hole to another (or itself)
        // → records a copy. Other held things (Dusty, an element) apply on click.
        if (this.heldTool.thing instanceof Wand) {
          this.clearTrainGhost();
          this.trainFrom = null;
          this.trainInsertThing = null;
          this.trainWandCopy = false;
          const wand = this.heldTool.thing;
          const bv = this.trainingBoxView();
          const from = bv && bv.withinBox(x, y) ? bv.holeIndexAt(x, y) : null;
          const src = from != null ? this.trainer.box?.contentsAt(from) ?? null : null;
          // Wand in SELF-COPY mode (S) on an EMPTY hole → drop a copy of the robot
          // there (recursion: "a copy of himself and his teammates", robot.htm).
          if (wand.mode === 'S' && from != null && !src) {
            if (this.trainer.recordSelfCopy(from)) tlog(`train: wand self-copy → hole ${from} ${this.scr(x, y)}`);
            return;
          }
          if (from != null && src) {
            this.trainFrom = from;
            this.trainWandCopy = true;
            const ghost = renderThingDisplay(src, this.textures, this.theme, 56);
            ghost.position.set(x, y);
            ghost.alpha = 0.85;
            ghost.zIndex = 5000;
            this.renderer.thingLayer.addChild(ghost);
            this.trainGhost = ghost;
          }
          return;
        }
        // Dusty / a carried element apply on RELEASE (so a drag straight from
        // Tooly onto a hole works, not only a separate click) — see onPointerUp.
        return;
      }
      this.clearTrainGhost();
      this.trainFrom = null;
      this.trainInsertThing = null;
      this.trainWandCopy = false;
      const bv = this.trainingBoxView();
      const box = this.trainer.box;
      let lift: Thing | null = null;
      if (bv && box && bv.withinBox(x, y)) {
        this.trainFrom = bv.holeIndexAt(x, y);
        lift = this.trainFrom != null ? box.contentsAt(this.trainFrom) : null;
      } else {
        // A floor thing (not the box or the trainee robot, not a tool) to put in.
        const robotId = this.trainer.robot?.id;
        const hit = this.world.topAt({ x, y }, (thing, p) => {
          if (box && thing.id === box.id) return false;
          if (robotId && thing.id === robotId) return false;
          if (this.isTool(thing)) return false;
          const v = this.views.get(thing.id);
          return v ? v.containsPoint(p.x, p.y) : false;
        });
        if (hit) {
          this.trainInsertThing = hit;
          lift = hit;
        }
      }
      if (lift) {
        const ghost = renderThingDisplay(lift, this.textures, this.theme, 56);
        ghost.position.set(x, y);
        ghost.alpha = 0.85;
        ghost.zIndex = 5000;
        this.renderer.thingLayer.addChild(ghost);
        this.trainGhost = ghost;
      }
      const what =
        this.trainFrom != null ? `grabbed hole ${this.trainFrom}${lift ? ' = ' + desc(lift) : ' (empty)'}`
        : this.trainInsertThing ? `grabbed ${desc(this.trainInsertThing)} (to put in)`
        : `nothing here — ${this.boxAt()}`;
      tlog(`train press ${this.scr(x, y)}: ${what}`);
      return;
    }

    // Holding a tool: this click applies it to the thing under the tip, or puts
    // the tool down on empty floor. (Space does the same — see onKeyDown.) The
    // click that pulled the tool out of Tooly is ignored once (justGrabbedTool).
    if (this.heldTool) {
      if (!this.justGrabbedTool) this.applyHeldTool(x, y);
      return;
    }

    const hit = this.world.topAt({ x, y }, (thing, p) => {
      const view = this.views.get(thing.id);
      return view ? view.containsPoint(p.x, p.y) : false;
    });
    if (!hit) {
      tlog(`click ${this.scr(x, y)}: empty floor (nothing grabbed)`);
      return;
    }

    // Notebook: a page is taken only on a real DRAG (deferred to onPointerMove)
    // so a tap doesn't grab a copy and, dropped straight back, file a duplicate +
    // jump to the last page. (Page-turning is by keyboard / right-click — see
    // editNotebook / the contextmenu handler.) Elsewhere on it → grab the
    // notebook itself (falls through below).
    if (hit instanceof Notebook) {
      const nv = this.views.get(hit.id);
      if (nv instanceof NotebookView) {
        const idx = nv.pageIndexAt(x, y);
        if (idx != null && hit.pages[idx]) {
          this.pendingPage = { nbId: hit.id, index: idx, sx: x, sy: y };
          return; // wait for a drag before taking a copy
        }
      }
    }

    // If the press lands on a thing inside a box hole or on a nest, pull it out
    // and drag *that* instead of the container.
    const picked = this.tryExtract(hit, x, y) ?? hit;
    const view = this.views.get(picked.id);
    if (!view) return;

    // A tool (wand/Dusty/Pumpy) is taken *into hand* — you then move it over a
    // thing and click/space to apply it — rather than dragged-and-dropped.
    if (this.isTool(picked)) {
      this.heldTool = view;
      this.justGrabbedTool = true; // this same click shouldn't also apply/drop it
      view.setAlive(true); // morph Lego→clay in hand (was missing here, so a tool
      // re-picked-up FROM THE FLOOR stayed Lego — holdTool from Tooly did set it)
      view.container.zIndex = 1000;
      const o = this.heldVec(view);
      this.world.moveThing(picked.id, { x: x + o.x, y: y + o.y });
      this.onGrab(picked);
      return;
    }

    // Grabbing a teammate pulls it OFF the team (it becomes a solo robot again);
    // the lead re-closes its line.
    if (picked instanceof Robot && picked.leader) {
      const lead = picked.leader;
      detachFromTeam(picked);
      for (const p of teamPositions(lead)) this.world.moveThing(p.robot.id, { x: p.x, y: p.y });
      this.world.notifyChanged(lead);
    }

    this.dragging = view;
    this.grabOffset = { x: picked.x - x, y: picked.y - y };
    view.container.zIndex = 1000;
    view.setDragging(true);
    this.onGrab(picked);
  };

  private isTool(thing: Thing): boolean {
    return thing instanceof Wand || thing instanceof Dusty || thing instanceof Pumpy;
  }

  /**
   * Put a tool straight into the hand — used when one is taken out of the
   * toolbox, matching the original where a tool comes out of Tooly already held.
   * It then follows the cursor; the next click (or space) applies it, and the
   * mode keys (S/R/E for Dusty, C/O/S wand, Pumpy keys) retune it.
   */
  holdTool(thing: Thing): void {
    // Anything pulled from Tooly is carried in the hand (a tool stays for repeat
    // use; an element is dropped/placed on the next click — see applyHeldTool).
    const view = this.views.get(thing.id);
    if (!view) return;
    this.heldTool = view;
    view.setAlive(true); // a tool morphs from Lego to its clay form in the hand
    this.justGrabbedTool = true; // ignore this same click's apply/drop on the stage
    view.container.zIndex = 1000;
    if (this.pointer.x >= 0) {
      const o = this.heldVec(view);
      this.world.moveThing(thing.id, { x: this.pointer.x + o.x, y: this.pointer.y + o.y });
    }
    this.onGrab(thing);
  }

  /** Put the held tool down (release it where it is). */
  private putDownTool(): void {
    if (!this.heldTool) return;
    this.heldTool.container.zIndex = 0;
    this.heldTool.setAlive(false); // back to its Lego form at rest
    this.heldTool = null;
    this.onGrab(null);
  }

  /**
   * Apply the held tool to the thing under the tip (the pointer), via the normal
   * drop rules (wand copies, Dusty erases/sucks/spits, Pumpy resizes); the tool
   * **stays in hand** so you can keep using it. A click/space over empty floor
   * puts the tool down (so does Escape). The pickup click can't reach here
   * (guarded by justGrabbedTool), so it won't self-drop.
   */
  private applyHeldTool(x: number, y: number, fromSpace = false): void {
    const tool = this.heldTool;
    if (!tool) return;
    // Inside a robot's thoughts (training):
    if (this.trainer.active) {
      const bv = this.trainingBoxView();
      const held = tool.thing;
      const at = this.scr(x, y);
      if (this.isTool(held)) {
        // A tool acts on the hole's content and STAYS in hand: Dusty erases
        // (generalise) or removes; other tools apply their normal effect. Use the
        // SAME forgiving snap as put-in (`dropHole`, ~30px) so a near-miss still
        // lands on the hole — Dusty was using the strict `holeIndexAt`, which is
        // why it kept missing when put-in (forgiving) worked.
        const to = bv ? bv.dropHole(x, y, 30) : null;
        const content = to != null ? this.trainer.box?.contentsAt(to) ?? null : null;
        if (content) {
          if (held instanceof Dusty) {
            if (held.mode === 'erase') this.trainer.eraseHole(to!);
            else this.trainer.removeHole(to!);
            // Visible feedback that Dusty acted — the floor plays this via
            // resolveDrop; the training path bypasses it, so play it here too.
            playOnce('dusty-suck', this.renderer.thingLayer, x, y);
          } else {
            this.resolve(held, content, {});
          }
          tlog(`tool ${desc(held)} on hole ${to} ${at}`);
        } else {
          tlog(`tool ${desc(held)} ${at} → no hole there (no-op); ${this.boxAt()}`);
        }
        return;
      }
      // An element carried from Tooly → put it IN (forgiving: snap to the nearest
      // hole near the box, so a small miss still lands).
      const to = bv ? bv.dropHole(x, y, 32) : null;
      this.putDownTool();
      if (to != null) {
        this.onTrainStep({ kind: 'insert', to, source: held });
      } else {
        tlog(`put-in MISSED: dropped ${desc(held)} ${at} — not on a hole; ${this.boxAt()}`);
      }
      return;
    }
    const target =
      this.world.topAt({ x, y }, (thing, p) => {
        if (thing.id === tool.thing.id) return false;
        const view = this.views.get(thing.id);
        return view ? view.containsPoint(p.x, p.y) : false;
      }) ??
      // Forgiving: a near-miss snaps to the nearest thing (so Dusty/the wand act
      // on what you were aiming at instead of dropping onto bare floor).
      this.nearestThing(x, y, 48, tool.thing.id);
    if (!target) {
      // Dusty in REVERSE spits its last sucked thing onto the empty floor here
      // (it stays in hand). (resolveDrop ignores a null target, so spit here.)
      const t = tool.thing;
      if (t instanceof Dusty && t.mode === 'reverse' && t.stomach.length > 0) {
        const spat = t.stomach.pop()!;
        spat.moveTo({ x, y });
        this.world.add(spat);
        return;
      }
      // Let the resolver speak for a no-target click (e.g. a bomb explains it
      // needs a house).
      this.resolve(t, undefined, {});
      // SPACE over empty floor = "use" intent → a TOOL stays in hand (don't drop).
      // A CLICK on empty floor puts the tool DOWN. A carried ELEMENT is always set
      // on the floor.
      if (!this.isTool(t) || !fromSpace) this.putDownTool();
      return;
    }
    this.resolve(tool.thing, target, this.contextFor(target, x, y, tool.thing));
    // A held ELEMENT is placed/applied once, then leaves the hand; a TOOL
    // (wand/Dusty/Pumpy) stays in hand for repeated use.
    if (!this.isTool(tool.thing)) this.putDownTool();
  }

  /** The nearest thing whose on-screen bounds are within `margin` px of the
   * world point (x,y), or null — so a held tool applied just OFF a thing still
   * lands on it (the box/robot is a small target on the floor). */
  private nearestThing(x: number, y: number, margin: number, excludeId: string): Thing | null {
    let best: Thing | null = null;
    let bestD = Infinity;
    for (const thing of this.world.all()) {
      if (thing.id === excludeId) continue;
      const view = this.views.get(thing.id);
      if (!view) continue;
      const b = view.container.getBounds(); // screen coords; world = +floorCamera
      const minX = b.x + floorCamera.x;
      const minY = b.y + floorCamera.y;
      const dx = x < minX ? minX - x : x > minX + b.width ? x - (minX + b.width) : 0;
      const dy = y < minY ? minY - y : y > minY + b.height ? y - (minY + b.height) : 0;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = thing;
      }
    }
    return bestD <= margin ? best : null;
  }

  /** Which box hole / which side a reference point (px,py) lands on, for a drop. */
  private contextFor(target: Thing, px: number, py: number, dragged?: Thing): DropContext {
    const ctx: DropContext = {};
    const tv = this.views.get(target.id);
    if (tv instanceof BoxView) {
      // cubby.cpp: a box dropped clear of an end concatenates (join); anything
      // landing over the row goes into the nearest hole (fill / combine / nest).
      const slot = tv.dropSlot(px, py, dragged instanceof Box);
      if (slot.holeIndex != null) ctx.holeIndex = slot.holeIndex;
      else ctx.side = slot.side;
    } else {
      ctx.side = px < target.x ? 'left' : 'right';
    }
    return ctx;
  }

  /** Pull a thing out of a box hole or off a nest; returns it (now top-level). */
  private tryExtract(hit: Thing, x: number, y: number): Thing | null {
    if (hit instanceof Box) {
      const bv = this.views.get(hit.id);
      if (bv instanceof BoxView) {
        const i = bv.contentIndexAt(x, y); // only pull out if the press is ON the item
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
      // Hatch a bird from the egg: an empty nest with no bird yet gives a fresh
      // bird (which then feeds this nest).
      const bird = hatchFromNest(this.world, hit, x, y);
      if (bird) return bird;
    }
    return null;
  }

  /** Take a COPY off the notebook's clicked leaf and begin dragging it (the
   * notebook keeps its own — pad.cpp grabs a copy of the page on the clicked
   * side). Called once a press over a page turns into a real drag. */
  private startPageDrag(nbId: string, index: number, x: number, y: number): void {
    const nb = this.world.get(nbId);
    if (!(nb instanceof Notebook)) return;
    const page = nb.pages[index];
    if (!page) return;
    const copy = page.copy();
    copy.moveTo({ x, y });
    this.world.add(copy);
    // A filed robot TEAM comes out as separate robots lined up behind it.
    if (copy instanceof Robot && copy.team.length > 0) expandTeam(this.world, copy);
    const v = this.views.get(copy.id);
    if (!v) return;
    tweenScale(v.container, 0.6, 1);
    this.dragging = v;
    this.grabOffset = { x: copy.x - x, y: copy.y - y };
    v.container.zIndex = 1000;
    v.setDragging(true);
    this.onGrab(copy);
    tlog(`notebook: took a copy of page ${index + 1} (${desc(copy)})`);
  }

  private onPointerMove = (e: PIXI.FederatedPointerEvent): void => {
    if (!this.enabled) return;
    const w = this.worldPt(e.global);
    this.pointer = w; // world coords (hit-testing adds the floor camera too)
    this.updateHoverTarget();
    // A held tool follows the cursor (it's in hand), even with no button down.
    if (this.heldTool) {
      const o = this.heldVec(this.heldTool);
      this.world.moveThing(this.heldTool.thing.id, {
        x: w.x + o.x,
        y: w.y + o.y,
      });
      // In the thought bubble the box is small and the tool would cover it — make
      // the held tool see-through there so you can see the hole you're aiming at
      // (the reticle still marks the exact active point). The wand manages its own
      // alpha (hold-pose), so leave it.
      if (!(this.heldTool.thing instanceof Wand)) {
        this.heldTool.container.alpha = this.trainer.active ? 0.45 : 1;
      }
      return;
    }
    if (this.trainer.active) {
      if (this.trainGhost) this.trainGhost.position.set(w.x, w.y);
      return;
    }
    // A pressed notebook page becomes a grabbed copy once the drag moves enough.
    if (this.pendingPage) {
      const pp = this.pendingPage;
      if (Math.hypot(w.x - pp.sx, w.y - pp.sy) > 7) {
        this.pendingPage = null;
        this.startPageDrag(pp.nbId, pp.index, w.x, w.y);
      }
      return;
    }
    if (!this.dragging) return;
    this.world.moveThing(this.dragging.thing.id, {
      x: w.x + this.grabOffset.x,
      y: w.y + this.grabOffset.y,
    });
  };

  private clearTrainGhost(): void {
    if (this.trainGhost) {
      this.trainGhost.destroy({ children: true });
      this.trainGhost = null;
    }
  }

  private onPointerUp = (e: PIXI.FederatedPointerEvent): void => {
    if (!this.enabled) return;
    const justGrabbed = this.justGrabbedTool; // was this the click that picked a tool/element up?
    this.justGrabbedTool = false; // the pickup gesture is over; future clicks apply/drop
    this.numEdit = null; // a drop may change a pad's value — end any number edit
    // A notebook page pressed but never dragged is a tap — take nothing (so it
    // doesn't duplicate the page); flip with the corner buttons instead.
    if (this.pendingPage) {
      this.pendingPage = null;
      tlog('notebook: tap (no page taken — drag a page off, or use ◀ ▶ to flip)');
      return;
    }
    // Training: complete a demonstration — hole→hole combine, take-out, or put-in.
    if (this.trainer.active) {
      this.clearTrainGhost();
      const bv = this.trainingBoxView();
      const wp = this.worldPt(e.global);
      const insideBox = bv ? bv.withinBox(wp.x, wp.y) : false;
      const overHole = insideBox && bv ? bv.holeIndexAt(wp.x, wp.y) : null;
      if (this.trainWandCopy && this.trainFrom != null) {
        if (overHole != null) this.onTrainStep({ kind: 'copy', from: this.trainFrom, to: overHole });
        this.trainWandCopy = false;
        this.trainFrom = null;
        return;
      }
      // A carried element (put-in) or Dusty applies on the drop — on a hole, or
      // on any later click. But the SAME click that just plucked it out of Tooly
      // (justGrabbed, released off a hole) must NOT instantly drop it: keep it in
      // hand so you can then carry it to a hole. The WAND is excluded: it acts on
      // pointer-DOWN (a copy-drag, or an S-mode self-copy click), so applying it
      // again here would double-fire (e.g. copy the robot a self-copy just placed).
      if (this.heldTool && !(this.heldTool.thing instanceof Wand)) {
        if (overHole != null || !justGrabbed) this.applyHeldTool(wp.x, wp.y);
        return;
      }
      if (this.heldTool) return; // a held wand was already handled on pointer-down
      if (this.trainFrom != null) {
        if (overHole != null && overHole !== this.trainFrom) {
          this.onTrainStep({ kind: 'combine', from: this.trainFrom, to: overHole });
        } else if (!insideBox) {
          this.onTrainStep({ kind: 'remove', from: this.trainFrom }); // dragged out → take-out
        }
      } else if (this.trainInsertThing != null && overHole != null) {
        this.onTrainStep({ kind: 'insert', to: overHole, source: this.trainInsertThing });
      }
      this.trainFrom = null;
      this.trainInsertThing = null;
      return;
    }

    if (this.heldTool) return; // a tool stays in hand; clicks apply, release doesn't
    if (!this.dragging) return;
    const dragged = this.dragging;

    dragged.setDragging(false);
    dragged.container.zIndex = 0;
    this.dragging = null;

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

    // Forgiving box-join: a box dropped just SHY of another box (no actual
    // overlap) should still join — grow the dragged box's bounds by a margin and
    // snap to the nearest box it nearly touches (the original's add_to_side is
    // lenient about the gap). Only when nothing overlapped, and only box→box.
    if (!target && dragged.thing instanceof Box) {
      const M = 46;
      const grown = {
        x: draggedBounds.x - M,
        y: draggedBounds.y - M,
        width: draggedBounds.width + 2 * M,
        height: draggedBounds.height + 2 * M,
      };
      const dcx = draggedBounds.x + draggedBounds.width / 2;
      let bestD = Infinity;
      for (const thing of this.world.all()) {
        if (thing.id === dragged.thing.id || !(thing instanceof Box)) continue;
        const v = this.views.get(thing.id);
        if (!v) continue;
        const b = v.container.getBounds();
        if (overlapArea(grown, b) <= 0) continue; // not even near
        const d = Math.abs(b.x + b.width / 2 - dcx);
        if (d < bestD) { bestD = d; target = thing; }
      }
    }

    this.resolve(dragged.thing, target, target ? this.contextFor(target, cx, cy, dragged.thing) : {});
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
