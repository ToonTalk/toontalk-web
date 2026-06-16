// Trigger the bam-mouse directly for visual QA: dynamic-import the (already
// loaded) animation module and run runMouse on the stage. Vite serves the same
// module instance, so its `loaded` texture map is already populated from boot.
const anim = await import('/src/view/animation.ts');
const stage = window.__ttApp.stage;
window.__mouseBammed = false;
anim.runMouse(
  stage,
  { x: 150, y: 430 }, // runs in from the lower-left
  { x: 640, y: 430 }, // bams here (centre)
  { x: 1180, y: 430 }, // runs out to the lower-right
  () => {
    window.__mouseBammed = true;
  },
);
