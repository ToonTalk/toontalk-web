import { describe, it, expect } from 'vitest';
import { Rational } from '../src/model/rational';

describe('Rational', () => {
  it('reduces to lowest terms with positive denominator', () => {
    const r = new Rational(4n, -8n);
    expect(r.num).toBe(-1n);
    expect(r.den).toBe(2n);
    expect(r.toString()).toBe('-1/2');
  });

  it('adds, subtracts, multiplies, divides exactly', () => {
    const a = new Rational(1n, 3n);
    const b = new Rational(1n, 6n);
    expect(a.add(b).toString()).toBe('1/2');
    expect(a.subtract(b).toString()).toBe('1/6');
    expect(a.multiply(b).toString()).toBe('1/18');
    expect(a.divide(b).toString()).toBe('2');
  });

  it('handles big integers without precision loss', () => {
    const big = Rational.parse('123456789012345678901234567890');
    expect(big.add(Rational.fromInt(1)).toString()).toBe('123456789012345678901234567891');
  });

  it('parses fractions and decimals', () => {
    expect(Rational.parse('3/4').toString()).toBe('3/4');
    expect(Rational.parse('1.5').toString()).toBe('3/2');
    expect(Rational.parse('-0.25').toString()).toBe('-1/4');
  });

  it('throws on division by zero', () => {
    expect(() => new Rational(1n, 0n)).toThrow();
    expect(() => Rational.fromInt(1).divide(Rational.fromInt(0))).toThrow();
  });
});
