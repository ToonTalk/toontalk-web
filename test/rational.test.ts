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

  it('negates and truncates toward zero', () => {
    expect(Rational.parse('3/4').negate().toString()).toBe('-3/4');
    expect(Rational.parse('-7/2').truncate().toString()).toBe('-3'); // toward zero
    expect(Rational.parse('7/2').truncate().toString()).toBe('3');
  });

  it('computes remainder of truncated division', () => {
    expect(Rational.fromInt(7).remainder(Rational.fromInt(2)).toString()).toBe('1');
    expect(Rational.parse('7/2').remainder(Rational.fromInt(1)).toString()).toBe('1/2');
    expect(() => Rational.fromInt(1).remainder(Rational.fromInt(0))).toThrow();
  });

  it('raises to exact integer powers, including negative exponents', () => {
    expect(Rational.fromInt(7).power(Rational.fromInt(2)).toString()).toBe('49');
    expect(Rational.parse('2/3').power(Rational.fromInt(3)).toString()).toBe('8/27');
    expect(Rational.fromInt(2).power(Rational.fromInt(-2)).toString()).toBe('1/4');
    expect(() => Rational.fromInt(0).power(Rational.fromInt(-1))).toThrow();
  });

  it('approximates non-integer exponents', () => {
    // 4 ^ (1/2) = 2 (within float precision, lands exactly here)
    expect(Rational.fromInt(4).power(Rational.parse('1/2')).toNumber()).toBeCloseTo(2, 6);
  });
});
