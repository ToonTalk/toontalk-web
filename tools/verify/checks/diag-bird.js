const out = {};
// 1) is the directional asset served?
try {
  const r = await fetch('/assets/anim/bird-fly/0/00.png');
  out.asset_status = r.status;
} catch (e) { out.asset_err = String(e); }
// 2) does flyBird add a sprite to the stage?
const anim = await import('/src/view/animation.ts');
const stage = window.__ttApp.stage;
const before = stage.children.length;
anim.flyBird(stage, 300, 320, 1000, 320);
out.children_before = before;
out.children_after = stage.children.length;
out.added = stage.children.length - before;
return out;
