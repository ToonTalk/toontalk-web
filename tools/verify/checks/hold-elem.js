const { NumberThing } = await import('/src/model/number.ts');
const n = window.__ttWorld.add(new NumberThing({ value: 9 }));
window.__ttDrag.holdTool(n);
const d = window.__ttDrag;
return { heldIsNumber: d.heldTool?.thing?.id === n.id, heldKind: d.heldTool?.thing?.kind };
