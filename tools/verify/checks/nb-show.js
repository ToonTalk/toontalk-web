const { Notebook } = await import('/src/model/notebook.ts');
const { NumberThing } = await import('/src/model/number.ts');
const { TextThing } = await import('/src/model/text.ts');
const w = window.__ttWorld;
// a 2-page named notebook on clear floor (screen = world - cam 560,400)
const nb = new Notebook({ x: 900, y: 700, name: 'claude 1', pages: [new TextThing({ value: 'Pictures' }), new NumberThing({ value: 42 })] });
w.add(nb);
window.__ttRoom?.setHand?.(60, 60);
