// Example --eval snippet for snap.mjs.
//
// The file body runs inside an async function IN THE PAGE, after the ticker
// has been pumped. `return` a JSON-serializable value; BigInts come back as
// strings like "12n". The debug globals are available:
//   __ttApp (PIXI app), __ttWorld (model World), __ttCity, __ttInput

const w = window.__ttWorld;
const arr = w ? w.all() : [];

return {
  count: arr.length,
  kinds: arr.map((t) => t.kind),
  described: arr.slice(0, 25).map((t) => t.describe()),
  city: window.__ttCity
    ? { active: window.__ttCity.isActive, mode: window.__ttCity.model.mode }
    : null,
};
