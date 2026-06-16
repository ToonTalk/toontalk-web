const anim = await import('/src/view/animation.ts');
const stage = window.__ttApp.stage;
// nest at (500,450); the bird hatches and flies up-right to (760,300)
anim.hatchNest(stage, 500, 450, 760, 300);
