/**
 * Lightweight debug log: a ring buffer surfaced both on the console and in a
 * copyable on-screen panel, so a tester can paste a trace of what happened.
 * Toggle the panel with the toolbar "Log" button; click the panel to copy it.
 */
const buffer: string[] = [];
const MAX = 400;
const t0 = performance.now();
let panel: HTMLPreElement | null = null;

/** A compact one-line description of a thing for the log (loosely typed so this
 * stays a dependency-free leaf module). */
export function desc(t: unknown): string {
  const o = t as { kind?: string; value?: unknown; size?: number; mode?: string; actions?: unknown[] } | null | undefined;
  if (!o || !o.kind) return '(none)';
  switch (o.kind) {
    case 'number': return `num(${o.value})`;
    case 'text': return `text("${o.value}")`;
    case 'box': return `box[${o.size}]`;
    case 'dusty': return `dusty(${o.mode})`;
    case 'wand': return 'wand';
    case 'pumpy': return 'pumpy';
    case 'robot': return `robot(${o.actions?.length ?? 0}a)`;
    default: return o.kind;
  }
}

export function tlog(msg: string): void {
  const line = `${((performance.now() - t0) / 1000).toFixed(1)}s  ${msg}`;
  buffer.push(line);
  if (buffer.length > MAX) buffer.shift();
  // eslint-disable-next-line no-console
  console.log('[TT] ' + line);
  if (panel) {
    panel.textContent = buffer.join('\n');
    panel.scrollTop = panel.scrollHeight;
  }
}

export function debugLogText(): string {
  return buffer.join('\n');
}

/** Show/hide the copyable log panel (bottom-left). Clicking it copies the text. */
export function toggleDebugPanel(): void {
  if (panel) {
    panel.remove();
    panel = null;
    return;
  }
  panel = document.createElement('pre');
  panel.id = 'tt-debug-log';
  panel.style.cssText =
    'position:absolute;left:8px;bottom:8px;z-index:50;max-width:48vw;max-height:42vh;overflow:auto;' +
    'margin:0;padding:6px 9px;background:rgba(0,0,0,0.74);color:#9fe7ff;border-radius:6px;' +
    'font:11px/1.35 ui-monospace,Consolas,monospace;white-space:pre-wrap;user-select:text;cursor:copy';
  panel.title = 'click to copy';
  panel.textContent = buffer.join('\n') || '(log empty — interact with the app)';
  panel.addEventListener('click', () => {
    void navigator.clipboard?.writeText(debugLogText());
    if (panel) panel.style.outline = '2px solid #6f6';
    setTimeout(() => { if (panel) panel.style.outline = ''; }, 250);
  });
  document.body.appendChild(panel);
  panel.scrollTop = panel.scrollHeight;
}

// Console fallback: run `copy(window.__ttLog())` in DevTools to grab the log.
(window as unknown as { __ttLog?: () => string }).__ttLog = debugLogText;
