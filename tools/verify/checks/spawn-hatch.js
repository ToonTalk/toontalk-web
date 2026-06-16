const { Nest } = await import('/src/model/nest.ts');
const { hatchFromNest } = await import('/src/model/bird.ts');
const w = window.__ttWorld;
// screen = world - floorCamera(560,400). Egg nest (left) + hatched nest+bird (right).
const egg = new Nest({ x: 760, y: 680 });           // stays an egg (screen ~200,280)
w.add(egg);
const hatchedNest = new Nest({ x: 1120, y: 680 });   // will hatch (screen ~560,280)
w.add(hatchedNest);
const bird = hatchFromNest(w, hatchedNest, 1320, 640); // bird at screen ~760,240
window.__sizes = null;
const nv = window.__ttViews?.get?.(hatchedNest.id);
