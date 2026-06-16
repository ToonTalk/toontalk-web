const anim = await import('/src/view/animation.ts');
const stage = window.__ttApp.stage;
// fly rightward (East); returns leftward (West)
anim.flyBird(stage, 300, 320, 1000, 320);
