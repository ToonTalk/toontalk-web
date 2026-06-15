/**
 * The text "alphabet" ring — a faithful port of utils.cpp `initialize_alphabet`
 * (5294) and `next_in_alphabet` (5363/5373). Dropping a number on a non-blank
 * text pad advances its edge character through this ring (text.cpp
 * `compute_new_text`:1043-1075), wrapping around.
 *
 * The original builds the ring as: upper case A-Z, then lower case a-z, then
 * every char from ' ' (32) up to '@' (64) — which is space, punctuation and the
 * digits — then '{' '|' '}' '~' (123-126). (The build loop also touches 127/DEL
 * but `alphabet_size = i-1` drops it.) Note codes 91-96 ("[ \ ] ^ _ `") are NOT
 * in the ring, matching the original.
 */
function buildAlphabet(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  let mid = '';
  for (let c = 0x20; c <= 0x40; c++) mid += String.fromCharCode(c); // ' '..'@' (32..64)
  let tail = '';
  for (let c = 0x7b; c <= 0x7e; c++) tail += String.fromCharCode(c); // '{'..'~' (123..126)
  return upper + lower + mid + tail; // 26 + 26 + 33 + 4 = 89
}

export const TEXT_ALPHABET = buildAlphabet();

/**
 * `next_in_alphabet`: advance `letter` by `change` places around the ring,
 * wrapping. A char not in the ring falls back to raw code arithmetic, like the
 * wide-text branch (utils.cpp:5379).
 */
export function nextInAlphabet(letter: string, change: number): string {
  const size = TEXT_ALPHABET.length;
  const i = TEXT_ALPHABET.indexOf(letter);
  if (i < 0) return String.fromCharCode(letter.charCodeAt(0) + change);
  const j = (((i + (change % size)) % size) + size) % size;
  return TEXT_ALPHABET[j];
}

/**
 * Shift the edge character of a non-blank pad: the last char when dropped on the
 * right, the first char when dropped on the left (text.cpp:1063-1074).
 */
export function shiftEdgeChar(text: string, side: 'left' | 'right', change: number): string {
  if (text.length === 0) return text;
  if (side === 'right') {
    return text.slice(0, -1) + nextInAlphabet(text[text.length - 1], change);
  }
  return nextInAlphabet(text[0], change) + text.slice(1);
}
