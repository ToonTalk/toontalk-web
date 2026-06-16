const { Dusty } = await import('/src/model/dusty.ts');
const { Pumpy } = await import('/src/model/pumpy.ts');
const { Wand } = await import('/src/model/wand.ts');
const { Scale } = await import('/src/model/scale.ts');
const w = window.__ttWorld;
// screen = world - floorCamera(560,400); place around screen (250..950, 300)
w.add(new Wand({ x: 760, y: 680 }));
w.add(new Dusty({ x: 1010, y: 680 }));
w.add(new Pumpy({ x: 1240, y: 680 }));
w.add(new Scale({ x: 1450, y: 680 }));
