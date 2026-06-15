import { describe, it, expect } from 'vitest';
import { TEXT_ALPHABET, nextInAlphabet, shiftEdgeChar } from '../src/model/alphabet';

// Faithful to utils.cpp initialize_alphabet (5294) + next_in_alphabet (5363).
describe('text alphabet ring', () => {
  it('is the 89-char ring: A-Z, a-z, 32..64, {|}~', () => {
    expect(TEXT_ALPHABET.length).toBe(89);
    expect(TEXT_ALPHABET.startsWith('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(TEXT_ALPHABET).toContain(' ');
    expect(TEXT_ALPHABET).toContain('0');
    expect(TEXT_ALPHABET.endsWith('{|}~')).toBe(true);
    // codes 91-96 ("[ \ ] ^ _ `") are deliberately excluded
    expect(TEXT_ALPHABET).not.toContain('[');
    expect(TEXT_ALPHABET).not.toContain('_');
  });

  it('advances within a class and wraps around the ring', () => {
    expect(nextInAlphabet('a', 1)).toBe('b');
    expect(nextInAlphabet('A', 1)).toBe('B');
    expect(nextInAlphabet('0', 1)).toBe('1');
    // 'Z' (index 25) wraps to 'a' (index 26); 'z' (index 51) wraps to ' ' (index 52)
    expect(nextInAlphabet('Z', 1)).toBe('a');
    expect(nextInAlphabet('z', 1)).toBe(' ');
    // negative shift
    expect(nextInAlphabet('b', -1)).toBe('a');
    // big shift wraps mod 89
    expect(nextInAlphabet('a', 89)).toBe('a');
  });
});

describe('shiftEdgeChar (number dropped on a text pad)', () => {
  it('shifts the last char on the right, the first char on the left', () => {
    expect(shiftEdgeChar('cat', 'right', 1)).toBe('cau'); // t -> u
    expect(shiftEdgeChar('cat', 'left', 1)).toBe('dat'); // c -> d
  });

  it('shifts a single-letter pad (the common case)', () => {
    expect(shiftEdgeChar('a', 'right', 2)).toBe('c');
  });
});
