let cam = null;
try { const fc = await import('/src/view/floor-camera.ts'); cam = { x: fc.floorCamera.x, y: fc.floorCamera.y }; } catch(e) { cam = 'err:'+e.message; }
// walk the stage tree for sprites matching the lego tool sizes
const hits = [];
const walk = (n) => {
  const tw = n.texture && n.texture.orig && n.texture.orig.width;
  if (tw && [247,254,106,71].includes(Math.round(tw))) {
    const g = n.getGlobalPosition ? n.getGlobalPosition() : {x:'?',y:'?'};
    hits.push({ w: Math.round(n.width), h: Math.round(n.height), gx: Math.round(g.x), gy: Math.round(g.y), vis: n.visible, wa: n.worldAlpha });
  }
  (n.children||[]).forEach(walk);
};
walk(window.__ttApp.stage);
return { cam, toolSprites: hits, stageChildren: window.__ttApp.stage.children.length };
