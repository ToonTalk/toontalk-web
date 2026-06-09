import { describe, it, expect } from 'vitest';
import { World } from '../src/model/world';
import { NumberThing } from '../src/model/number';
import { TextThing } from '../src/model/text';
import { Notebook } from '../src/model/notebook';
import { Dusty } from '../src/model/dusty';
import { resolveDrop } from '../src/model/interactions';
import { serialize, loadWorld, thingToJson, thingFromJson } from '../src/model/persistence';

describe('notebook', () => {
  it('files dropped things as pages and shows the newest', () => {
    const w = new World();
    const nb = w.add(new Notebook()) as Notebook;
    expect(resolveDrop(w, w.add(new TextThing({ value: 'a' })), nb)).toBe('stored');
    expect(resolveDrop(w, w.add(new TextThing({ value: 'b' })), nb)).toBe('stored');
    expect(nb.count).toBe(2);
    expect((nb.current() as TextThing).value).toBe('b'); // turned to the new page
  });

  it('a dropped number flips to that page (1-based)', () => {
    const w = new World();
    const nb = w.add(new Notebook({ pages: [new TextThing({ value: 'p1' }), new TextThing({ value: 'p2' })] })) as Notebook;
    const result = resolveDrop(w, w.add(new NumberThing({ value: 1 })), nb);
    expect(result).toBe('flipped');
    expect((nb.current() as TextThing).value).toBe('p1');
    expect(nb.count).toBe(2); // the number was consumed, not stored
  });

  it('round-trips pages and current index through save/load', () => {
    const w = new World();
    const nb = new Notebook({ pages: [new NumberThing({ value: 7 }), new TextThing({ value: 'x' })], index: 1 });
    w.add(nb);
    const w2 = new World();
    loadWorld(w2, serialize(w));
    const loaded = w2.all().find((t) => t instanceof Notebook) as Notebook;
    expect(loaded.count).toBe(2);
    expect(loaded.index).toBe(1);
    expect((loaded.current() as TextThing).value).toBe('x');
  });

  it('a dropped text flips to the page whose text starts with it', () => {
    const w = new World();
    const nb = w.add(
      new Notebook({ pages: [new TextThing({ value: 'cat' }), new TextThing({ value: 'mat' })] }),
    ) as Notebook;
    const result = resolveDrop(w, w.add(new TextThing({ value: 'ma' })), nb);
    expect(result).toBe('flipped');
    expect((nb.current() as TextThing).value).toBe('mat');
    expect(nb.count).toBe(2); // not filed
  });

  it('a dropped text with no matching page is filed', () => {
    const w = new World();
    const nb = w.add(new Notebook({ pages: [new TextThing({ value: 'cat' })] })) as Notebook;
    expect(resolveDrop(w, w.add(new TextThing({ value: 'zzz' })), nb)).toBe('stored');
    expect(nb.count).toBe(2);
  });

  it('only Dusty removes a page (the current one)', () => {
    const w = new World();
    const nb = w.add(
      new Notebook({ pages: [new NumberThing({ value: 1 }), new NumberThing({ value: 2 })], index: 0 }),
    ) as Notebook;
    const dusty = w.add(new Dusty()) as Dusty; // default mode 'erase'
    expect(resolveDrop(w, dusty, nb)).toBe('erased');
    expect(nb.count).toBe(1);
    expect((nb.current() as NumberThing).value.toString()).toBe('2');
  });

  it('the main notebook round-trips (isMain + pages) via thingToJson', () => {
    const nb = new Notebook({ pages: [new TextThing({ value: 'saved' })], isMain: true });
    const back = thingFromJson(thingToJson(nb)) as Notebook;
    expect(back).toBeInstanceOf(Notebook);
    expect(back.isMain).toBe(true);
    expect((back.current() as TextThing).value).toBe('saved');
  });
});
