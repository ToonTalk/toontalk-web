import { describe, it, expect } from 'vitest';
import { resolveDropSlot } from '../src/view/box-view';

// Faithful to cubby.cpp closest_hole:2605 + item_released_on_top:462-491.
// A 3-hole box centred at 0: left edge -150, width 300 → holes span dx [0,300).
const N = 3;
const LEFT = -150;
const W = 300;

describe('resolveDropSlot (closest_hole port)', () => {
  it('maps a point over a hole to that hole', () => {
    expect(resolveDropSlot(LEFT + 1, N, LEFT, W, false).holeIndex).toBe(0); // dx≈1 → hole 0
    expect(resolveDropSlot(LEFT + 150, N, LEFT, W, false).holeIndex).toBe(1); // middle → hole 1
    expect(resolveDropSlot(LEFT + 299, N, LEFT, W, false).holeIndex).toBe(2); // dx 299 → hole 2
  });

  it('clamps a non-box dropped off either end to the nearest end hole', () => {
    // closest_hole returns -1 / n; item_released_on_top "must have meant" the end hole.
    expect(resolveDropSlot(LEFT - 50, N, LEFT, W, false).holeIndex).toBe(0);
    expect(resolveDropSlot(LEFT + W + 50, N, LEFT, W, false).holeIndex).toBe(N - 1);
  });

  it('joins (side, no hole) when a box is dropped clear of an end', () => {
    // add_to_side fires only for a box past the end → holeIndex null + side.
    const left = resolveDropSlot(LEFT - 50, N, LEFT, W, true);
    expect(left).toEqual({ holeIndex: null, side: 'left' });
    const right = resolveDropSlot(LEFT + W + 50, N, LEFT, W, true);
    expect(right).toEqual({ holeIndex: null, side: 'right' });
  });

  it('nests (does not join) a box dropped squarely over a hole', () => {
    // A box whose centre is within the row goes into the hole, like any item.
    expect(resolveDropSlot(LEFT + 150, N, LEFT, W, true).holeIndex).toBe(1);
  });
});
