const { Scale } = await import('/src/model/scale.ts');
const s = new Scale({ x: 320, y: 250 });
window.__ttWorld.add(s);
window.__scaleId = s.id;
