// Confirms the toolbox→hand wiring exists at runtime.
const drag = window.__ttDrag;
const room = window.__ttRoom;
return { holdTool: typeof drag?.holdTool, room: !!room, things: window.__ttWorld?.size };
