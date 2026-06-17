/**
 * Draws a box (cubby) the way the original does (cubby.cpp): a row of tiled
 * lego pieces — CUBBY1 for the first hole (left-wall · hole · right-wall) and
 * CUBBYR for each further hole (hole · right-wall), so the pieces abut into one
 * box with shared dividers and **no outer frame**. An empty hole shows the
 * recessed hole; a filled hole draws its contents on top. Falls back to drawn
 * cells if the bitmaps are missing.
 */
import * as PIXI from 'pixi.js';
import { ThingView } from './thing-view';
import { Box } from '../model/box';
import { renderThingDisplay } from './display';
import { tweenScale } from './animation';

const H = 84; // piece (box) height in px
const ONE = { key: 'cubby1', aspect: 464 / 292, holeCx: 0.5 }; // first hole piece
const REST = { key: 'cubbyr', aspect: 192 / 146, holeCx: 0.34 }; // each further hole

/**
 * Faithful port of cubby.cpp `closest_hole`:2605 + the end-branch of
 * `item_released_on_top`:462-491. Given a drop point's box-local x, the box's
 * left edge (`spanLeft`) and total width (`spanW`) and hole count `n`:
 *   - x left of the box → raw index -1; x past the right edge → n; else
 *     `floor((x-left)*n/width)` (closest_hole ignores y).
 *   - landing on a real hole → that hole (fill / combine / nest).
 *   - off an end: a **box** dropped clear of the end concatenates
 *     (`add_to_side`); anything else "must have meant" the nearest end hole, so
 *     clamp -1→0, n→n-1.
 */
export function resolveDropSlot(
  localX: number,
  n: number,
  spanLeft: number,
  spanW: number,
  draggedIsBox: boolean,
): { holeIndex: number | null; side: 'left' | 'right' } {
  const dx = localX - spanLeft;
  let idx: number;
  if (n === 0 || dx < 0) idx = -1;
  else if (dx >= spanW) idx = n;
  else idx = Math.floor((dx * n) / spanW);
  if (idx < 0) return draggedIsBox ? { holeIndex: null, side: 'left' } : { holeIndex: 0, side: 'left' };
  if (idx >= n) return draggedIsBox ? { holeIndex: null, side: 'right' } : { holeIndex: n - 1, side: 'right' };
  return { holeIndex: idx, side: localX < 0 ? 'left' : 'right' };
}

export class BoxView extends ThingView {
  /** Local-space x of each hole's centre, for hit-testing and wiggle. */
  private holeCenters: number[] = [];
  /** Per-hole content node + base position, for selection wiggle. */
  private holeNodes: Array<{ node: PIXI.Container; x: number; y: number } | null> = [];
  /** Local-space left edge and total width of the row of pieces (cubby.cpp llx/width). */
  private spanLeft = 0;
  private spanW = 0;

  protected build(): void {
    const box = this.thing as Box;
    // A blank box (no size yet) shows a single faint empty hole — "drop a number
    // to size me, or text to explode into me" (cubby.cpp blank cubby).
    const blank = box.blank;
    const n = blank ? 1 : box.size;
    this.holeCenters = new Array(n).fill(0);
    this.holeNodes = new Array(n).fill(null);

    const cubby1 = this.textures.get(ONE.key);
    const cubbyr = this.textures.get(REST.key);
    const haveArt = !!cubby1 && cubby1 !== PIXI.Texture.WHITE && !!cubbyr && cubbyr !== PIXI.Texture.WHITE;

    const w1 = ONE.aspect * H;
    const wr = REST.aspect * H;
    const totalW = w1 + (n - 1) * wr;
    const left = -totalW / 2;
    this.spanLeft = left;
    this.spanW = totalW;

    // An ERASED box (Dusty) shows the blank blue studded panel (CUBBYB) — the
    // hole plates with no box walls/contents: a "any box of this size" wildcard.
    const cubbyb = this.textures.get('cubbyb');
    if (box.erased && cubbyb && cubbyb !== PIXI.Texture.WHITE) {
      const panel = new PIXI.Sprite(cubbyb);
      panel.width = totalW;
      panel.height = H;
      panel.position.set(left, -H / 2);
      this.container.addChild(panel);
      let hx = left;
      for (let i = 0; i < n; i++) {
        const spec = i === 0 ? ONE : REST;
        const pieceW = i === 0 ? w1 : wr;
        this.holeCenters[i] = hx + pieceW * spec.holeCx;
        hx += pieceW;
      }
      this.container.alpha = 1;
      return;
    }

    let x = left;
    for (let i = 0; i < n; i++) {
      const spec = i === 0 ? ONE : REST;
      const pieceW = i === 0 ? w1 : wr;

      if (haveArt) {
        const sprite = new PIXI.Sprite(i === 0 ? cubby1 : cubbyr);
        sprite.width = pieceW;
        sprite.height = H;
        sprite.position.set(x, -H / 2);
        this.container.addChild(sprite);
      } else {
        const cell = new PIXI.Graphics();
        cell.lineStyle(2, 0x2e6e8e, 1);
        cell.beginFill(0x9fd6e8, 1);
        cell.drawRect(x, -H / 2, pieceW, H);
        cell.endFill();
        cell.beginFill(0x3f7e96, 1); // recessed hole
        cell.drawRect(x + pieceW * (spec.holeCx - 0.28), -H * 0.3, pieceW * 0.56, H * 0.6);
        cell.endFill();
        this.container.addChild(cell);
      }

      const cx = x + pieceW * spec.holeCx;
      this.holeCenters[i] = cx;

      const occupant = blank ? null : box.contentsAt(i);
      if (occupant) {
        // Contents are RESHAPED to fill the hole opening (w and h independently),
        // like the original (cubby.cpp set_size_and_location); taken out, they
        // return to natural size (the extracted thing gets its own view).
        const node = renderThingDisplay(occupant, this.textures, this.theme, pieceW * (i === 0 ? 0.6 : 0.66), {
          stretch: true,
          maxHeight: H * 0.78,
        });
        node.position.set(cx, 0);
        this.container.addChild(node);
        this.holeNodes[i] = { node, x: cx, y: 0 };
      }
      x += pieceW;
    }
    this.container.alpha = blank ? 0.6 : 1; // a blank box reads as "not sized yet"
  }

  /**
   * Index of the hole whose **contents** the point actually lands on (the
   * rendered item's bounds, padded a little), or null. Used to decide grab-vs-
   * extract: clicking on an item pulls *it* out; clicking the box frame/walls/gaps
   * (or an empty hole) grabs the whole box — the original's topmost-sprite rule,
   * so a full box is still pick-up-able by its structure.
   */
  contentIndexAt(worldX: number, worldY: number): number | null {
    const localX = worldX - this.container.position.x;
    const localY = worldY - this.container.position.y;
    const pad = 5;
    for (let i = 0; i < this.holeNodes.length; i++) {
      const hn = this.holeNodes[i];
      if (!hn) continue;
      const lb = hn.node.getLocalBounds();
      const sx = Math.abs(hn.node.scale.x) || 1;
      const sy = Math.abs(hn.node.scale.y) || 1;
      const minX = hn.x + lb.x * sx - pad;
      const maxX = hn.x + (lb.x + lb.width) * sx + pad;
      const minY = hn.y + lb.y * sy - pad;
      const maxY = hn.y + (lb.y + lb.height) * sy + pad;
      if (localX >= minX && localX <= maxX && localY >= minY && localY <= maxY) return i;
    }
    return null;
  }

  /** True if a world-space point is within the box's bounding rectangle (used by
   * training to tell a take-out — released outside the box — from a hole→hole
   * drag, and a put-in — a floor thing dropped onto a hole). */
  withinBox(worldX: number, worldY: number): boolean {
    const localX = worldX - this.container.position.x;
    const localY = worldY - this.container.position.y;
    return (
      localX >= this.spanLeft &&
      localX <= this.spanLeft + this.spanW &&
      localY >= -H / 2 &&
      localY <= H / 2
    );
  }

  /** Index of the hole nearest a world-space point (within the box), or null. */
  holeIndexAt(worldX: number, worldY: number): number | null {
    const localX = worldX - this.container.position.x;
    const localY = worldY - this.container.position.y;
    if (localY < -H / 2 || localY > H / 2 || this.holeCenters.length === 0) return null;
    let best = 0;
    let bestD = Infinity;
    this.holeCenters.forEach((cx, i) => {
      const d = Math.abs(localX - cx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /**
   * Resolve a drop reference point to a hole or a side, the way the original
   * does (cubby.cpp `closest_hole`:2605 + `item_released_on_top`:462-491):
   *   - `closest_hole` maps x across the box: left of llx → -1, past the right
   *     edge → number_of_holes, else `(dx*n)/width` (y is ignored).
   *   - if it lands on a real hole → that hole (fill / combine / nest).
   *   - if it falls off an end: only a non-blank **box** dropped clear of the
   *     end concatenates (`add_to_side`); anything else "must have meant" the
   *     nearest end hole, so we clamp -1→0 and N→N-1.
   * `draggedIsBox` gates that box-only concatenation branch.
   */
  dropSlot(worldX: number, _worldY: number, draggedIsBox: boolean): { holeIndex: number | null; side: 'left' | 'right' } {
    const localX = worldX - this.container.position.x;
    return resolveDropSlot(localX, this.holeCenters.length, this.spanLeft, this.spanW, draggedIsBox);
  }

  /** The content node of a filled hole + its base position (for wiggle), or null. */
  holeNode(i: number): { node: PIXI.Container; x: number; y: number } | null {
    return this.holeNodes[i] ?? null;
  }

  /** Animate a just-dropped item shrinking from full size into the hole. */
  popHole(i: number): void {
    const hn = this.holeNodes[i];
    if (!hn) return;
    const fit = hn.node.scale.x;
    tweenScale(hn.node, fit * 1.9, fit); // ≈ full size → fit
  }
}
