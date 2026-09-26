/**
 * @file The file tree's context menu (right-click, Shift+F10, the Menu key, or `⋯`).
 *
 * Client component. A `role="menu"` popup at the pointer (or under the row),
 * kept inside the viewport. ↑/↓/Home/End move, Enter or Space runs an item,
 * Esc or Tab closes; focus goes back to where it came from. No browser dialogs:
 * rename and delete continue inline in the tree.
 */

"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

/** One entry of the menu. */
export interface FileMenuItem {
  readonly id: string;
  readonly label: string;
  /** A shortcut shown on the right, e.g. "F2". */
  readonly hint?: string;
  run(): void;
}

/** Props for {@link FileMenu}. */
interface FileMenuProps {
  /** What the menu is for, for screen readers ("Actions for src/App.tsx"). */
  label: string;
  items: readonly FileMenuItem[];
  /** Viewport coordinates of the pointer, or of the row the menu belongs to. */
  x: number;
  y: number;
  onClose(): void;
}

/** Gap kept between the menu and the viewport edges. */
const MARGIN = 8;

/** Render the menu. */
export function FileMenu({ label, items, x, y, onClose }: FileMenuProps) {
  const menu = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: x, top: y });
  const opener = useRef<Element | null>(null);

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN)),
      top: Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN)),
    });
  }, [x, y]);

  // Focus the first item; give focus back on close; close on outside clicks and scrolling.
  useEffect(() => {
    opener.current = document.activeElement;
    const list = menu.current;
    list?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!list?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("resize", onClose);
      // Give focus back only if nothing else took it (an item may have opened an input).
      const current = document.activeElement;
      const free = current === null || current === document.body || list?.contains(current);
      if (free && opener.current instanceof HTMLElement && opener.current.isConnected)
        opener.current.focus();
    };
  }, [onClose]);

  const focusItem = (index: number) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusItem(active + 1),
      ArrowUp: () => focusItem(active - 1),
      Home: () => focusItem(0),
      End: () => focusItem(items.length - 1),
      Escape: onClose,
      Tab: onClose,
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    event.stopPropagation(); // the tree and page-level shortcuts must not see these
    action();
  };

  const choose = (item: FileMenuItem) => {
    onClose();
    item.run();
  };

  return (
    <ul
      ref={menu}
      role="menu"
      aria-label={label}
      className="pg-menu"
      style={{ left: position.left, top: position.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, i) => (
        <li
          key={item.id}
          role="menuitem"
          tabIndex={i === active ? 0 : -1}
          onClick={() => choose(item)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            choose(item);
          }}
          onPointerEnter={() => focusItem(i)}
        >
          <span>{item.label}</span>
          {item.hint && <kbd>{item.hint}</kbd>}
        </li>
      ))}
    </ul>
  );
}
