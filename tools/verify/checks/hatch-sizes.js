// report rendered sizes by walking the stage for nest/bird-sized sprites
const out = { nestEmptyTex: null };
try {
  const r = await fetch('/assets/sprites/nest-empty.png'); out.nestEmptyServed = r.status;
} catch(e){ out.err = String(e); }
return out;
