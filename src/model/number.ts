/**
 * A number pad. Holds an exact Rational value and an operation that determines
 * what happens when this number is dropped onto another number.
 *
 * ToonTalk semantics: dropping number A (with operation op) onto number B makes
 * B become "B op A", and A is consumed. Default operation is addition.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import { Rational } from './rational';

export type NumberOp = '+' | '-' | '*' | '/';

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

  static combine(a: Rational, b: Rational, op: NumberOp): Rational {
    switch (op) {
      case '+':
        return a.add(b);
      case '-':
        return a.subtract(b);
      case '*':
        return a.multiply(b);
      case '/':
        return a.divide(b);
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
