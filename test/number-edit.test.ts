import { describe, it, expect } from 'vitest';
import { Rational } from '../src/model/rational';
import {
  rationalToEditBuffer,
  editBufferToRational,
  applyNumberKeyToBuffer,
} from '../src/model/number';

// Typing into a number pad goes through a string buffer so a decimal point and
// Backspace are exact (drag-controller editNumber). These are the pure helpers.

describe('number-pad edit buffer', () => {
  it('seeds the buffer from an integer value, but starts fresh on a fraction', () => {
    expect(rationalToEditBuffer(Rational.fromInt(5))).toBe('5');
    expect(rationalToEditBuffer(Rational.fromInt(-12))).toBe('-12');
    expect(rationalToEditBuffer(new Rational(3n, 4n))).toBe(''); // 3/4 → type fresh
  });

  it('appends digits and one decimal point', () => {
    let b = '5';
    b = applyNumberKeyToBuffer(b, '3') as string; // 53
    expect(b).toBe('53');
    b = applyNumberKeyToBuffer(b, '.') as string; // 53.
    b = applyNumberKeyToBuffer(b, '2') as string; // 53.2
    expect(b).toBe('53.2');
    expect(applyNumberKeyToBuffer(b, '.')).toBe('53.2'); // a second '.' is ignored
  });

  it('starts a leading decimal as 0.', () => {
    expect(applyNumberKeyToBuffer('', '.')).toBe('0.');
    expect(applyNumberKeyToBuffer('-', '.')).toBe('-0.');
  });

  it('Backspace removes the last character; non-edit keys return null', () => {
    expect(applyNumberKeyToBuffer('53.2', 'Backspace')).toBe('53.');
    expect(applyNumberKeyToBuffer('5', 'x')).toBeNull(); // an op key, not value editing
    expect(applyNumberKeyToBuffer('5', 'a')).toBeNull();
  });

  it('parses the buffer to an exact Rational (decimals → fractions)', () => {
    expect(editBufferToRational('1.25').toString()).toBe('5/4');
    expect(editBufferToRational('53.2').toString()).toBe('266/5');
    expect(editBufferToRational('').toString()).toBe('0');
    expect(editBufferToRational('-').toString()).toBe('0');
    expect(editBufferToRational('.').toString()).toBe('0');
  });
});
