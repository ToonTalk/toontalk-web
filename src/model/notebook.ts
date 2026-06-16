/**
 * A notebook — ToonTalk's storage. It holds a list of pages, each page a stored
 * thing, and shows one page at a time. Dropping a thing on a notebook files it
 * as a new page; dropping a *number* flips to that page (number → page). Pulling
 * from a notebook gives a *copy* of the current page (the notebook keeps its
 * own), so a notebook is a reusable library.
 *
 * (In full ToonTalk the *main* notebook is the real save/load + module model;
 * we keep notebooks as ordinary things for now.) Pure logic — no rendering.
 */
import { Thing, type ThingKind, type ThingSnapshot } from './thing';
import { TextThing } from './text';

export interface NotebookSnapshot extends ThingSnapshot {
  pages: ThingSnapshot[];
  index: number;
  isMain?: boolean;
  name?: string;
}

export class Notebook extends Thing {
  readonly kind = 'notebook' as const;
  readonly pages: Thing[];
  /** The currently shown page (0-based). */
  index: number;
  /**
   * The main (first) notebook — the one that follows you in the toolbox and
   * persists across sessions (the real save model). Secondary notebooks are
   * transient unless filed onto a main-notebook page.
   */
  isMain: boolean;
  /** The notebook's name, shown along the bottom of the open book (the
   * original's "claude 1"). Optional — undefined shows no name. */
  name?: string;

  constructor(
    opts: {
      id?: string;
      x?: number;
      y?: number;
      pages?: Thing[];
      index?: number;
      isMain?: boolean;
      name?: string;
    } = {},
  ) {
    super(opts);
    this.pages = opts.pages ?? [];
    this.index = opts.index ?? 0;
    this.isMain = opts.isMain ?? false;
    this.name = opts.name;
  }

  protected override kindForId(): ThingKind {
    return 'notebook';
  }

  get count(): number {
    return this.pages.length;
  }

  /** File a thing as a new page and turn to it. */
  store(thing: Thing): void {
    this.pages.push(thing);
    this.index = this.pages.length - 1;
  }

  /** The page currently shown, or null if empty. */
  current(): Thing | null {
    return this.pages[this.index] ?? null;
  }

  /** Turn `delta` pages (clamped). */
  flip(delta: number): void {
    if (this.pages.length === 0) return;
    this.index = Math.max(0, Math.min(this.pages.length - 1, this.index + delta));
  }

  /** Turn to a 1-based page number (clamped). */
  goTo(page: number): void {
    if (this.pages.length === 0) return;
    this.index = Math.max(0, Math.min(this.pages.length - 1, Math.trunc(page) - 1));
  }

  /**
   * Flip to the first text page whose value *starts with* `text` (the manual's
   * "drop 'ma' → finds 'mat'"). Returns whether a page was found.
   */
  findText(text: string): boolean {
    const i = this.pages.findIndex((p) => p instanceof TextThing && p.value.startsWith(text));
    if (i < 0) return false;
    this.index = i;
    return true;
  }

  /** Remove the current page (only Dusty does this). Returns the removed page. */
  removeCurrent(): Thing | null {
    if (this.pages.length === 0) return null;
    const [removed] = this.pages.splice(this.index, 1);
    if (this.index >= this.pages.length) this.index = Math.max(0, this.pages.length - 1);
    return removed ?? null;
  }

  copy(): Notebook {
    return new Notebook({
      x: this.x,
      y: this.y,
      pages: this.pages.map((p) => p.copy()),
      index: this.index,
      // a copy is a secondary (transient) notebook, never the main one
    });
  }

  equals(other: Thing): boolean {
    return other instanceof Notebook;
  }

  describe(): string {
    return `notebook(${this.pages.length})`;
  }

  override snapshot(): NotebookSnapshot {
    return {
      ...super.snapshot(),
      pages: this.pages.map((p) => p.snapshot()),
      index: this.index,
      ...(this.isMain ? { isMain: true } : {}),
      ...(this.name ? { name: this.name } : {}),
    };
  }
}
