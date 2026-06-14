/**
 * Faithful translation of the original ToonTalk constants
 * (`constant.h`, `globals.cpp`, `block.cpp`). Units are `city_coordinate`;
 * `scale` is the original's zoom (`ground_scale` = 100 means one ideal-screen
 * unit per city unit — i.e. on the ground). See `docs/port.md`.
 *
 * This is the bottom of the port: everything else references it, so the values
 * here are verbatim from the source (line refs in comments), not derived by us.
 */

// --- constant.h ------------------------------------------------------------
export const IDEAL_SCREEN_WIDTH = 32000; // constant.h:326
export const IDEAL_SCREEN_HEIGHT = 24000; // constant.h:327
export const TILE_WIDTH = 1600; // constant.h:332
export const TILE_HEIGHT = 1200; // constant.h:333
export const GROUND_SCALE = 100; // constant.h:337  (100% = on the ground)
export const INITIAL_SCALE = 10 * GROUND_SCALE; // constant.h:338  (1000)
export const MILLI_WIDTH = IDEAL_SCREEN_WIDTH / 1000; // constant.h:683  (32)
export const MILLI_HEIGHT = IDEAL_SCREEN_HEIGHT / 1000; // constant.h:684  (24)

// --- globals.cpp -----------------------------------------------------------
export const CITY_SIZE = 10; // globals.cpp:263 tt_city_size — 10×10 blocks (×4 houses = 400 max)
export const HOUSES_TO_A_BLOCK = 4; // globals.cpp:524 tt_houses_to_a_block
export const DEFAULT_BLOCK_WIDTH = 4 * IDEAL_SCREEN_WIDTH; // globals.cpp:559 (128000)
export const MIN_FLYING_SCALE = GROUND_SCALE; // globals.cpp:562 tt_min_flying_scale → land

// --- block.cpp -------------------------------------------------------------
export const IDEAL_BLOCK_HEIGHT = IDEAL_SCREEN_WIDTH; // block.cpp:37 (32000)

// --- prgrmmr.cpp  Programmer_City_Flying ctor (3911, 3918) ------------------
export const MAX_X_SPEED = 2 * IDEAL_SCREEN_WIDTH; // ½ second to cross the screen
export const MAX_Y_SPEED = 2 * IDEAL_SCREEN_HEIGHT;
/** max_scale = max(cityW,cityH blocks)·125·houses_to_a_block (clamped so the city
 * never goes sub-pixel). The city extent comes from the city.cpp port. */
export function maxFlyingScale(cityWidthBlocks: number, cityHeightBlocks: number): number {
  return Math.max(Math.abs(cityWidthBlocks), Math.abs(cityHeightBlocks)) * 125 * HOUSES_TO_A_BLOCK;
}
