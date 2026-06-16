// give runMouse real time to reach the strike, then report
await new Promise(r => setTimeout(r, 1400));
return { bammed: window.__mouseBammed === true };
