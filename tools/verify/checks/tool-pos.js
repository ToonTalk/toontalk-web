const out = [];
for (const id of (window.__spawn||[])) {
  const t = window.__ttWorld.all().find(x => x.id === id);
  out.push({ id, kind: t && t.kind, x: t && t.x, y: t && t.y });
}
return out;
