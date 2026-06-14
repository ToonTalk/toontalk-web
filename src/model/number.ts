/**
 * A number pad. Holds an exact Rational value and an operation that determines
 * what happens when this number is dropped onto another number.
 *
 * ToonTalk semantics: dropping number A (with operation op) onto number B makes
 * B become "B op A", and A is consumed. Default operation is addition. The op is
 * set by pressing a key before dropping (+ × ÷ % ^ =); to subtract you negate a
 * number (the '-' key flips its sign) and then add it. So there is no binary
 * subtract op — that matches the original manual.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import { Rational } from './rational';

/** + add · * multiply · / divide · % remainder · ^ power · = replace. */
export type NumberOp = '+' | '*' | '/' | '%' | '^' | '=';

export interface NumberSnapshot extends ThingSnapshot {
  value: string;
  operation: NumberOp;
}

export class NumberThing extends Thing {
  readonly kind = 'number' as const;
  value: Rational;
  operation: NumberOp;

  constructor(opts: {
    id?: string;
    x?: number;
    y?: number;
    value: Rational | number;
    operation?: NumberOp;
  }) {
    super(opts);
    this.value = opts.value instanceof Rational ? opts.value : Rational.fromInt(opts.value);
    this.operation = opts.operation ?? '+';
  }

  protected override kindForId(): ThingKind {
    return 'number';
  }

  /** Apply this number's operation to a target: target := target op this. */
  applyTo(target: NumberThing): void {
    target.value = NumberThing.combine(target.value, this.value, this.operation);
  }

  /** Flip the sign of this number (the '-' key); subtraction is negate-then-add. */
  negate(): void {
    this.value = this.value.negate();
  }

  static combine(a: Rational, b: Rational, op: NumberOp): Rational {
    switch (op) {
      case '+':
        return a.add(b);
      case '*':
        return a.multiply(b);
      case '/':
        return a.divide(b);
      case '%':
        return a.remainder(b);
      case '^':
        return a.power(b);
      case '=':
        return b; // replacement: target becomes the dropped value
      default:
        return a.add(b); // robustness for any legacy/unknown op
    }
  }

  copy(): NumberThing {
    return new NumberThing({ x: this.x, y: this.y, value: this.value, operation: this.operation });
  }

  equals(other: Thing): boolean {
    return other instanceof NumberThing && other.value.equals(this.value);
  }

  describe(): string {
    return this.value.toString();
  }

  override snapshot(): NumberSnapshot {
    return { ...super.snapshot(), value: this.value.toString(), operation: this.operation };
  }
}

// --- number-pad text editing (supports typing a decimal point) ---------------
// The pad is edited through a string buffer so a decimal point and Backspace
// work exactly. Integers are editable in place; a fraction value starts a fresh
// buffer (you can't append digits to "3/4"). Fractions still arise from the ÷
// operation, which keeps '/' free as the divide-op key.

/** Seed an edit buffer from a value: its digits for an integer, else empty. */
export function rationalToEditBuffer(r: Rational): string {
  return r.den === 1n ? r.num.toString() : '';
}

/** Parse a number-pad edit buffer (sign, digits, at most one '.') to a Rational. */
export function editBufferToRational(buf: string): Rational {
  if (buf === '' || buf === '-' || buf === '.' || buf === '-.') return Rational.fromInt(0);
  return Rational.parse(buf);
}

/** Apply one typed key to an edit buffer (a digit, '.', or Backspace). Returns
 * the new buffer, or null if the key isn't a value-editing key. */
export function applyNumberKeyToBuffer(buf: string, key: string): string | null {
  if (key === 'Backspace') return buf.slice(0, -1);
  if (key === '.') return buf.includes('.') ? buf : (buf === '' || buf === '-' ? buf + '0.' : buf + '.');
  if (key.length === 1 && key >= '0' && key <= '9') return buf + key;
  return null;
}
