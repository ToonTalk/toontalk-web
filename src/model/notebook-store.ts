/**
 * Persistence for the **main notebook** — the only thing that survives between
 * sessions in ToonTalk (the floor is transient working space). We store just the
 * main notebook's snapshot; on load it's rebuilt as a live `Notebook`.
 *
 * (One main notebook for now; per-user named notebooks come later.)
 */
import { Notebook } from './notebook';
import { thingToJson, thingFromJson } from './persistence';

const KEY = 'toontalk-main-notebook-v1';

export function saveMainNotebook(nb: Notebook): void {
  try {
    localStorage.setItem(KEY, thingToJson(nb));
  } catch {
    // storage full / unavailable — saving is best-effort
  }
}

/** Load the saved main notebook, or null if none / unreadable. */
export function loadMainNotebook(): Notebook | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const t = thingFromJson(raw);
    if (t instanceof Notebook) {
      t.isMain = true;
      return t;
    }
  } catch {
    // corrupt — fall through to a fresh notebook
  }
  return null;
}

export function clearMainNotebook(): void {
  localStorage.removeItem(KEY);
}
