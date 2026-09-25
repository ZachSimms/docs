/**
 * @file `<Tabs>` / `<Tab>`: switchable panels.
 *
 * `<Tabs>` is a client component holding the selected index; the panels are
 * whatever the MDX author wrote inside each `<Tab>`, rendered on the server
 * and passed through as children. Tab controls are `button.link`s in a
 * `role="tablist"` line; the active one is underlined solid, like the table
 * of contents and the search palette.
 *
 * `persist="key"` keeps every `<Tabs>` with the same key in sync on the page
 * and remembers the choice in `localStorage` (`tabs:key`). Persisted groups
 * read the stored label through `useSyncExternalStore`, so the server renders
 * the default tab and the client switches to the stored one on hydration
 * without an effect.
 */

"use client";

import {
  Children,
  Fragment,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/** Props for {@link Tabs}. */
interface TabsProps {
  /** Tab labels, in the same order as the `<Tab>` children. */
  items: readonly string[];
  /** One `<Tab>` per item. */
  children: ReactNode;
  /** Initially selected tab; clamped to the valid range. */
  defaultIndex?: number;
  /** Sync key: tab groups sharing it select together and remember the choice. */
  persist?: string;
}

/** Window event fired when a persisted group changes, so sibling groups follow. */
const SYNC_EVENT = "tabs:change";

/** `localStorage` key for a persisted group. */
function storageKey(persist: string): string {
  return `tabs:${persist}`;
}

/** Read a persisted label, or `null` when nothing is stored or storage is unavailable. */
function readPersisted(persist: string): string | null {
  try {
    return localStorage.getItem(storageKey(persist));
  } catch {
    return null;
  }
}

/** Store a label for the group and notify other groups on the page. */
function writePersisted(persist: string, label: string): void {
  try {
    localStorage.setItem(storageKey(persist), label);
  } catch {
    // Storage disabled: the selection still applies for this page.
  }
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { persist, label } }));
}

/** Clamp an index into `[0, count)`; `0` when there are no items. */
function clamp(index: number, count: number): number {
  if (count === 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

/** `useSyncExternalStore` subscription for persisted groups: this page's sync event and other tabs' storage events. */
function subscribePersist(onChange: () => void): () => void {
  window.addEventListener(SYNC_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SYNC_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Subscription for groups without `persist`: nothing external to watch. */
function subscribeNothing(): () => void {
  return () => {};
}

/** Server snapshot: no stored choice is known during SSR. */
function getServerSnapshot(): null {
  return null;
}

/**
 * Tabbed panels. See the file header for behaviour. Keyboard on the tab
 * list: ←/→ move, Home/End jump, focus follows the selection.
 */
export function Tabs({ items, children, defaultIndex = 0, persist }: TabsProps) {
  const panels = Children.toArray(children);
  const id = useId();
  const [localIndex, setLocalIndex] = useState(() => clamp(defaultIndex, items.length));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Persisted groups read their selection from storage; it updates whenever any group writes.
  const persisted = useSyncExternalStore(
    persist ? subscribePersist : subscribeNothing,
    () => (persist ? readPersisted(persist) : null),
    getServerSnapshot,
  );
  const persistedIndex = persisted === null ? -1 : items.indexOf(persisted);
  const index = persistedIndex !== -1 ? persistedIndex : localIndex;

  /** Select a tab by index, persisting if configured. */
  const select = (next: number, focus = false) => {
    const clamped = clamp(next, items.length);
    setLocalIndex(clamped);
    if (focus) tabRefs.current[clamped]?.focus();
    const label = items[clamped];
    if (persist && label !== undefined) writePersisted(persist, label);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: index + 1 > last ? 0 : index + 1,
      ArrowLeft: index - 1 < 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  };

  return (
    <div className="tabs">
      <p className="tabs-list" role="tablist" onKeyDown={onKeyDown}>
        {items.map((item, i) => (
          <Fragment key={item}>
            {i > 0 && "  "}
            <button
              type="button"
              role="tab"
              className="link"
              id={`${id}-tab-${i}`}
              aria-selected={i === index}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={i === index ? 0 : -1}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => select(i)}
            >
              <i>{item}</i>
            </button>
          </Fragment>
        ))}
      </p>
      {panels.map((panel, i) => (
        <div
          key={items[i] ?? i}
          role="tabpanel"
          id={`${id}-panel-${i}`}
          aria-labelledby={`${id}-tab-${i}`}
          hidden={i !== index}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}

/** One panel. A transparent wrapper so MDX inside stays server-rendered. */
export function Tab({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
