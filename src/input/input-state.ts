/**
 * Live input state for ToonTalk sensors (see model/sensor.ts).
 *
 * Sensors read the *current* mouse/keyboard/clock state each frame. InputTracker
 * attaches listeners and, once per frame, `sample(dtMs)` produces an immutable
 * snapshot — including momentary edges (a click, a key just pressed) that are
 * true for exactly one sample and pointer velocity accumulated since the last.
 */

export interface InputState {
  /** Pointer velocity, scaled so 1000 = one screen width/height per second. */
  mouseVX: number; // + = rightward
  mouseVY: number; // + = upward (manual: negative is downward)
  downLeft: boolean;
  downMiddle: boolean;
  downRight: boolean;
  /** Momentary: true only for the sample in which the click happened. */
  clickLeft: boolean;
  clickMiddle: boolean;
  clickRight: boolean;
  /** The most recent key, held until released (""=none). */
  lastKey: string;
  /** Momentary: the key for the one sample it went down ("" otherwise). */
  justKey: string;
  shift: boolean;
  ctrl: boolean;
  /** Milliseconds since the previous sample (for clocks/timers). */
  dtMs: number;
  /** Fresh integer 0..1000 each sample. */
  random: number;
  handVisible: boolean;
  addressRoad: number;
  addressStreet: number;
}

/** Friendly names for special keys, matching the original sensor labels. */
function keyName(e: KeyboardEvent): string {
  switch (e.key) {
    case ' ':
      return 'Space';
    case 'ArrowUp':
      return 'Up arrow';
    case 'ArrowDown':
      return 'Down arrow';
    case 'ArrowLeft':
      return 'Left arrow';
    case 'ArrowRight':
      return 'Right arrow';
    case 'PageUp':
      return 'Page up';
    case 'PageDown':
      return 'Page down';
    case 'Enter':
      return 'Enter';
    case 'Escape':
      return 'Escape';
    case 'Backspace':
      return 'Backspace key';
    default:
      return e.key;
  }
}

export class InputTracker {
  private accumDx = 0;
  private accumDy = 0;
  private downL = false;
  private downM = false;
  private downR = false;
  private clickL = false;
  private clickM = false;
  private clickR = false;
  private shift = false;
  private ctrl = false;
  private lastKey = '';
  private justKey = '';

  /** Pluggable providers for state the tracker can't observe directly. */
  handVisible: () => boolean = () => true;
  address: () => { road: number; street: number } = () => ({ road: 0, street: 0 });

  constructor(
    target: HTMLElement,
    private readonly screenWidth: () => number,
    private readonly screenHeight: () => number,
  ) {
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerdown', this.onDown);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointerleave', this.onUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onMove = (e: PointerEvent): void => {
    this.accumDx += e.movementX || 0;
    this.accumDy += e.movementY || 0;
  };
  private onDown = (e: PointerEvent): void => {
    if (e.button === 1) {
      this.downM = true;
      this.clickM = true;
    } else if (e.button === 2) {
      this.downR = true;
      this.clickR = true;
    } else {
      this.downL = true;
      this.clickL = true;
    }
  };
  private onUp = (e: PointerEvent): void => {
    if (e.button === 1) this.downM = false;
    else if (e.button === 2) this.downR = false;
    else this.downL = false;
  };
  private onKeyDown = (e: KeyboardEvent): void => {
    this.shift = e.shiftKey;
    this.ctrl = e.ctrlKey;
    const name = keyName(e);
    this.lastKey = name;
    this.justKey = name;
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.shift = e.shiftKey;
    this.ctrl = e.ctrlKey;
    if (keyName(e) === this.lastKey) this.lastKey = '';
  };

  /** Build the snapshot for this frame and clear the per-frame edges. */
  sample(dtMs: number): InputState {
    const secs = dtMs > 0 ? dtMs / 1000 : 1 / 60;
    const sw = this.screenWidth() || 1;
    const sh = this.screenHeight() || 1;
    const mouseVX = ((this.accumDx / secs) / sw) * 1000;
    const mouseVY = ((-this.accumDy / secs) / sh) * 1000; // up is positive
    const addr = this.address();
    const snap: InputState = {
      mouseVX,
      mouseVY,
      downLeft: this.downL,
      downMiddle: this.downM,
      downRight: this.downR,
      clickLeft: this.clickL,
      clickMiddle: this.clickM,
      clickRight: this.clickR,
      lastKey: this.lastKey,
      justKey: this.justKey,
      shift: this.shift,
      ctrl: this.ctrl,
      dtMs: Math.round(dtMs),
      random: Math.floor(Math.random() * 1001),
      handVisible: this.handVisible(),
      addressRoad: addr.road,
      addressStreet: addr.street,
    };
    // clear momentary edges + movement accumulators
    this.accumDx = this.accumDy = 0;
    this.clickL = this.clickM = this.clickR = false;
    this.justKey = '';
    return snap;
  }
}
