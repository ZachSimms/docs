/**
 * @file The playground's file tree: browse, open, create, rename, delete, set entry.
 *
 * Client component, drawn with the same `├──` connectors as the site's MDX
 * file trees. Keyboard: ↑/↓ move, →/← expand/collapse (or step in/out),
 * Enter opens a file or toggles a folder, F2 renames, Delete asks to delete.
 * Right-click (or Shift+F10 / the Menu key, or the `⋯` button on touch)
 * opens the file menu: rename, delete, set as entry, new file or folder,
 * copy path. Rename and delete continue inline (no browser dialogs). Rows are
 * at least 44px tall on touch screens (CSS).
 *
 * The tree never changes the project itself: it asks the parent through
 * `onCommand`, which returns an error message to show inline, or `null`.
 */

"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { FileMenu, type FileMenuItem } from "./FileMenu";
import {
  basename,
  dirname,
  joinPath,
  toTree,
  type Project,
  type TreeNode,
} from "@/lib/playground/project";

/** A change the tree asks the parent to make. */
export type TreeCommand =
  | { type: "add-file"; path: string }
  | { type: "add-dir"; path: string }
  | { type: "rename"; from: string; to: string }
  | { type: "remove"; path: string }
  | { type: "set-entry"; path: string };

/** Props for {@link FileTree}. */
interface FileTreeProps {
  project: Project;
  onOpen(path: string): void;
  /** Apply a change; returns an error to show, or `null`. */
  onCommand(command: TreeCommand): string | null;
  /** Collapse the tree panel (desktop) or close the Files pane (phones). */
  onHide?(): void;
  /** Show a Markdown file's preview (offered in the menu for `.md` files). */
  onPreview?(path: string): void;
}

/** One visible row. */
interface Row {
  node: TreeNode;
  depth: number;
  prefix: string;
}

/** What the inline editor is doing. */
type Editing =
  | { mode: "rename"; path: string; value: string }
  | { mode: "new-file" | "new-dir"; parent: string; value: string };

/** Flatten the tree into visible rows with their connector prefixes. */
function visibleRows(
  nodes: readonly TreeNode[],
  collapsed: ReadonlySet<string>,
  lead = "",
  depth = 0,
): Row[] {
  return nodes.flatMap((node, i) => {
    const last = i === nodes.length - 1;
    const row: Row = { node, depth, prefix: `${lead}${last ? "└── " : "├── "}` };
    if (node.kind === "file" || collapsed.has(node.path)) return [row];
    return [
      row,
      ...visibleRows(node.children, collapsed, `${lead}${last ? "    " : "│   "}`, depth + 1),
    ];
  });
}

/** The directory new files go in when `path` is selected. */
const containerOf = (node: TreeNode | undefined) =>
  !node ? "" : node.kind === "dir" ? node.path : dirname(node.path);

/** Render the tree. */
export function FileTree({ project, onOpen, onCommand, onHide, onPreview }: FileTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string>(project.open);
  /** The open context menu: for a row, or for the tree itself (`node: null`). */
  const [menu, setMenu] = useState<{ node: TreeNode | null; x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const rows = useMemo(() => visibleRows(toTree(project), collapsed), [project, collapsed]);
  const focusIndex = Math.max(
    0,
    rows.findIndex((r) => r.node.path === focused),
  );

  const toggle = (path: string, open?: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current);
      const shouldOpen = open ?? next.has(path);
      if (shouldOpen) next.delete(path);
      else next.add(path);
      return next;
    });

  const focusRow = (path: string) => {
    setFocused(path);
    rowRefs.current.get(path)?.focus();
  };

  const apply = (command: TreeCommand): boolean => {
    const problem = onCommand(command);
    setError(problem);
    return problem === null;
  };

  const activate = (node: TreeNode) => {
    setFocused(node.path);
    if (node.kind === "dir") toggle(node.path);
    else onOpen(node.path);
  };

  const startNew = (mode: "new-file" | "new-dir", parent: string) => {
    setMenu(null);
    setError(null);
    if (parent) toggle(parent, true);
    setEditing({ mode, parent, value: "" });
  };

  const commitEditing = () => {
    if (!editing) return;
    const value = editing.value.trim();
    if (!value) {
      setEditing(null);
      return;
    }
    const done =
      editing.mode === "rename"
        ? apply({ type: "rename", from: editing.path, to: joinPath(dirname(editing.path), value) })
        : apply({
            type: editing.mode === "new-file" ? "add-file" : "add-dir",
            path: joinPath(editing.parent, value),
          });
    if (done) setEditing(null);
  };

  const onEditKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEditing();
    } else if (event.key === "Escape") {
      event.preventDefault(); // handled here, not by page-level Esc
      setEditing(null);
      setError(null);
    }
  };

  const onTreeKey = (event: KeyboardEvent<HTMLUListElement>) => {
    // Only keys aimed at a row: the inline menus' buttons and inputs handle their own.
    if (
      editing ||
      !(event.target instanceof HTMLElement) ||
      event.target.getAttribute("role") !== "treeitem"
    )
      return;
    const row = rows[focusIndex];
    if (!row) return;
    const { node } = row;
    const move = (index: number) => {
      const target = rows[Math.max(0, Math.min(rows.length - 1, index))];
      if (target) focusRow(target.node.path);
    };
    const handled = (() => {
      switch (event.key) {
        case "ArrowDown":
          return (move(focusIndex + 1), true);
        case "ArrowUp":
          return (move(focusIndex - 1), true);
        case "Home":
          return (move(0), true);
        case "End":
          return (move(rows.length - 1), true);
        case "ArrowRight":
          if (node.kind === "dir" && collapsed.has(node.path)) toggle(node.path, true);
          else if (node.kind === "dir") move(focusIndex + 1);
          return true;
        case "ArrowLeft":
          if (node.kind === "dir" && !collapsed.has(node.path)) toggle(node.path, false);
          else if (dirname(node.path)) focusRow(dirname(node.path));
          return true;
        case "Enter":
        case " ":
          return (activate(node), true);
        case "F2":
          return (setEditing({ mode: "rename", path: node.path, value: node.name }), true);
        case "Delete":
        case "Backspace":
          return (setConfirmDelete(node.path), true);
        case "ContextMenu":
          return (openMenuAtRow(node), true);
        case "F10":
          if (!event.shiftKey) return false;
          return (openMenuAtRow(node), true);
        case "Escape":
          if (!confirmDelete && !error) return false;
          setConfirmDelete(null);
          setError(null);
          return true;
        default:
          return false;
      }
    })();
    if (handled) event.preventDefault();
  };

  const closeMenu = useCallback(() => setMenu(null), []);

  /** Open the menu under a row (keyboard). */
  const openMenuAtRow = (node: TreeNode) => {
    const rect = rowRefs.current.get(node.path)?.getBoundingClientRect();
    setMenu({ node, x: (rect?.left ?? 0) + 24, y: rect?.bottom ?? 0 });
  };

  /** Right-click: a row's menu, or the tree's own on empty space. */
  const onContextMenu = (event: MouseEvent<HTMLElement>, node: TreeNode | null) => {
    event.preventDefault();
    event.stopPropagation();
    setConfirmDelete(null);
    if (node) setFocused(node.path);
    setMenu({ node, x: event.clientX, y: event.clientY });
  };

  /** What the menu offers for a row, or for the tree root. */
  const menuItems = (node: TreeNode | null): FileMenuItem[] => {
    const where = containerOf(node ?? undefined);
    const create: FileMenuItem[] = [
      {
        id: "new-file",
        label: node ? "New file here" : "New file",
        run: () => startNew("new-file", where),
      },
      {
        id: "new-dir",
        label: node ? "New folder here" : "New folder",
        run: () => startNew("new-dir", where),
      },
    ];
    if (!node) return create;
    const isEntry = node.path === project.entry;
    return [
      ...(node.kind === "file" && onPreview && node.path.toLowerCase().endsWith(".md")
        ? [{ id: "preview", label: "Preview", run: () => onPreview(node.path) }]
        : []),
      {
        id: "rename",
        label: "Rename",
        hint: "F2",
        run: () => setEditing({ mode: "rename", path: node.path, value: node.name }),
      },
      { id: "delete", label: "Delete", hint: "Del", run: () => setConfirmDelete(node.path) },
      ...(node.kind === "file" && !isEntry
        ? [
            {
              id: "entry",
              label: "Set as entry",
              run: () => void apply({ type: "set-entry", path: node.path }),
            },
          ]
        : []),
      ...create,
      {
        id: "copy",
        label: "Copy path",
        run: () => void navigator.clipboard?.writeText(node.path).catch(() => undefined),
      },
    ];
  };

  const nameInput = (value: string, label: string) => (
    <input
      className="pg-tree-input"
      aria-label={label}
      value={value}
      autoFocus
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onChange={(event) =>
        setEditing((current) => current && { ...current, value: event.target.value })
      }
      onKeyDown={onEditKey}
      onBlur={commitEditing}
    />
  );

  const newRowFor = (parent: string, depth: number) =>
    editing && editing.mode !== "rename" && editing.parent === parent ? (
      <li className="pg-tree-row pg-tree-new" style={{ paddingInlineStart: `${depth * 4}ch` }}>
        {nameInput(
          editing.value,
          editing.mode === "new-file" ? "New file name" : "New folder name",
        )}
      </li>
    ) : null;

  return (
    <div className="pg-tree">
      <div className="pg-tree-bar">
        <span>Files</span>
        <span className="pg-tree-actions">
          <button
            type="button"
            className="link"
            onClick={() => startNew("new-file", containerOf(rows[focusIndex]?.node))}
          >
            <i>+ file</i>
          </button>
          <button
            type="button"
            className="link"
            onClick={() => startNew("new-dir", containerOf(rows[focusIndex]?.node))}
          >
            <i>+ dir</i>
          </button>
          {onHide && (
            <button
              type="button"
              className="link"
              aria-label="Hide files"
              title="Hide files"
              onClick={onHide}
            >
              <i>«</i>
            </button>
          )}
        </span>
      </div>
      <ul
        role="tree"
        aria-label="Project files"
        className="pg-tree-list"
        onKeyDown={onTreeKey}
        onContextMenu={(event) => onContextMenu(event, null)}
      >
        {newRowFor("", 0)}
        {rows.map(({ node, depth, prefix }, index) => {
          const isOpen = node.kind === "file" && node.path === project.open;
          const isEntry = node.path === project.entry;
          const renaming = editing?.mode === "rename" && editing.path === node.path;
          return [
            <li
              key={node.path}
              ref={(el) => {
                if (el) rowRefs.current.set(node.path, el);
                else rowRefs.current.delete(node.path);
              }}
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={node.kind === "dir" ? !collapsed.has(node.path) : undefined}
              aria-selected={isOpen}
              aria-current={isOpen ? "true" : undefined}
              tabIndex={index === focusIndex ? 0 : -1}
              className="pg-tree-row"
              data-kind={node.kind}
              data-path={node.path}
              onFocus={() => setFocused(node.path)}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest(".pg-tree-more, input")) return;
                activate(node);
              }}
              onDoubleClick={() =>
                setEditing({ mode: "rename", path: node.path, value: node.name })
              }
              onContextMenu={(event) => onContextMenu(event, node)}
            >
              <span className="pg-tree-prefix" aria-hidden="true">
                {prefix}
              </span>
              {renaming ? (
                nameInput(editing.value, `Rename ${node.path}`)
              ) : (
                <span className="pg-tree-name">
                  {isEntry && (
                    <span className="pg-tree-entry" title="Entry file">
                      ▶{" "}
                    </span>
                  )}
                  {node.name}
                  {node.kind === "dir" ? "/" : ""}
                </span>
              )}
              {isOpen && (
                <span className="pg-tree-open" aria-hidden="true">
                  {" "}
                  ◀
                </span>
              )}
              <button
                type="button"
                className="pg-tree-more"
                tabIndex={-1}
                aria-label={`Actions for ${node.path}`}
                aria-haspopup="menu"
                aria-expanded={menu?.node?.path === node.path}
                onClick={(event) => {
                  setConfirmDelete(null);
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenu(
                    menu?.node?.path === node.path ? null : { node, x: rect.left, y: rect.bottom },
                  );
                }}
              >
                ⋯
              </button>
            </li>,
            confirmDelete === node.path && (
              <li key={`${node.path}#delete`} className="pg-tree-menu" role="none">
                <span>
                  delete {basename(node.path)}
                  {node.kind === "dir" ? "/ and everything in it" : ""}?
                </span>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setConfirmDelete(null);
                    if (apply({ type: "remove", path: node.path })) focusRow(project.entry);
                  }}
                >
                  <i>yes</i>
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => (setConfirmDelete(null), focusRow(node.path))}
                >
                  <i>no</i>
                </button>
              </li>
            ),
            node.kind === "dir" && !collapsed.has(node.path) ? (
              <NewRowSlot key={`${node.path}#new`}>{newRowFor(node.path, depth + 1)}</NewRowSlot>
            ) : null,
          ];
        })}
      </ul>
      {error && (
        <p className="pg-tree-error" role="alert">
          {error}
        </p>
      )}
      {menu && (
        <FileMenu
          label={menu.node ? `Actions for ${menu.node.path}` : "Project files"}
          items={menuItems(menu.node)}
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

/** Keyed wrapper so the inline "new file" row can sit inside a mapped list. */
function NewRowSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
