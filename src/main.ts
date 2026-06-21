/**
 * ToonTalk Web — Phase 1 bootstrap.
 *
 * Wires the pure model (World) to the view (Renderer + ThingViews), loads the
 * original art, seeds real ToonTalk objects (numbers, text, a box) plus a few
 * sprite placeholders, and resolves drops through the model. Model and view
 * stay in sync purely through World events.
 */

import { World } from './model/world';
import type { Thing } from './model/thing';
import { NumberThing } from './model/number';
import { TextThing } from './model/text';
import { Box } from './model/box';
import { Nest } from './model/nest';
import { Bird, hatchFromNest } from './model/bird';
import { Wand } from './model/wand';
import { Dusty } from './model/dusty';
import { Bomb } from './model/bomb';
import { Scale, recomputeScales } from './model/scale';
import { Robot, applyAction, teamMatch, teamPositions, type ConditionHole, type RobotAction } from './model/robot';
import { Truck } from './model/truck';
import { House, runHouse } from './model/house';
import { Notebook } from './model/notebook';
import { Pumpy } from './model/pumpy';
import { Trainer } from './model/trainer';
import { resolveDrop } from './model/interactions';
import { serialize, loadWorld } from './model/persistence';
import { saveMainNotebook, loadMainNotebook, clearMainNotebook } from './model/notebook-store';
import { Renderer } from './view/renderer';
import { ThingView } from './view/thing-view';
import { createThingView } from './view/view-factory';
import { renderThingDisplay } from './view/display';
import { floorCamera, FLOOR_W, FLOOR_H, clampFloorCamera } from './view/floor-camera';
import * as PIXI from 'pixi.js';
import { tlog, desc, toggleDebugPanel } from './debug-log';
import { BoxView } from './view/box-view';
import { loadAssets } from './view/assets';
import { Room, loadRoomTextures } from './view/room';
import { loadAnimations, playOnce, flyBird, hatchNest, tweenScale, runMouse } from './view/animation';
import { DragController } from './input/drag-controller';
import { InputTracker } from './input/input-state';
import { updateSensors } from './model/sensor-runtime';
import { makeSensor, SENSOR_TYPES } from './model/sensor';
import { CityScene } from './city/city-scene';
import { loadCityAssets } from './city/city-sprites';
import { BLOCK_W, BLOCK_H } from './city/city-model';
import { getRenderMode, themeFor, type RenderMode } from './config/render-mode';

/**
 * A human-readable build tag shown in the HUD so you can confirm a hard-refresh
 * actually picked up the latest code (vs. a cached page). Bump it whenever you
 * want a visible "this is the new version" marker.
 */
const BUILD = 'build 2026-06-20d (sprites no longer moth-eaten: flood-fill keying keeps interior dark pixels, a despeckle pass cleans dithered edges; hat/hair keep the neck)';

function setHud(text: string): void {
  const hud = document.getElementById('hud');
  if (hud) hud.textContent = text;
}

async function start(): Promise<void> {
  const mode: RenderMode = getRenderMode();
  const theme = themeFor(mode);
  // The floor starts faithful & near-empty: just Tooly's three tools. The full
  // element showcase is opt-in for development via ?demo=1.
  const demoMode = new URLSearchParams(location.search).get('demo') === '1';

  const renderer = new Renderer(theme);
  const container = document.getElementById('game-container');
  if (!container) throw new Error('#game-container missing');
  container.appendChild(renderer.view);

  setHud('Loading ToonTalk graphics…');
  const { textures } = await loadAssets(theme);
  await loadAnimations(theme);

  // The ToonTalk room: tan floor, toolbox, notebook, tools, and the hand cursor.
  // Clicking a toolbox/tool icon pulls a fresh element onto the floor.
  const roomTextures = await loadRoomTextures(theme);
  // The model registry is created BEFORE the room so the room's toolExists check
  // (which hides a tool's Tooly chip once it's out) can read it during its first
  // chrome layout.
  const world = new World();
  (window as unknown as { __ttWorld?: unknown }).__ttWorld = world;
  // Picking a tool out of Tooly puts it straight into the hand (like the
  // original); picking an element drops it on the floor to drag.
  const room = new Room(renderer, roomTextures, textures, theme, (key, x, y) => {
    // Tools (wand/Dusty/Pumpy) are SINGLE instances — Tooly has one of each, not
    // an infinite stack like number/text/box. So picking one up grabs the one
    // that's already out instead of spawning a copy (which would pile up and let
    // a held wand copy a stray one).
    if (key === 'wand' || key === 'dusty' || key === 'pumpy') {
      const existing = world.all().find((t) => t.kind === key);
      if (existing) {
        tlog(`toolbox pick: ${key} → held the existing ${desc(existing)}`);
        dragController.holdTool(existing);
        return;
      }
    }
    const made = spawnTool(key, x, y);
    tlog(`toolbox pick: ${key}${made ? ' → ' + desc(made) : ' (failed)'}`);
    if (!made) return;
    const v = views.get(made.id);
    // Clicking ANYTHING in Tooly: it expands (grows from small) and ends up in
    // the hand — held — like the original. You then move and drop it where you
    // want. (No bam-mouse here; that's only for *combining* things.)
    if (v) tweenScale(v.container, 0.2, 1, 280);
    dragController.holdTool(made);
  }, (kind) => world.all().some((t) => t.kind === kind));
  (window as unknown as { __ttRoom?: unknown }).__ttRoom = room;
  window.addEventListener('resize', () => room.resize());

  // Replace the OS cursor with ToonTalk's hand, which tracks the pointer.
  const cursorStyles = renderer.app.renderer.events.cursorStyles;
  cursorStyles.default = 'none';
  cursorStyles.grab = 'none';
  cursorStyles.grabbing = 'none';
  cursorStyles.pointer = 'none';
  renderer.view.style.cursor = 'none';
  renderer.app.stage.on('pointermove', (e) => room.setHand(e.global.x, e.global.y));

  // Debug hook: lets tools pause the render loop to capture a still of the
  // (otherwise continuously animating) canvas. Harmless in production.
  (window as unknown as { __ttApp?: unknown }).__ttApp = renderer.app;

  // Model <-> view bookkeeping. (`world` is created above, before the room.)
  const views = new Map<string, ThingView>();

  // Tools are single floor instances; when one is out (or removed) the Tooly chip
  // for it is hidden (or restored) — so there's never a chip plus a floor copy.
  const isToolKind = (k: string): boolean => k === 'wand' || k === 'dusty' || k === 'pumpy';
  world.subscribe((event) => {
    switch (event.type) {
      case 'added': {
        const view = createThingView(event.thing, textures, theme);
        view.container.name = event.thing.kind; // debug aid (identify layer children)
        views.set(event.thing.id, view);
        renderer.thingLayer.addChild(view.container);
        if (isToolKind(event.thing.kind)) room.relayout(); // a tool is out → hide its Tooly chip
        break;
      }
      case 'moved': {
        views.get(event.thing.id)?.syncPosition();
        // A team lead drags its line of teammates along (they keep formation).
        const moved = event.thing;
        if (moved instanceof Robot && moved.team.length > 0) {
          for (const p of teamPositions(moved)) {
            if (p.robot.id !== moved.id) world.moveThing(p.robot.id, { x: p.x, y: p.y });
          }
        }
        break;
      }
      case 'changed':
        views.get(event.thing.id)?.refresh();
        break;
      case 'removed': {
        const view = views.get(event.id);
        if (view) {
          const kind = view.thing.kind;
          view.destroy();
          views.delete(event.id);
          if (isToolKind(kind)) room.relayout(); // the tool's gone → its Tooly chip returns
        }
        break;
      }
    }
  });

  const trainer = new Trainer(world);

  // Drive the hand cursor's pose by what it's holding: the wand → holding-wand
  // (and the floor wand is hidden, since it's now in the cursor), any other
  // thing → grab, nothing → point.
  let carriedWand: ThingView | undefined;
  // True while a TOOL (wand/Dusty/Pumpy) is in hand — drives the floor active-
  // point reticle so it's clear where the tool's tip will act (it was invisible
  // on the floor, so tools kept missing).
  let holdingTool = false;
  // A robot iterating on the floor: drop a box on a trained robot and it runs
  // over and over, stopping when the box stops matching its thought bubble. We
  // track it so grabbing the robot (or its box) mid-run stops it — the manual
  // "pick it up to stop" escape hatch.
  let runningLoop: { robotId: string; boxId: string; cancelled: boolean; unsub?: () => void } | null = null;
  function cancelRunningLoop(): void {
    if (runningLoop) {
      runningLoop.cancelled = true;
      runningLoop.unsub?.(); // drop any wait-for-change subscription
      const box = world.get(runningLoop.boxId);
      runningLoop = null;
      // Re-render the box so any hole node hidden mid-gesture (a thing shown
      // flying as a ghost) is restored — otherwise interrupting a swap/move by
      // grabbing the robot leaves the box looking empty.
      if (box) world.notifyChanged(box);
    }
  }
  const onGrab = (thing: Thing | null): void => {
    tlog(thing ? `grab: ${desc(thing)}` : 'release (hand empty)');
    holdingTool = !!thing && (thing.kind === 'wand' || thing.kind === 'dusty' || thing.kind === 'pumpy');
    if (!holdingTool && !thoughtState) activePoint.visible = false; // dropped a tool on the floor
    // Picking up a running robot (or the box it's working on) stops it.
    if (thing && runningLoop && (thing.id === runningLoop.robotId || thing.id === runningLoop.boxId)) {
      cancelRunningLoop();
      tlog('run: stopped (picked up)');
      setHud('✋ You picked it up — the robot stopped.');
    }
    // Stopped carrying the wand → un-hide its sprite (the holdwand pose drew it
    // while carried). Without this the wand vanished when picked up and dropped.
    if (carriedWand && !(thing instanceof Wand && views.get(thing.id) === carriedWand)) {
      if (!carriedWand.container.destroyed) carriedWand.container.alpha = 1;
      carriedWand = undefined;
    }
    if (thing instanceof Wand) {
      room.setPose('holdwand');
      carriedWand = views.get(thing.id);
      if (carriedWand) carriedWand.container.alpha = 0;
    } else if (thing) {
      room.setPose('grab');
      // Discoverability: a fresh robot gives no clue how to teach it. Prompt the
      // gesture while it's in hand (matches interactions.ts: an untrained robot
      // dropped on a box starts a training session).
      if (thing instanceof Robot && thing.actions.length === 0 && thing.team.length === 0) {
        // robot.htm: "To train a robot, just drop a box on him… he'll remember
        // everything… press Esc when finished… use Dusty to suck things out of
        // the box to generalise."
        setHud(
          '🤖 Untrained robot. To TRAIN it, drop a box on it — it watches and remembers what you do.\n' +
            'DEMONSTRATE (it counts holes from the left): combine holes, drag a thing OUT of the box, or a floor thing INTO a hole.\n' +
            'Esc = done (it learns it) · Backspace = cancel · erase a hole first with Dusty so it matches any value.',
        );
      }
    } else {
      room.setPose('open');
    }
  };

  const dragController = new DragController(
    world,
    renderer,
    views,
    (dragged, target, ctx) => {
      // A trained robot meeting a matching box REPLAYS its actions step-by-step
      // (watch it work), instead of resolveDrop applying the instant outcome.
      const rbt = dragged instanceof Robot ? dragged : target instanceof Robot ? target : null;
      const bx = dragged instanceof Box ? dragged : target instanceof Box ? target : null;
      // A box given to a teammate runs the whole team (via its lead).
      const lead = rbt ? rbt.leader ?? rbt : null;
      if (lead && bx) {
        // Start the team if the box matches OR is merely incomplete (it'll wait
        // and resume); only a true mismatch falls through to a plain drop.
        const { state } = teamMatch(lead, bx);
        if (state === 'match' || state === 'wait') {
          tlog(`run: robot starts on ${desc(bx)} (${state})`);
          animateRun(lead, bx);
          return;
        }
        // A TRAINED robot the box doesn't fit: redden the holes that don't match
        // its rule (the rest keep their colour). An UNTRAINED robot has no rule,
        // so it falls through to start a training session instead.
        const trained = lead.lineup().find((r) => r.actions.length > 0);
        if (trained) {
          const bvm = views.get(bx.id);
          if (bvm instanceof BoxView) bvm.tintMismatch(trained.holeStates(bx));
          tlog(`run: box doesn't match ${desc(trained)} — reddening the holes that don't fit`);
          setHud("✋ That box doesn't match the robot's rule — the reddish holes are the parts that don't fit.");
          return; // the box stays where it was dropped, showing the red feedback
        }
      }
      // Combining/joining two things WAITS for Bammer: they don't merge until the
      // hammer comes down (the result lands ON the strike, not before — boxes
      // shouldn't snap together and only then get hammered). Covers number+number,
      // text+text / number→text, and a box dropped on the SIDE of another box —
      // all of which always combine/join, so deferring the mutation is safe.
      if (
        target &&
        target.id !== dragged.id &&
        ((dragged instanceof Box && target instanceof Box && ctx.holeIndex == null) ||
          (target instanceof NumberThing && dragged instanceof NumberThing) ||
          (target instanceof TextThing && (dragged instanceof TextThing || dragged instanceof NumberThing)))
      ) {
        const dD = desc(dragged);
        const tD = desc(target);
        bamMouseAt(target, () => {
          const r = resolveDrop(world, dragged, target, ctx);
          tlog(`drop: ${dD} → ${tD} : ${r} (on hammer strike)`);
          updateHud(r);
        });
        return;
      }
      const dDesc = desc(dragged);
      const tDesc = desc(target); // describe BEFORE the drop mutates values
      const result = resolveDrop(world, dragged, target, ctx);
      tlog(`drop: ${dDesc} → ${tDesc}${ctx.holeIndex != null ? ` hole ${ctx.holeIndex}` : ''} : ${result}`);
      // One-shot effects at the action site.
      if (result === 'exploded') {
        playOnce('explode', renderer.thingLayer, dragged.x, dragged.y);
      } else if (result === 'erased' || result === 'sucked') {
        const at = target ?? dragged;
        playOnce('dusty-suck', renderer.thingLayer, at.x, at.y);
      } else if ((result === 'filled' || result === 'combined') && target instanceof Box && ctx.holeIndex != null) {
        // The dropped item shrinks to fit the hole.
        const bv = views.get(target.id);
        if (bv instanceof BoxView) bv.popHole(ctx.holeIndex);
      } else if (result === 'delivered' && target instanceof Bird && target.nests.length > 0) {
        // The bird flies the gift to its nest(s) and back.
        const nest0 = target.nests[0]!;
        flyBird(renderer.thingLayer, target.x, target.y, nest0.x, nest0.y,
          views.get(target.id)?.container);
        for (const nest of target.nests.slice(1)) {
          flyBird(renderer.thingLayer, target.x, target.y, nest.x, nest.y);
        }
      }
      // The bam-mouse also runs in when two pieces of data are combined —
      // arithmetic, text concat, box join/hole-combine (call_in_a_mouse).
      if (
        (result === 'combined' || result === 'joined') &&
        (target instanceof NumberThing || target instanceof TextThing || target instanceof Box)
      ) {
        bamMouseAt(target);
      }
      if (result === 'train') {
        const robot = (dragged instanceof Robot ? dragged : target) as Robot;
        const box = dragged instanceof Box ? dragged : (target as Box);
        enterThoughts(robot, box); // step inside the robot's thoughts (trains on a copy)
      }
      updateHud(result);
      // Faithful abort hint: a bomb does nothing unless used on a house
      // ("bombs only work inside houses", bomb.cpp:104). Fire on any non-explode
      // outcome — a loose thing OR the bare floor — so the user learns why it did
      // nothing (the main floor has no houses to recycle).
      if (dragged instanceof Bomb && result === 'none') {
        setHud('💣 Bombs only work on a house — they recycle a finished one (terminate the process). The bare floor has no house to blow up; use Dusty to remove a loose thing.');
      }
    },
    trainer,
    (gesture) => {
      const box = trainer.box;
      let ok = false;
      if (gesture.kind === 'combine') {
        const merging = !!box && !box.isHoleEmpty(gesture.to); // filled target → a real merge
        ok = trainer.recordCombine(gesture.from, gesture.to);
        if (ok && merging && box) bamMouseAt(box);
      } else if (gesture.kind === 'remove') {
        ok = trainer.recordRemove(gesture.from);
      } else if (gesture.kind === 'insert') {
        const merging = !!box && !box.isHoleEmpty(gesture.to);
        ok = trainer.recordInsert(gesture.to, gesture.source);
        if (ok) {
          world.remove(gesture.source.id); // the carried thing goes INTO the box
          if (merging && box) bamMouseAt(box);
        }
      } else if (gesture.kind === 'copy') {
        const merging = !!box && !box.isHoleEmpty(gesture.to); // copy onto a full hole → merge
        ok = trainer.recordCopy(gesture.from, gesture.to);
        if (ok && merging && box) bamMouseAt(box);
      }
      const g =
        gesture.kind === 'insert' ? `insert ${desc(gesture.source)} → hole ${gesture.to}`
        : gesture.kind === 'combine' ? `combine hole ${gesture.from}→${gesture.to}`
        : gesture.kind === 'copy' ? `copy hole ${gesture.from}→${gesture.to}`
        : `remove hole ${gesture.from}`;
      tlog(`train gesture: ${g} → ${ok ? 'recorded' : 'no-op'} (${trainer.stepCount} steps)`);
      updateHud('train');
    },
    textures,
    theme,
    onGrab,
  );
  (window as unknown as { __ttDrag?: unknown }).__ttDrag = dragController;

  // Houses are running processes: each tick, every house offers its box to its
  // robot team and the first matching robot runs (so a house keeps reacting).
  setInterval(() => {
    for (const t of world.all()) if (t instanceof House) runHouse(world, t);
  }, 800);

  // The outdoor city: fly the helicopter, land it, walk around. The app boots
  // into the city; the room (inside a house) is the existing World view.
  // Walking up to a house and entering it is a later step — for now the
  // backquote (`) key is a dev seam to flip between the city and the room so
  // both stay reachable and testable.
  const cityAssets = await loadCityAssets(theme);
  const city = new CityScene(renderer, cityAssets, {
    // Walking up to a house door, or sitting on the grass ('s'), drops you onto
    // a working floor — the room/World view. (Distinct per-house contents is a
    // later step; for now every house + the grass share the one floor.)
    onEnter: (where, house) =>
      enterRoom(where === 'house' ? (house?.style ?? 'a') : 'c', city.model.ix, city.model.iy),
    // Escape in the room/city raises the exit-or-minimize dialog.
    onEscape: () => showExitDialog(),
    // The room standing view shows the working floor's things in miniature, at
    // their floor positions (normalised to the canvas the floor view fills).
    floorItems: () => {
      // Positions are normalised to the whole (large) floor, so the room view
      // shows the entire work area in miniature and you can sit anywhere on it.
      return world.all().map((t) => ({
        fx: Math.max(0.02, Math.min(0.98, t.x / FLOOR_W)),
        fy: Math.max(0.05, Math.min(0.98, t.y / FLOOR_H)),
        node: renderThingDisplay(t, textures, theme, 64),
      }));
    },
  });
  (window as unknown as { __ttCity?: unknown }).__ttCity = city;

  // Sensors: one input tracker feeds a per-frame snapshot to every sensor pad in
  // the world. handVisible follows the room hand (hidden while flying the city);
  // the address comes from the current city block.
  const input = new InputTracker(renderer.view, () => renderer.width, () => renderer.height);
  input.handVisible = () => !city.isActive;
  input.address = () => ({
    road: Math.max(0, Math.floor(city.model.cx / BLOCK_W)),
    street: Math.max(0, Math.floor(city.model.cy / BLOCK_H)),
  });
  (window as unknown as { __ttInput?: unknown }).__ttInput = input;
  renderer.app.ticker.add(() => updateSensors(world, input.sample(renderer.app.ticker.deltaMS)));

  const CITY_HUD =
    `ToonTalk City — fly · land · walk\n` +
    `click the city to take the controls (the mouse is captured; Esc = menu)\n` +
    `mouse / arrow keys steer · left button / ↓ descends · right button / Shift / ↑ climbs\n` +
    `street: walk any direction (every street) · up to a door enters the house · click or 's' sits on the grass\n` +
    `in the room: click (or walk to the front / 's') to sit & work · Esc steps back out\n` +
    `walk into the parked copter to take off · H calls the helicopter · Esc = leave menu`;

  /** Show the city (street/flying); hide the room/World and its input. */
  function showCity(): void {
    tlog('scene: CITY (flying)');
    city.setActive(true);
    room.setVisible(false);
    renderer.thingLayer.visible = false;
    dragController.setEnabled(false);
    setHud(CITY_HUD);
  }
  /** Point the floor camera at a spot on the big floor (top-left = world point),
   * clamped to the walls; pan the things + baseplate, leave the toolbox on
   * screen. */
  function setFloorCamera(camX: number, camY: number): void {
    const c = clampFloorCamera(camX, camY, renderer.width, renderer.height);
    floorCamera.x = c.x;
    floorCamera.y = c.y;
    renderer.thingLayer.position.set(-c.x, -c.y);
    room.setFloorPan(c.x, c.y);
  }
  (window as unknown as { __ttSetFloorCamera?: unknown }).__ttSetFloorCamera = setFloorCamera;
  /** Sit down — switch to the working floor (room/World view), with the floor
   * coloured to match the house you entered (grass uses the default tan), and
   * the floor scrolled so where you sat (`sitFx`,`sitFy` ∈ 0..1 of the whole
   * floor) is centred — the toolbox stays at hand, things stay where you left
   * them. */
  function enterRoom(style: 'a' | 'b' | 'c' = 'a', sitFx = 0.5, sitFy = 0.5): void {
    tlog(`scene: FLOOR (style ${style})`);
    room.setFloorStyle(style);
    setFloorCamera(sitFx * FLOOR_W - renderer.width / 2, sitFy * FLOOR_H - renderer.height / 2);
    city.setActive(false);
    room.setVisible(true);
    renderer.thingLayer.visible = true;
    dragController.setEnabled(true);
    room.playSitDown(); // Tooly pops open and the tools rise out of it into place
    // The notebook lives in Tooly too — it rises out after the three tools and
    // settles bottom-centre by the sit spot, where the original keeps it
    // (set_sit_corner: the toolbox + notebook follow you when you sit down).
    const nbv = views.get(mainNotebook.id);
    if (nbv) {
      mainNotebook.x = sitFx * FLOOR_W;
      mainNotebook.y = sitFy * FLOOR_H + renderer.height * 0.28;
      riseFromTooly(nbv, 300 + 3 * 340);
    }
    updateHud('none');
  }
  /** Animate a real floor thing (the notebook) rising out of Tooly (top-right,
   * screen-fixed → world coords) and growing into its place — matching the tools. */
  function riseFromTooly(view: ThingView, delay: number): void {
    const tx = view.thing.x;
    const ty = view.thing.y;
    const ox = renderer.width - 270 + floorCamera.x; // Tooly's tray, in world coords
    const oy = 255 + floorCamera.y;
    const sX = view.thing.scaleX;
    const sY = view.thing.scaleY;
    const ms = 820;
    const start = performance.now() + delay;
    const c = view.container;
    c.visible = false;
    const tick = (): void => {
      if (c.destroyed) { renderer.app.ticker.remove(tick); return; }
      const now = performance.now();
      if (now < start) return;
      c.visible = true;
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3); // ease-out
      c.position.set(ox + (tx - ox) * e, oy + (ty - oy) * e);
      c.scale.set(sX * (0.2 + 0.8 * e), sY * (0.2 + 0.8 * e));
      if (t >= 1) { renderer.app.ticker.remove(tick); c.position.set(tx, ty); c.scale.set(sX, sY); }
    };
    renderer.app.ticker.add(tick);
  }
  /** Stand up from the floor and walk the street again (clear of the door). */
  function returnToStreet(): void {
    city.resume();
    room.setVisible(false);
    renderer.thingLayer.visible = false;
    dragController.setEnabled(false);
    setHud(CITY_HUD);
  }
  // Dev seam: backquote flips city ⇄ room directly.
  window.addEventListener('keydown', (ev) => {
    if (ev.key === '`') (city.isActive ? enterRoom() : returnToStreet());
  });

  // --- the Escape menus (leave / save / cancel) ---------------------------
  /** A simple modal overlay of buttons (the street / sitting menu). */
  interface MenuOption {
    label: string;
    onClick: () => void;
  }
  function menuOpen(): boolean {
    return document.getElementById('tt-menu') != null;
  }
  function showMenu(title: string, options: MenuOption[]): void {
    if (menuOpen()) return;
    const overlay = document.createElement('div');
    overlay.id = 'tt-menu';
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.45);z-index:9999;font-family:sans-serif';
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#2b3037;color:#fff;border:2px solid #565e69;border-radius:12px;' +
      'padding:22px 26px;min-width:220px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'font-weight:bold;font-size:18px;margin-bottom:16px';
    panel.appendChild(h);
    const close = (): void => overlay.remove();
    for (const opt of options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.style.cssText =
        'display:block;width:100%;margin:8px 0;padding:10px 14px;font-size:15px;' +
        'background:#474e57;color:#fff;border:1px solid #6b7280;border-radius:7px;cursor:pointer';
      b.onmouseenter = () => (b.style.background = '#5a626c');
      b.onmouseleave = () => (b.style.background = '#474e57');
      b.onclick = () => {
        close();
        opt.onClick();
      };
      panel.appendChild(b);
    }
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(); // click outside = cancel
    });
    document.body.appendChild(overlay);
  }

  type Head = 'none' | 'hair' | 'hat';
  function currentHead(): Head {
    const v = localStorage.getItem('tt-head');
    return v === 'hair' || v === 'hat' ? v : 'none';
  }
  /** Settings panel. First (and for now only) setting is "Your head" — the
   * original starttt.exe head choice (plain / purple-hair girl / red-cap boy),
   * applied live to your avatar and remembered. */
  function showSettings(): void {
    if (menuOpen()) return;
    const overlay = document.createElement('div');
    overlay.id = 'tt-menu';
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.45);z-index:9999;font-family:sans-serif';
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#2b3037;color:#fff;border:2px solid #565e69;border-radius:12px;' +
      'padding:22px 26px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    const title = document.createElement('div');
    title.textContent = 'Settings';
    title.style.cssText = 'font-weight:bold;font-size:18px;margin-bottom:4px';
    const sub = document.createElement('div');
    sub.textContent = 'Your head — click to choose';
    sub.style.cssText = 'font-size:13px;opacity:.75;margin-bottom:14px';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:14px;justify-content:center';
    panel.append(title, sub, row);
    const tiles: Partial<Record<Head, HTMLElement>> = {};
    const highlight = (key: Head): void => {
      for (const k of Object.keys(tiles) as Head[])
        tiles[k]!.style.borderColor = k === key ? '#5ad6ff' : 'transparent';
    };
    const choose = (key: Head): void => {
      localStorage.setItem('tt-head', key);
      city.setHead(key);
      highlight(key);
    };
    for (const { key, label } of [
      { key: 'hair', label: 'Hair' },
      { key: 'hat', label: 'Cap' },
      { key: 'none', label: 'Plain' },
    ] as { key: Head; label: string }[]) {
      const tile = document.createElement('button');
      tile.style.cssText =
        'display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;' +
        'background:#3a4048;border:3px solid transparent;border-radius:10px;cursor:pointer;color:#fff';
      const img = document.createElement('img');
      img.src = `/assets/city/head-${key}.png`;
      img.style.cssText = 'width:74px;height:74px;object-fit:contain';
      const cap = document.createElement('div');
      cap.textContent = label;
      cap.style.fontSize = '13px';
      tile.append(img, cap);
      tile.onclick = () => choose(key);
      tiles[key] = tile;
      row.appendChild(tile);
    }
    const done = document.createElement('button');
    done.textContent = 'Done';
    done.style.cssText =
      'margin-top:16px;padding:9px 22px;font-size:15px;background:#474e57;color:#fff;' +
      'border:1px solid #6b7280;border-radius:7px;cursor:pointer';
    done.onclick = () => overlay.remove();
    panel.appendChild(done);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    highlight(currentHead());
  }

  function exitToonTalk(): void {
    document.getElementById('save-btn')?.click(); // save first, so nothing's lost
    try { window.close(); } catch { /* not script-opened */ }
    // Browsers won't let a page close a tab it didn't open — show a goodbye.
    window.setTimeout(() => {
      if (!menuOpen()) showMenu('Thanks for playing ToonTalk! 👋', [
        { label: 'Close this tab to exit — or keep playing', onClick: () => {} },
      ]);
    }, 140);
  }
  function minimizeTab(): void {
    // A web page can't minimize its own browser tab; blur is the closest it can do.
    try { window.blur(); } catch { /* ignore */ }
  }
  /** In the room/city, Escape asks whether to leave: exit ToonTalk or minimize.
   * Inside a house it also offers to step back out to the street. */
  function showExitDialog(): void {
    const inside = city.isActive && city.model.mode === 'inside';
    showMenu('Leave ToonTalk?', [
      ...(inside ? [{ label: 'Leave this room', onClick: () => city.model.leaveRoom() }] : []),
      { label: 'Exit', onClick: exitToonTalk },
      { label: 'Minimize the tab', onClick: minimizeTab },
      { label: 'Save', onClick: () => document.getElementById('save-btn')?.click() },
      { label: 'Keep exploring', onClick: () => {} },
    ]);
  }
  // Escape on the FLOOR (working view) always stands you up. (The city raises the
  // exit-or-minimize dialog via its own onEscape, below; training handles Esc itself.)
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !city.isActive && !trainer.active && !menuOpen()) {
      ev.preventDefault();
      returnToStreet(); // stand up
    }
  });

  // A trained robot REPLAYS its actions step-by-step on a matching box (you
  // watch it work), rather than the box jumping to the final result. Bammer
  // shows up on each combine, like a live demonstration.
  function animateRun(lead: Robot, box: Box): void {
    cancelRunningLoop(); // never two loops on one box
    const loop: { robotId: string; boxId: string; cancelled: boolean; unsub?: () => void } = {
      robotId: lead.id,
      boxId: box.id,
      cancelled: false,
    };
    runningLoop = loop;
    const lineup = lead.lineup();
    // Each member's resting (lined-up) position, so they can return after a pass.
    const home = new Map(lineup.map((r) => [r.id, { x: r.x, y: r.y }]));
    let actor: Robot | null = null; // the member currently up at the box, working

    // Walk ANY member to a world point (eased); stops if the loop is cancelled
    // (you grabbed something) or that robot is gone. `onStep` runs each frame
    // (after the move) so anything held — a tool, a carried copy — can track it.
    const walkRobot = (
      r: Robot,
      to: { x: number; y: number },
      ms: number,
      done: () => void,
      onStep?: () => void,
    ): void => {
      const from = { x: r.x, y: r.y };
      const t0 = performance.now();
      const tick = (): void => {
        if (loop.cancelled || !world.get(r.id)) { renderer.app.ticker.remove(tick); return; }
        const t = Math.min(1, (performance.now() - t0) / ms);
        const e = t * (2 - t); // ease-out
        world.moveThing(r.id, { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
        onStep?.();
        if (t >= 1) { renderer.app.ticker.remove(tick); done(); }
      };
      renderer.app.ticker.add(tick);
    };

    // Put the whole team back in its line (after the run stops / suspends).
    const returnToLine = (): void => {
      for (const r of lineup) {
        const h = home.get(r.id);
        if (h && world.get(r.id)) world.moveThing(r.id, h);
      }
    };

    // One pass for the MATCHING member: replay its actions, then loop again while
    // the box still matches (a robot is a guarded rule that keeps firing). The
    // self-copy source is the LEAD ("a copy of himself and his teammates").
    const runActions = (runner: Robot): void => {
      const actions = runner.actions;
      let i = 0;
      const step = (): void => {
        if (loop.cancelled) return;
        if (i >= actions.length) {
          recomputeScales(box);
          world.notifyChanged(box);
          setTimeout(iterate, 450); // pass done → keep iterating while it matches
          return;
        }
        const action = actions[i++]!;
        const merging =
          action.type === 'combine' || (action.type === 'insert' && !box.isHoleEmpty(action.to));
        let applied = false;
        const apply = (): void => {
          if (applied || loop.cancelled) return; // a grab mid-swing freezes it exactly
          applied = true;
          applyAction(box, action, { robot: lead }); // lead = self-copy source
          recomputeScales(box);
          world.notifyChanged(box);
        };
        // An INSERT re-enacts training: the RUNNER walks to Tooly, picks up a FRESH
        // copy, carries it to the box and drops it (robot.htm — a "new" thing comes
        // from the toolbox each run); its body walks, the fresh element flies, then
        // it walks back.
        if (action.type === 'insert') {
          const back = { x: runner.x, y: runner.y };
          const src = toolboxSource();
          const target = holeWorld(box, action.to);
          walkRobot(runner, { x: src.x - 70, y: src.y + 60 }, 380, () => {
            const fresh = renderThingDisplay(action.thing, textures, theme, 46);
            fresh.position.set(src.x, src.y);
            fresh.zIndex = 6000;
            renderer.thingLayer.addChild(fresh);
            flyThing(fresh, target, 460, () => {
              if (merging) bamMouseAt(box, apply); // dropped onto a number → combine
              else apply(); // dropped into an empty hole → just lands
            });
            walkRobot(runner, { x: target.x + 130, y: target.y - 10 }, 460, () => {
              setTimeout(() => { apply(); walkRobot(runner, back, 380, step); }, merging ? 1350 : 250);
            });
          });
          return;
        }
        // combine / move / copy are re-enacted by the robot WALKING over the source
        // hole, PICKING UP the thing (its hand for combine/move; its own magic WAND,
        // held in hand, for copy), CARRYING it to the target hole and DROPPING it.
        // Bammer hammers it in if that hole is full, and the model change
        // (applyAction) lands on the strike.
        const overHole = (i: number): { x: number; y: number } => ({ x: holeWorld(box, i).x, y: holeWorld(box, i).y + 64 });
        const carryGesture = (from: number, to: number, take: boolean, merge: boolean, useWand: boolean): void => {
          const c = box.contentsAt(from);
          const src = c instanceof Nest ? c.front() : c; // the carried thing (through a nest)
          if (!src) { apply(); setTimeout(() => { if (!loop.cancelled) step(); }, 250); return; }
          const back = { x: runner.x, y: runner.y };
          const bvc = views.get(box.id);
          const fromNode = take && bvc instanceof BoxView ? bvc.holeNode(from) : null;
          let wand: ReturnType<typeof renderThingDisplay> | null = null;
          let carried: ReturnType<typeof renderThingDisplay> | null = null;
          const handWand = (): void => { if (wand && !wand.destroyed) wand.position.set(runner.x + 14, runner.y - 52); };
          const handCarried = (): void => { if (carried && !carried.destroyed) carried.position.set(runner.x - 2, runner.y - 30); };
          const cleanup = (): void => {
            if (wand && !wand.destroyed) wand.destroy();
            if (carried && !carried.destroyed) carried.destroy();
          };
          // If the robot is grabbed / the box or robot goes away mid-gesture, drop
          // everything held (no orphaned sprites).
          const watch = (): void => {
            if (loop.cancelled || !world.get(runner.id) || !world.get(box.id)) { renderer.app.ticker.remove(watch); cleanup(); }
          };
          renderer.app.ticker.add(watch);
          const finish = (): void => { renderer.app.ticker.remove(watch); if (wand && !wand.destroyed) wand.destroy(); };

          const carryAcross = (): void => {
            walkRobot(runner, overHole(from), 520, () => {
              if (fromNode) fromNode.node.visible = false; // taken out of the hole (combine/move)
              carried = renderThingDisplay(src, textures, theme, 46);
              carried.zIndex = 6000;
              renderer.thingLayer.addChild(carried);
              if (useWand) { carried.position.set(holeWorld(box, from).x, holeWorld(box, from).y); tweenScale(carried, 0.3, 1, 240); } // a copy pops out under the wand
              else handCarried();
              setTimeout(() => {
                if (loop.cancelled) return;
                walkRobot(runner, overHole(to), 520, () => {
                  if (carried && !carried.destroyed) carried.destroy();
                  carried = null;
                  if (merge) bamMouseAt(box, apply); else apply(); // drop it (Bammer hammers if full)
                  setTimeout(() => {
                    finish();
                    if (loop.cancelled) return;
                    apply();
                    walkRobot(runner, back, 440, step); // walk home, then wait + repeat
                  }, merge ? 1400 : 260);
                }, () => { handWand(); handCarried(); });
              }, useWand ? 320 : 140);
            }, useWand ? handWand : undefined);
          };

          if (useWand) {
            // The robot already holds its own wand (its copier) — it appears in
            // hand; no trek to a wand on the floor (robot.cpp: a robot keeps its
            // initial_tool). It just copies in place at the box.
            wand = renderThingDisplay(new Wand(), textures, theme, 64);
            wand.zIndex = 6500;
            renderer.thingLayer.addChild(wand);
            handWand();
          }
          carryAcross();
        };
        if (action.type === 'combine') return carryGesture(action.from, action.to, true, true, false);
        if (action.type === 'move') return carryGesture(action.from, action.to, true, false, false);
        if (action.type === 'copy') return carryGesture(action.from, action.to, false, !box.isHoleEmpty(action.to), true);

        // REMOVE: the robot TAKES the thing out and tosses it away — a ghost lifts
        // from the hole and flies off, shrinking, as the hole empties.
        if (action.type === 'remove') {
          const c = box.contentsAt(action.hole);
          const src = c instanceof Nest ? c.front() : c;
          if (src) {
            const bvc = views.get(box.id);
            const fromNode = bvc instanceof BoxView ? bvc.holeNode(action.hole) : null;
            const p = holeWorld(box, action.hole);
            const ghost = renderThingDisplay(src, textures, theme, 46);
            ghost.position.set(p.x, p.y);
            ghost.zIndex = 6000;
            renderer.thingLayer.addChild(ghost);
            if (fromNode) fromNode.node.visible = false; // taken out
            tweenScale(ghost, 1, 0.25, 650); // shrink as it's tossed away
            flyThing(ghost, { x: p.x + 210, y: p.y - 190 }, 650, () => apply());
            setTimeout(() => { if (!loop.cancelled) { apply(); step(); } }, 700);
            return;
          }
          apply();
          setTimeout(() => { if (!loop.cancelled) step(); }, 240);
          return;
        }

        // SWAP: the robot steps up to the box, the two things trade places (a ghost
        // of each flies to the other's hole, crossing over), the exchange
        // (applyAction) lands when they arrive, then the robot walks home and
        // repeats — so it visibly re-enacts, like combine/move.
        if (action.type === 'swap') {
          const bvc = views.get(box.id);
          const ca = box.contentsAt(action.a);
          const cb = box.contentsAt(action.b);
          const sa = ca instanceof Nest ? ca.front() : ca;
          const sb = cb instanceof Nest ? cb.front() : cb;
          const back = { x: runner.x, y: runner.y };
          const mid = { x: (holeWorld(box, action.a).x + holeWorld(box, action.b).x) / 2, y: holeWorld(box, action.a).y + 64 };
          const home = (): void => walkRobot(runner, back, 380, () => { setTimeout(() => { if (!loop.cancelled) step(); }, 140); });
          walkRobot(runner, mid, 460, () => {
            let pending = (sa ? 1 : 0) + (sb ? 1 : 0);
            if (pending === 0) { apply(); home(); return; }
            const onLand = (): void => {
              if (--pending === 0 && !loop.cancelled) { apply(); home(); }
            };
            const fly = (src: Thing, from: number, to: number): void => {
              const node = bvc instanceof BoxView ? bvc.holeNode(from) : null;
              const p = holeWorld(box, from);
              const g = renderThingDisplay(src, textures, theme, 46);
              g.position.set(p.x, p.y);
              g.zIndex = 6000;
              renderer.thingLayer.addChild(g);
              if (node) node.node.visible = false;
              flyThing(g, holeWorld(box, to), 600, onLand);
            };
            if (sa) fly(sa, action.a, action.b);
            if (sb) fly(sb, action.b, action.a);
          });
          return;
        }

        // SELF-COPY: a copy of the robot itself flies from the runner into the empty
        // hole (the wand's "a copy of himself" — recursion).
        if (action.type === 'selfCopy') {
          const ghost = renderThingDisplay(lead, textures, theme, 60);
          ghost.position.set(runner.x, runner.y);
          ghost.zIndex = 6000;
          renderer.thingLayer.addChild(ghost);
          flyThing(ghost, holeWorld(box, action.to), 620, () => apply());
          setTimeout(() => { if (!loop.cancelled) { apply(); step(); } }, 720);
          return;
        }

        // fromModule (house-only — no module on the floor) or anything else: apply.
        apply();
        setTimeout(() => { if (!loop.cancelled) { apply(); step(); } }, 500);
      };
      step();
    };

    // One iteration: offer the box to the team front-to-back (`teamMatch`). The
    // first member that matches RUNS; members AHEAD of it that don't match step
    // aside to let it through (robot.cpp move_to_side — the team taking turns).
    // Mismatch → stop; an incomplete box / empty nest → suspend and resume.
    const iterate = (): void => {
      if (loop.cancelled) return;
      if (!world.get(box.id) || !world.get(lead.id)) { if (runningLoop === loop) runningLoop = null; return; }
      const { runner, state } = teamMatch(lead, box);
      if (state === 'mismatch') {
        if (runningLoop === loop) runningLoop = null;
        returnToLine();
        tlog(`run: stopped — box no longer matches (${desc(box)})`);
        setHud('✋ The robot stopped — the box no longer matches its rule (e.g. a scale tipped).');
        return;
      }
      if (state === 'wait') {
        returnToLine();
        tlog(`run: waiting — box incomplete (${desc(box)})`);
        setHud('⏳ Waiting — the box is missing something (or an empty nest awaits a bird). Add it and the robot resumes.');
        loop.unsub = world.subscribe((e) => {
          if (loop.cancelled) return;
          if (e.type === 'moved') return; // a mere move doesn't change the contents
          loop.unsub?.();
          loop.unsub = undefined;
          // Re-evaluate on the NEXT tick, not synchronously: re-subscribing here
          // would add a listener mid-emit (the same emit re-visits it → frozen tab).
          setTimeout(iterate, 0);
        });
        return;
      }
      if (!runner) return; // 'match' always yields a runner, but narrow the type
      if (actor === runner) { runActions(runner); return; } // same member keeps firing
      actor = runner;
      const idx = lineup.indexOf(runner);
      if (idx <= 0) { runActions(runner); return; } // the front matches — work in place
      // A teammate matches: the robots ahead step out of the line (one by one),
      // then the matching member comes forward to the box and works.
      returnToLine(); // tidy the line before re-arranging
      const ahead = lineup.slice(0, idx).filter((r) => world.get(r.id));
      let k = 0;
      const auditionNext = (): void => {
        if (loop.cancelled) return;
        if (k >= ahead.length) {
          walkRobot(runner, { x: box.x - 170, y: box.y + 80 }, 320, () => runActions(runner));
          return;
        }
        const r = ahead[k++];
        const h = home.get(r.id)!;
        tlog(`run: ${desc(r)} doesn't match — steps aside`);
        walkRobot(r, { x: h.x - 160, y: h.y + 36 }, 280, auditionNext); // peel out of the line
      };
      auditionNext();
    };
    iterate();
  }

  // Bammer the mouse runs in and slams when two things are combined (arithmetic,
  // text concat, hole-combine) — on the floor AND in a robot's thoughts.
  function bamMouseAt(t: Thing, onSlam?: () => void): void {
    const tv = views.get(t.id);
    runMouse(
      renderer.thingLayer,
      { x: floorCamera.x - 240, y: floorCamera.y + renderer.height + 200 },
      { x: t.x, y: t.y },
      { x: floorCamera.x + renderer.width + 240, y: floorCamera.y - 200 },
      () => {
        onSlam?.(); // the combine result lands exactly when the hammer connects
        if (tv && !tv.container.destroyed) tweenScale(tv.container, 1.25, 1, 150);
      },
    );
  }

  /** Fly a display node from where it is to a world point, then run onDone and
   * remove it — used to show the robot fetching a fresh element from Tooly. */
  function flyThing(node: PIXI.Container, to: { x: number; y: number }, ms: number, onDone: () => void): void {
    const from = { x: node.position.x, y: node.position.y };
    const t0 = performance.now();
    const tick = (): void => {
      if (node.destroyed) { renderer.app.ticker.remove(tick); return; }
      const t = Math.min(1, (performance.now() - t0) / ms);
      const e = t * (2 - t); // ease-out
      node.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
      if (t >= 1) {
        renderer.app.ticker.remove(tick);
        node.destroy({ children: true });
        onDone();
      }
    };
    renderer.app.ticker.add(tick);
  }

  /** World position of a box hole's content slot (for run animations). */
  function holeWorld(box: Box, i: number): { x: number; y: number } {
    const bv = views.get(box.id);
    const hn = bv instanceof BoxView ? bv.holeNode(i) : null;
    return { x: box.x + (hn?.x ?? 0), y: box.y + (hn?.y ?? 0) };
  }

  /** Where a fresh element flies FROM during a run — Tooly, top-right. */
  function toolboxSource(): { x: number; y: number } {
    return { x: renderer.width - 230 + floorCamera.x, y: 235 + floorCamera.y };
  }

  // Entering the robot's thoughts (robot.htm): training happens inside a
  // full-screen thought-bubble view, not on the floor. We mist over the floor,
  // hide the other floor things, and bring the box + robot into the bubble
  // (the toolbox stays usable). Esc/Backspace exits and restores the floor.
  let thoughtState:
    | { hidden: PIXI.DisplayObject[]; realBoxId: string; bubbleBoxId: string; robotId: string; robotOrig: { x: number; y: number } }
    | null = null;

  // A clear reticle marking the ACTIVE POINT (where a click lands) while you
  // control the robot in the thoughts — the robot's body is offset, so without
  // this it's unclear where the action happens.
  const activePoint = new PIXI.Graphics();
  activePoint.eventMode = 'none';
  activePoint.visible = false;
  activePoint.lineStyle(3, 0x222222, 0.5);
  activePoint.drawCircle(0, 0, 13);
  activePoint.lineStyle(3, 0xffe24a, 1);
  activePoint.drawCircle(0, 0, 11);
  activePoint.beginFill(0xffe24a, 1);
  activePoint.drawCircle(0, 0, 2.5);
  activePoint.endFill();
  renderer.app.stage.addChild(activePoint); // top layer (screen coords)

  /** Enter a robot's thoughts to train it. The robot only *imagines* doing
   * things, so we train on a COPY of the box inside the bubble — the real box is
   * hidden and untouched. */
  function enterThoughts(robot: Robot, realBox: Box): void {
    tlog(`thoughts: ENTER — training ${desc(robot)} on ${desc(realBox)}`);
    cancelRunningLoop(); // don't keep a floor robot iterating while we train
    exitThoughts(); // safety: never stack
    room.enterThoughtBubble();
    room.setHandHidden(true); // you ARE the robot in here — no hand cursor
    activePoint.visible = true; // show where clicks land
    // Hide every floor thing (incl. the real box) except the robot itself.
    const robotC = views.get(robot.id)?.container;
    const hidden: PIXI.DisplayObject[] = [];
    for (const child of renderer.thingLayer.children) {
      if (child !== robotC && child.visible) {
        child.visible = false;
        hidden.push(child);
      }
    }
    // The robot is the CURSOR now — make it pass clicks through (like the hand
    // did), so it doesn't block picking tools/elements out of Tooly underneath,
    // and shrink it a bit so it's a tidy pointer that doesn't hide the box.
    if (robotC) {
      robotC.eventMode = 'none';
      robotC.scale.set(0.6);
    }
    // The imagined box (a copy) sits in the CLEAR TOP STRIP of the bubble. The
    // thingLayer renders above the toolbox chrome, so a box placed over a spilled
    // tool (Dusty ~0.44h, Pumpy ~0.56h, the wand ~0.72h) would cover it and steal
    // its clicks — you'd grab the box instead of the tool. Keeping the box high
    // (y ≈ 0.22h, above every tool) leaves all of them reachable inside the
    // thoughts, however wide the box is.
    const bubbleBox = realBox.copy() as Box;
    world.add(bubbleBox);
    world.moveThing(bubbleBox.id, { x: floorCamera.x + renderer.width * 0.34, y: floorCamera.y + renderer.height * 0.22 });
    const robotOrig = { x: robot.x, y: robot.y };
    world.moveThing(robot.id, { x: floorCamera.x + renderer.width * 0.5, y: floorCamera.y + renderer.height * 0.82 });
    trainer.start(robot, bubbleBox); // record against the imagined copy
    thoughtState = { hidden, realBoxId: realBox.id, bubbleBoxId: bubbleBox.id, robotId: robot.id, robotOrig };
  }

  /** Leave the thoughts: discard the imagined copy, restore the floor (the real
   * box is unchanged). `placeBy` positions the robot: by the box after a finish,
   * or back where it was on cancel. */
  function exitThoughts(placeBy?: 'finish' | 'cancel'): void {
    if (thoughtState) tlog(`thoughts: EXIT (${placeBy ?? 'reset'})`);
    room.exitThoughtBubble();
    room.setHandHidden(false); // the hand cursor returns on the floor
    activePoint.visible = false;
    if (!thoughtState) return;
    const ts = thoughtState;
    thoughtState = null;
    if (world.get(ts.bubbleBoxId)) world.remove(ts.bubbleBoxId); // the imagining is over
    for (const c of ts.hidden) if (!c.destroyed) c.visible = true; // floor returns, box unchanged
    const rv = views.get(ts.robotId);
    if (rv) {
      rv.container.eventMode = 'static'; // the robot is grabbable again on the floor
      rv.container.scale.set(rv.thing.scaleX, rv.thing.scaleY); // restore full size
    }
    const realBox = world.get(ts.realBoxId);
    if (world.get(ts.robotId)) {
      if (placeBy === 'finish' && realBox) world.moveThing(ts.robotId, { x: realBox.x + 170, y: realBox.y - 96 });
      else world.moveThing(ts.robotId, ts.robotOrig);
    }
  }

  // In the thought bubble you ARE the robot: it follows the pointer (its arm is
  // the cursor) and holds whatever tool you've picked up. No hand here.
  renderer.app.stage.on('pointermove', (e) => {
    if (thoughtState && world.get(thoughtState.robotId)) {
      activePoint.position.set(e.global.x, e.global.y); // reticle marks the action point
      // Offset the robot down-and-right of the pointer so its RAISED HAND (upper-
      // left of the sprite) sits at the action point — the robot reaches in with its
      // hand, not its eye.
      world.moveThing(thoughtState.robotId, {
        x: e.global.x + floorCamera.x + 34,
        y: e.global.y + floorCamera.y + 34,
      });
      return;
    }
    // On the floor, a held tool's tip sits on the cursor — mark it with the same
    // reticle so it's clear exactly where Dusty/the wand will act.
    if (holdingTool) {
      activePoint.position.set(e.global.x, e.global.y);
      activePoint.visible = true;
    }
  });

  // Escape finishes training (the original ToonTalk gesture). Backspace cancels
  // — there's no "cancel training" in the manual, so this is a web-only helper.
  window.addEventListener('keydown', (ev) => {
    if (!trainer.active) return;
    if (ev.key === 'Escape') {
      trainer.finish(); // write the condition + actions onto the robot
      exitThoughts('finish'); // discard the imagined copy; the real box is unchanged
      updateHud('none');
    } else if (ev.key === 'Backspace') {
      ev.preventDefault();
      trainer.cancel();
      exitThoughts('cancel');
      updateHud('none');
    }
  });

  // Pull a fresh element out of the toolbox at (x, y) — an infinite stack, so
  // the toolbox keeps its copy. Spawned under the cursor; the drag controller
  // (same pointerdown, bubbled) then picks it up so it drags out of the box.
  function spawnTool(key: string, sx: number, sy: number): Thing | null {
    // The toolbox is screen-fixed; convert the click to world coords so a fresh
    // element appears under the cursor even when the floor is scrolled.
    const x = sx + floorCamera.x;
    const y = sy + floorCamera.y;
    let made: Thing | null = null;
    switch (key) {
      case 'number': made = world.add(new NumberThing({ value: 1, x, y })); break;
      case 'text': made = world.add(new TextThing({ value: 'A', x, y })); break; // match the toolbox icon (room.ts sampleThing)
      case 'box': made = world.add(new Box({ size: 1, x, y })); break; // cubby.h: 1 hole by default
      case 'nest': {
        // A fresh nest holds an egg (the nest view draws it). After a beat it
        // hatches and the bird flies to a nearby spot (bird.cpp hatch).
        const nest = new Nest({ x, y });
        made = world.add(nest);
        window.setTimeout(() => {
          if (!world.all().includes(nest)) return; // nest was picked up/removed
          const bx = x + 120;
          const by = y - 80;
          const bird = hatchFromNest(world, nest, bx, by);
          // The egg cracks open and the bird flies up out of the nest (bird.cpp
          // Nest::hatch_bird → bird_has_hatched).
          if (bird) {
            hatchNest(
              renderer.thingLayer,
              x,
              y,
              bx,
              by,
              views.get(nest.id)?.container,
              views.get(bird.id)?.container,
            );
          }
        }, 650);
        break;
      }
      case 'scale': made = world.add(new Scale({ x, y })); break;
      case 'robot': made = world.add(new Robot({ x, y })); break;
      case 'bomb': made = world.add(new Bomb({ x, y })); break;
      case 'wand': made = world.add(new Wand({ x, y })); break;
      case 'dusty': made = world.add(new Dusty({ x, y })); break;
      case 'pumpy': made = world.add(new Pumpy({ x, y })); break;
      case 'truck': made = world.add(new Truck({ x, y })); break;
      case 'bird': {
        const nest = new Nest({ x: x + 90, y: y + 40 });
        world.add(nest);
        made = world.add(new Bird({ nests: [nest], x, y }));
        break;
      }
      default: return null;
    }
    updateHud('none');
    return made;
  }

  // The faithful initial floor: you sit down and your toolbox (Tooly) is there
  // with the three hand tools that come out of it — the magic wand (copy), Dusty
  // the vacuum (remove), and Pumpy the pump (resize). Everything else lives in
  // the toolbox/notebook chrome until you pull it out.
  function seedFloor(): void {
    // The hand tools (wand, Dusty, Pumpy) LIVE WITH the toolbox now (chrome, at
    // hand — see room.ts), so the working floor starts empty; you pull tools and
    // elements out of the toolbox kit as you need them.
  }

  function seedDemo(): void {
    world.add(new NumberThing({ value: 5, x: 180, y: 140 }));
    world.add(new NumberThing({ value: 3, x: 320, y: 140 }));
    world.add(new NumberThing({ value: 2, operation: '*', x: 460, y: 140 }));
    world.add(new TextThing({ value: 'Hello ', x: 200, y: 260 }));
    world.add(new TextThing({ value: 'World', x: 360, y: 260 }));
    world.add(new Box({ size: 2, x: 300, y: 400 }));

    const nest = new Nest({ x: 700, y: 380 });
    world.add(nest);
    world.add(new Bird({ nests: [nest], x: 560, y: 300 }));

    world.add(new Wand({ x: 520, y: 460 }));
    // Dusty the vacuum: drop on a thing to erase it (→ wildcard for robots).
    world.add(new Dusty({ x: 410, y: 470 }));
    // The bomb: drop on a thing to blow it up (the bomb is consumed).
    world.add(new Bomb({ x: 300, y: 470 }));
    // The truck: drop a robot + a box into it and it builds a running house.
    world.add(new Truck({ x: 470, y: 560 }));
    // Pumpy the resize tool: drop on a thing to grow/shrink it (space cycles modes).
    world.add(new Pumpy({ x: 380, y: 470 }));
    // A notebook with two pages: drop things on it to file pages, drop a number
    // to flip to that page, drag the page off to pull a copy out.
    const notebook = new Notebook({ x: 620, y: 580 });
    notebook.store(new NumberThing({ value: 42 }));
    notebook.store(new TextThing({ value: 'hi' }));
    world.add(notebook);

    // A notebook full of sensors (like page 4 of the original first notebook):
    // drag a page off to pull out a *live* sensor pad. Plus two loose sensors on
    // the floor so the live updating is visible right away.
    const sensors = new Notebook({ x: 760, y: 580 });
    for (const t of SENSOR_TYPES) sensors.store(makeSensor(t));
    world.add(sensors);
    world.add(makeSensor('random', { x: 120, y: 360 }));
    world.add(makeSensor('mouse-vx', { x: 120, y: 470 }));

    // Pre-trained "adder" robot + a ready box to run it on.
    world.add(
      new Robot({
        condition: ['number', 'number'],
        actions: [{ type: 'combine', from: 1, to: 0 }],
        x: 660,
        y: 470,
      }),
    );
    world.add(
      new Box({ holes: [new NumberThing({ value: 4 }), new NumberThing({ value: 5 })], x: 660, y: 330 }),
    );

    // Fresh (untrained) robot + a box to teach it by example.
    world.add(new Robot({ x: 820, y: 470 }));
    world.add(
      new Box({ holes: [new NumberThing({ value: 6 }), new NumberThing({ value: 7 })], x: 820, y: 330 }),
    );

    // A balance weighing 3 against 5: it tips toward the bigger number (right).
    const scaleBox = new Box({
      holes: [new NumberThing({ value: 3 }), new Scale(), new NumberThing({ value: 5 })],
      x: 180,
      y: 560,
    });
    recomputeScales(scaleBox);
    world.add(scaleBox);

    // "Swap if the first is less than the second": a scale-guarded robot that
    // swaps the two numbers when the balance tips right (first < second). Drop
    // it on the box to run it.
    world.add(
      new Robot({
        condition: ['number', 'scale', 'number'],
        exactValues: [null, new Scale({ tilt: 'right' }), null],
        actions: [{ type: 'swap', a: 0, b: 2 }],
        x: 1000,
        y: 470,
      }),
    );
    const swapBox = new Box({
      holes: [new NumberThing({ value: 3 }), new Scale(), new NumberThing({ value: 8 })],
      x: 1000,
      y: 330,
    });
    recomputeScales(swapBox);
    world.add(swapBox);

    // Module demo (the recursion primitive): a house whose robot, each tick,
    // pulls a *copy* of page 1 of its module (the number 1) into the empty hole
    // and adds it to the accumulator — so the counter climbs, driven entirely by
    // the module it was given. `fromModule` is how a house's robots draw on the
    // notebook handed to the truck that built them.
    const moduleNb = new Notebook({ pages: [new NumberThing({ value: 1 })] });
    const counterBox = new Box({ holes: [new NumberThing({ value: 0 }), null] });
    const counterRobot = new Robot({
      condition: ['number', null],
      actions: [
        { type: 'fromModule', page: 1, to: 1 },
        { type: 'combine', from: 1, to: 0 },
      ],
    });
    world.add(new House({ x: 1000, y: 590, robot: counterRobot, box: counterBox, module: moduleNb }));
  }

  // The faithful ToonTalk save model: **only the main notebook persists**. The
  // floor is transient working space — reseeded fresh each load — while the main
  // notebook (the one in your toolbox) keeps whatever you file onto it. A fresh
  // main notebook starts with a single welcome page.
  // A library of pre-trained example robots — solo AND teams — filed in the main
  // notebook so there's a variety to test with out of the box. Pull a page out
  // (drag the robot off it) and drop a matching box on it to watch it run; a team
  // comes out as a lined-up row that takes turns on the box. Page order (after the
  // "Pictures" page) is documented in the README.
  function exampleRobots(): Robot[] {
    const n = (value: number) => new NumberThing({ value });
    const t = (value: string) => new TextThing({ value });
    const mk = (name: string, condition: ConditionHole[], actions: RobotAction[], exactValues?: (Thing | null)[]): Robot =>
      new Robot({ name, condition, actions, exactValues });

    // — solo (each NAMED so it's clear what it does) —
    const adder = mk('Add', ['number', 'number'], [{ type: 'combine', from: 1, to: 0 }]); // 3,5 → 8
    const multiplier = mk('Multiply', ['number', 'number'], [{ type: 'combine', from: 1, to: 0, op: '*' }]); // 3,5 → 15
    const counter = mk('Count up', ['number'], [{ type: 'insert', to: 0, thing: n(1) }]); // +1 every run (forever)
    const doubler = mk('Double', ['number'], [{ type: 'copy', from: 0, to: 0 }]); // value + value (forever)
    const joiner = mk('Join', ['text', 'text'], [{ type: 'combine', from: 1, to: 0 }]); // "snow","man" → "snowman"
    const swapper = mk('Swap', ['number', 'number'], [{ type: 'swap', a: 0, b: 1 }]); // swaps the two (oscillates — grab to stop)
    const sorter = mk(
      'Sort', ['number', 'scale', 'number'],
      [{ type: 'swap', a: 0, b: 2 }],
      [null, new Scale({ tilt: 'right' }), null],
    ); // only while the scale tips right (first < second): puts the bigger first, then settles & stops
    const greeter = mk('Greet', ['text'], [{ type: 'insert', to: 0, thing: t(' there') }], [t('hi')]); // only when the text is exactly "hi"

    // — teams (one notebook page each; pulled out they line up and take turns).
    //   The lead carries the team name; each teammate its own so they're clear if
    //   pulled apart. NUMBER-only teams (By size) don't accept text — by design. —
    const addOrJoin = mk('Add or join', ['number', 'number'], [{ type: 'combine', from: 1, to: 0 }]);
    addOrJoin.team = [mk('Join', ['text', 'text'], [{ type: 'combine', from: 1, to: 0 }])]; // number pair → add · text pair → join

    const bySize = mk('By size', ['number'], [{ type: 'copy', from: 0, to: 0 }]);
    bySize.team = [mk('Add', ['number', 'number'], [{ type: 'combine', from: 1, to: 0 }])]; // lone number → double · pair → add

    const allRounder = mk('All-rounder', ['number', 'number'], [{ type: 'combine', from: 1, to: 0 }]);
    allRounder.team = [
      mk('Join', ['text', 'text'], [{ type: 'combine', from: 1, to: 0 }]),
      mk('Count up', ['number'], [{ type: 'insert', to: 0, thing: n(1) }]),
    ]; // add a number pair / join a text pair / count a lone number up

    return [adder, multiplier, counter, doubler, joiner, swapper, sorter, greeter, addOrJoin, bySize, allRounder];
  }

  // The example library is fronted by a labelled "Examples" divider page; we
  // detect it BY CONTENT (not a flag) so the check self-heals: any notebook
  // lacking the divider gets the library appended on load, however it got that
  // way (a pre-library save, a save that didn't persist, a stale flag, …).
  const EXAMPLES_HEADER = 'Examples';
  function exampleLibrary(): Thing[] {
    return [new TextThing({ value: EXAMPLES_HEADER }), ...exampleRobots()];
  }
  function seedMainNotebook(): Notebook {
    const nb = new Notebook({ x: 500, y: 600, isMain: true, name: 'claude 1' }); // the original's notebook name
    nb.store(new TextThing({ value: 'Pictures' })); // the original opens to its "Pictures" page
    for (const p of exampleLibrary()) nb.store(p); // …then the example-robot library
    nb.goTo(1); // open to the "Pictures" page, as the original does
    return nb;
  }
  function installMainNotebook(): Notebook {
    const nb = loadMainNotebook() ?? seedMainNotebook();
    const dividerIdx = nb.pages.findIndex((p) => p instanceof TextThing && p.value === EXAMPLES_HEADER);
    if (dividerIdx < 0) {
      for (const p of exampleLibrary()) nb.store(p); // library missing → append it
      nb.goTo(1);
      saveMainNotebook(nb); // persist so it sticks (re-added next load if this ever fails)
    } else {
      // The library is present. If it's an OLDER version — the first example robot
      // has no name — replace that block (divider + its robots) IN PLACE with the
      // current named set, so existing notebooks pick up new examples without a
      // manual Reset and without duplicating. Pages filed AFTER the block (at
      // higher indices) are preserved.
      const firstEx = nb.pages[dividerIdx + 1];
      if (firstEx instanceof Robot && !firstEx.name) {
        nb.pages.splice(dividerIdx, 1 + exampleRobots().length); // remove divider + its 11 robots
        for (const p of exampleLibrary()) nb.store(p); // re-add the current, NAMED library
        nb.goTo(1);
        saveMainNotebook(nb);
      }
    }
    nb.moveTo({ x: FLOOR_W / 2, y: FLOOR_H / 2 + 200 }); // near the floor centre, below the tools
    world.add(nb);
    return nb;
  }

  if (demoMode) seedDemo();
  else seedFloor();
  let mainNotebook = installMainNotebook();

  // Saving = filing onto the main notebook. Persist it whenever it changes;
  // identity-check so the ~60fps sensor ticks don't trigger a save each frame.
  world.subscribe((event) => {
    if (event.type === 'changed' && event.thing === mainNotebook) saveMainNotebook(mainNotebook);
  });

  // Save / Load / Reset controls.
  document.getElementById('save-btn')?.addEventListener('click', () => {
    const blob = new Blob([serialize(world)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toontalk-world.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  const loadInput = document.getElementById('load-input') as HTMLInputElement | null;
  document.getElementById('load-btn')?.addEventListener('click', () => loadInput?.click());
  loadInput?.addEventListener('change', async () => {
    const file = loadInput.files?.[0];
    if (!file) return;
    try {
      loadWorld(world, await file.text());
      updateHud('none');
    } catch {
      setHud('Could not load that file.');
    }
    loadInput.value = '';
  });
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    clearMainNotebook(); // a fresh notebook re-seeds with the example library
    world.clear();
    if (demoMode) seedDemo();
    else seedFloor();
    mainNotebook = installMainNotebook();
    updateHud('none');
  });
  // Toggle the copyable debug-log panel (click the panel to copy it).
  document.getElementById('log-btn')?.addEventListener('click', toggleDebugPanel);
  document.getElementById('settings-btn')?.addEventListener('click', showSettings);
  city.setHead(currentHead()); // apply the saved head choice to the avatar on boot

  // Render-mode toggle link.
  const toggle = document.getElementById('mode-toggle') as HTMLAnchorElement | null;
  if (toggle) {
    const next = mode === 'faithful' ? 'modern' : 'faithful';
    toggle.textContent = `mode: ${mode} → switch to ${next}`;
    toggle.href = `?mode=${next}`;
  }

  function updateHud(lastResult?: string): void {
    if (trainer.active) {
      setHud(
        `TRAINING (${trainer.stepCount} step${trainer.stepCount === 1 ? '' : 's'}) — the robot is watching and will remember everything.\n` +
          `Demonstrate (it counts holes from the left): drag a hole ONTO another (combine/move), ` +
          `OUT of the box (take it out), or a floor thing INTO a hole (put it in).\n` +
          `Tools: hold the WAND and drag a hole onto another to COPY it · hold DUSTY and click a hole to generalise.\n` +
          `Esc = done (the robot learns it) · Backspace = cancel.`,
      );
      return;
    }
    setHud(
      `ToonTalk Web — Phase 4 · ${BUILD}\n` +
        `render mode: ${mode}\n` +
        `things: ${world.size}\n` +
        `trained robot + 2-number box → it adds · UNtrained robot + filled box → train it\n` +
        `numbers add · text joins · box holes fill · bird→nest · wand copies · dusty sucks/erases · robot on robot → team\n` +
        `LOOP: drop a robot + a box into a TRUCK → it builds a HOUSE that runs the robot over and over (e.g. an "add 1" robot keeps counting) · bomb the house to stop\n` +
        `hold a number, press + − ×(x) ÷(/) % ^ = to set its op · − negates · number on a text pad → digits (blank) or next letter (non-blank)\n` +
        `a scale between two holes tips toward the bigger (robots can match the tilt) · drop a box on another box's edge to join` +
        (lastResult && lastResult !== 'none' && lastResult !== 'train'
          ? `\nlast drop: ${lastResult}`
          : ''),
    );
  }
  updateHud();

  // Boot into the outdoor city (flying the helicopter).
  showCity();

  // Signals tools (tools/verify/snap.mjs) that boot is fully complete.
  (window as unknown as { __ttReady?: boolean }).__ttReady = true;
}

start().catch((err) => {
  console.error(err);
  setHud(`Error: ${err instanceof Error ? err.message : String(err)}`);
});
