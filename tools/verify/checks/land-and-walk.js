// Hold ArrowDown to land, and once walking, point east so the person walks
// (the pre runs before the pump; pointer is read every pumped frame).
window.__ttCity.keys.add('ArrowDown');
window.__ttCity.pointer = { x: window.innerWidth * 0.8, y: window.innerHeight / 2 };
