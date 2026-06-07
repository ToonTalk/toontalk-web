/**
 * Arbitrary-precision rational numbers.
 *
 * The original ToonTalk used GMP for exact bignum arithmetic; numbers could be
 * arbitrarily large and exact fractions. We reproduce that with BigInt
 * numerator/denominator, always stored in lowest terms with a positive
 * denominator. Pure data — no rendering, fully unit-testable.
 */
export class Rational {
  /** Signed numerator. */
  readonly num: bigint;
  /** Strictly positive denominator. */
  readonly den: bigint;

  constructor(num: bigint, den: bigint = 1n) {
    if (den === 0n) throw new Error('Rational: division by zero');
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const g = Rational.gcd(num < 0n ? -num : num, den);
    if (g === 0n) {
      this.num = 0n;
      this.den = 1n;
    } else {
      this.num = num / g;
      this.den = den / g;
    }
  }

  static gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) {
      [a, b] = [b, a % b];
    }
    return a;
  }

  static fromInt(n: number | bigint): Rational {
    return new Rational(BigInt(n));
  }

  /** Parse "3", "-4", "3/4", "-1/2", or a decimal like "1.5". */
  static parse(text: string): Rational {
    const s = text.trim();
    if (s.includes('/')) {
      const [n, d] = s.split('/');
      return new Rational(BigInt(n.trim()), BigInt(d.trim()));
    }
    if (s.includes('.')) {
      const neg = s.startsWith('-');
      const body = neg ? s.slice(1) : s;
      const [whole, frac = ''] = body.split('.');
      const denom = 10n ** BigInt(frac.length);
      const numer = BigInt((whole || '0') + frac);
      return new Rational(neg ? -numer : numer, denom);
    }
    return new Rational(BigInt(s));
  }

  add(o: Rational): Rational {
    return new Rational(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  subtract(o: Rational): Rational {
    return new Rational(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  multiply(o: Rational): Rational {
    return new Rational(this.num * o.num, this.den * o.den);
  }

  divide(o: Rational): Rational {
    if (o.num === 0n) throw new Error('Rational: division by zero');
    return new Rational(this.num * o.den, this.den * o.num);
  }

  negate(): Rational {
    return new Rational(-this.num, this.den);
  }

  /** Integer part, truncated toward zero. */
  truncate(): Rational {
    return new Rational(this.num / this.den); // BigInt division truncates toward zero
  }

  /** Remainder of truncated division: this − o·trunc(this/o). e.g. 7 % 2 = 1. */
  remainder(o: Rational): Rational {
    if (o.num === 0n) throw new Error('Rational: remainder by zero');
    const q = this.divide(o).truncate();
    return this.subtract(o.multiply(q));
  }

  /**
   * Exponentiation. Exact for integer exponents (incl. negative); for a
   * non-integer exponent the result is generally irrational, so we fall back to
   * a floating-point approximation.
   */
  power(o: Rational): Rational {
    if (o.isInteger()) {
      const exp = o.num;
      if (exp >= 0n) return new Rational(this.num ** exp, this.den ** exp);
      if (this.num === 0n) throw new Error('Rational: zero to a negative power');
      const e = -exp;
      return new Rational(this.den ** e, this.num ** e);
    }
    return Rational.fromFloat(Math.pow(this.toNumber(), o.toNumber()));
  }

  /** Best-effort rational from a JS float (used for inexact results). */
  static fromFloat(x: number): Rational {
    if (!Number.isFinite(x)) throw new Error('Rational: not a finite number');
    if (Number.isInteger(x)) return Rational.fromInt(x);
    const s = x.toPrecision(15);
    if (s.includes('e') || s.includes('E')) return Rational.fromInt(Math.round(x));
    return Rational.parse(s);
  }

  equals(o: Rational): boolean {
    return this.num === o.num && this.den === o.den;
  }

  /** -1 if this < o, 0 if equal, 1 if this > o. */
  compare(o: Rational): number {
    const diff = this.num * o.den - o.num * this.den; // dens are positive
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }

  isInteger(): boolean {
    return this.den === 1n;
  }

  /** "5" for integers, "3/4" for fractions. */
  toString(): string {
    return this.den === 1n ? this.num.toString() : `${this.num}/${this.den}`;
  }

  toNumber(): number {
    return Number(this.num) / Number(this.den);
  }
}
