/**
 * @file `/playground/`: a browser IDE with a file tree, editor, console and reference panel.
 *
 * Client component (loaded without SSR by `PlaygroundLoader`, since everything
 * it shows comes from `localStorage`). Layout by width, in CSS:
 * - ≥ 1024px: tree | editor + console (or preview) | reference panel, every
 *   part resizable from its edge (sizes in `Prefs.layout`);
 * - 768–1023px: the tree and the panel become drawers;
 * - < 768px: one pane at a time, switched by the bottom tab bar
 *   (Code, Files, Output, Refs); Run jumps to Output.
 * Zen mode (⌘⌥Z) keeps only the editor, output and reference panel.
 *
 * Security: this component never evaluates user code. Running goes through
 * `usePlaygroundRun` (sandboxed frames and remote services).
 */

"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { isTypingTarget } from "@/lib/keys";
import { getLanguage, modeForPath, type LanguageId } from "@/lib/playground/languages";
import { layoutStyle, resize, type LayoutPart } from "@/lib/playground/layout";
import {
  addDir,
  addFile,
  basename,
  closeTab,
  remove,
  rename,
  setEntry,
  setOpen,
  updateFile,
} from "@/lib/playground/project";
import { isHelpShortcut, isZenShortcut, type TourStep } from "@/lib/playground/shortcuts";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/playground/storage";
import { isSheetUrl, OPEN_REFERENCE_EVENT } from "@/lib/reference-panel";
import { CodeEditor, type EditorHandle } from "./CodeEditor";
import { ConsolePane } from "./ConsolePane";
import { FileTree, type TreeCommand } from "./FileTree";
import { HelpPanel } from "./HelpPanel";
import { PlaygroundToolbar } from "./PlaygroundToolbar";
import { ReferencePanel } from "./ReferencePanel";
import { Splitter } from "./Splitter";
import { SymbolRow } from "./SymbolRow";
import { Tour } from "./Tour";
import { usePlaygroundRun } from "./usePlaygroundRun";
import { useProjects } from "./useProjects";
import { WebPreview } from "./WebPreview";

/** The panes a phone shows one at a time. */
export type Pane = TourStep["pane"];
const PANES: readonly { id: Pane; label: string }[] = [
  { id: "code", label: "Code" },
  { id: "files", label: "Files" },
  { id: "output", label: "Output" },
  { id: "refs", label: "Refs" },
];

/** Whether the primary pointer is coarse (a touch screen). */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(pointer: coarse)");
    if (!query) return;
    const update = () => setCoarse(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return coarse;
}

/** Render the playground. */
export function Playground() {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const language = prefs.language;
  const spec = getLanguage(language);
  const { project, setProject, saveFailed } = useProjects(language);
  const runState = usePlaygroundRun();
  const [pane, setPane] = useState<Pane>("code");
  const [refsOpen, setRefsOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [askDownload, setAskDownload] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [requested, setRequested] = useState<{ url: string; n: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const editor = useRef<EditorHandle | null>(null);
  const coarse = useCoarsePointer();

  const updatePrefs = useCallback((change: Partial<Prefs>) => {
    setPrefs((current) => ({ ...current, ...change }));
  }, []);

  // Persist preferences whenever they change (outside the state updater, which must stay pure).
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const setSize = useCallback(
    (part: LayoutPart) => (size: number) =>
      setPrefs((current) => ({ ...current, layout: resize(current.layout, part, size) })),
    [],
  );

  const toggleZen = useCallback(
    () => setPrefs((current) => ({ ...current, zen: !current.zen })),
    [],
  );

  // Zen mode (⌘⌥Z) and help (F1, ⌘/) from anywhere; Esc outside the editor leaves zen mode.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isZenShortcut(event)) {
        event.preventDefault();
        toggleZen();
      } else if (isHelpShortcut(event)) {
        event.preventDefault();
        setHelpOpen(true);
      } else if (event.key === "Escape" && prefs.zen && !isTypingTarget(event.target)) {
        event.preventDefault(); // handled: page-level Esc (go up a level) must not also fire
        updatePrefs({ zen: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.zen, toggleZen, updatePrefs]);

  // New output while another pane is showing on a phone marks the Output tab;
  // looking at the Output pane clears it.
  const outputSize = runState.output.size;
  const [seenOutput, setSeenOutput] = useState(0);
  if (pane === "output" && seenOutput !== outputSize) setSeenOutput(outputSize);
  const unread = pane !== "output" && outputSize > 0 && outputSize !== seenOutput;

  // ⌘K results chosen on the playground open in the reference panel (see SearchPalette).
  useEffect(() => {
    const onOpen = (event: Event) => {
      const url = (event as CustomEvent<{ url?: unknown }>).detail?.url;
      if (!isSheetUrl(url)) return;
      setRequested((current) => ({ url, n: (current?.n ?? 0) + 1 }));
      setRefsOpen(true);
      setPane("refs");
    };
    window.addEventListener(OPEN_REFERENCE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_REFERENCE_EVENT, onOpen);
  }, []);

  const stdin = prefs.stdin[language] ?? spec.stdinExample ?? "";

  const startRun = useCallback(() => {
    if (spec.runner === "web") {
      setPreviewKey((k) => k + 1);
    } else {
      runState.run(language, project, stdin);
    }
    setPane("output");
  }, [spec.runner, runState, language, project, stdin]);

  const run = useCallback(() => {
    if (spec.download && !prefs.approvedDownloads.includes(language)) {
      setAskDownload(true);
      setPane("output");
      return;
    }
    startRun();
  }, [spec.download, prefs.approvedDownloads, language, startRun]);

  const approveDownload = () => {
    updatePrefs({ approvedDownloads: [...prefs.approvedDownloads, language] });
    setAskDownload(false);
    startRun();
  };

  const chooseLanguage = (id: LanguageId) => {
    runState.stop();
    runState.clear();
    setAskDownload(false);
    updatePrefs({ language: id });
    setResetKey((k) => k + 1);
  };

  // The latest project, for checks made in event handlers.
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  });

  const onEdit = useCallback(
    (path: string, value: string) => {
      // Over the size limit the edit stays in the editor but isn't kept: say so until an edit fits.
      const check = updateFile(projectRef.current, path, value);
      setNotice(check.ok ? null : `${check.error} This change isn't saved.`);
      setProject((current) => {
        const result = updateFile(current, path, value);
        return result.ok ? result.project : current;
      });
    },
    [setProject],
  );

  const openFile = (path: string) => {
    const result = setOpen(project, path);
    if (result.ok) setProject(result.project);
    setPane("code");
  };

  const onTreeCommand = (command: TreeCommand): string | null => {
    const result = (() => {
      switch (command.type) {
        case "add-file":
          return addFile(project, command.path);
        case "add-dir":
          return addDir(project, command.path);
        case "rename":
          return rename(project, command.from, command.to);
        case "remove":
          return remove(project, command.path);
        case "set-entry":
          return setEntry(project, command.path);
      }
    })();
    if (!result.ok) return result.error;
    setProject(result.project);
    if (command.type === "add-file") setPane("code");
    return null;
  };

  const reset = () => {
    runState.stop();
    runState.clear();
    setProject(spec.template);
    setResetKey((k) => k + 1);
  };

  const startTour = () => {
    setHelpOpen(false);
    updatePrefs({ welcomed: true, zen: false });
    setTouring(true);
  };

  const endTour = useCallback(() => setTouring(false), []);

  const isRunning = runState.phase === "running";
  const code = project.files[project.open] ?? "";
  const indent = modeForPath(project.open) === "gdscript" ? "\t" : "  ";
  const showTree = !prefs.zen && (prefs.treeOpen || pane === "files");
  const showRefs = refsOpen || pane === "refs";
  const welcome =
    prefs.welcomed || runState.output.chunks.length > 0 ? null : (
      <div className="pg-welcome" role="note">
        <p>New here? Pick a project, edit, press ▶ Run (⌘↵).</p>
        <p>
          <button type="button" className="link" onClick={startTour}>
            <i>take the 1-minute tour</i>
          </button>
          {"  ·  "}
          <button type="button" className="link" onClick={() => setHelpOpen(true)}>
            <i>help (F1)</i>
          </button>
          {"  ·  "}
          <button type="button" className="link" onClick={() => updatePrefs({ welcomed: true })}>
            <i>dismiss</i>
          </button>
        </p>
      </div>
    );

  return (
    <div
      className="playground"
      data-no-tap-nav=""
      data-pane={pane}
      data-runner={spec.runner}
      data-refs={showRefs ? "open" : "closed"}
      data-tree={prefs.treeOpen ? "open" : "closed"}
      data-zen={prefs.zen ? "on" : "off"}
      style={layoutStyle(prefs.layout) as CSSProperties}
    >
      {prefs.zen ? (
        <div className="pg-zenbar" role="toolbar" aria-label="Zen mode">
          <button type="button" className="link" onClick={run} disabled={isRunning}>
            <i>▶ Run</i>
          </button>
          <button
            type="button"
            className="link"
            aria-expanded={refsOpen}
            onClick={() => setRefsOpen((o) => !o)}
          >
            <i>Refs</i>
          </button>
          <button
            type="button"
            className="link"
            onClick={toggleZen}
            title="Leave zen mode (Esc, ⌘⌥Z)"
          >
            <i>✕ zen</i>
          </button>
        </div>
      ) : (
        <PlaygroundToolbar
          spec={spec}
          running={isRunning}
          canStop={isRunning || runState.live}
          refsOpen={refsOpen}
          notice={saveFailed ? "couldn't save (storage full or disabled)" : notice}
          onLanguage={chooseLanguage}
          onRun={run}
          onStop={runState.stop}
          onReset={reset}
          onZen={toggleZen}
          onHelp={() => setHelpOpen(true)}
          onRefs={() => setRefsOpen((open) => !open)}
        />
      )}

      <div className="pg-main">
        <nav className="pg-files" aria-label="Files" data-tour="files">
          {showTree ? (
            <>
              <FileTree
                key={language}
                project={project}
                onOpen={openFile}
                onCommand={onTreeCommand}
                onHide={() =>
                  pane === "files" ? setPane("code") : updatePrefs({ treeOpen: false })
                }
              />
              <Splitter
                part="tree"
                edge="right"
                size={prefs.layout.tree}
                onSize={setSize("tree")}
              />
            </>
          ) : (
            !prefs.zen && (
              <button
                type="button"
                className="link pg-tree-show"
                aria-label="Show files"
                title="Show files"
                onClick={() => updatePrefs({ treeOpen: true })}
              >
                <i>»</i>
              </button>
            )
          )}
        </nav>

        <div className="pg-work">
          <div className="pg-tabs" role="group" aria-label="Open files">
            {project.tabs.map((tab) => (
              <span
                key={tab}
                className="pg-tab"
                data-active={tab === project.open ? "" : undefined}
              >
                <button
                  type="button"
                  aria-current={tab === project.open ? "true" : undefined}
                  title={tab}
                  onClick={() => openFile(tab)}
                >
                  {basename(tab)}
                </button>
                <button
                  type="button"
                  className="pg-tab-close"
                  aria-label={`Close ${tab}`}
                  onClick={() => setProject(closeTab(project, tab))}
                >
                  ×
                </button>
              </span>
            ))}
            <span className="pg-tabs-end">
              <button
                type="button"
                className="link"
                aria-pressed={prefs.wrap}
                onClick={() => updatePrefs({ wrap: !prefs.wrap })}
                title="Soft-wrap long lines"
              >
                <i>wrap</i>
              </button>
            </span>
          </div>
          <div
            className="pg-code"
            role="region"
            aria-label={`Editing ${project.open}`}
            data-tour="editor"
          >
            <CodeEditor
              path={project.open}
              paths={Object.keys(project.files)}
              value={code}
              onChange={onEdit}
              onRun={run}
              key={`${language}:${resetKey}`}
              wrap={prefs.wrap}
              handleRef={editor}
              onFocusChange={setEditorFocused}
            />
          </div>
          <div className="pg-out" data-tour="output">
            <Splitter
              part="output"
              edge="top"
              size={prefs.layout.output}
              onSize={setSize("output")}
            />
            {spec.runner === "web" && (
              <WebPreview
                project={project}
                refreshKey={previewKey}
                onReload={runState.clear}
                onOutput={runState.appendExternal}
                resizer={
                  <Splitter
                    part="preview"
                    edge="right"
                    size={prefs.layout.preview}
                    onSize={setSize("preview")}
                  />
                }
              />
            )}
            {spec.runner === "godot" && (
              <section className="pg-godot" aria-label="Godot view">
                <Splitter
                  part="godot"
                  edge="left"
                  size={prefs.layout.godot}
                  onSize={setSize("godot")}
                />
                <div className="pg-bar">
                  <span>Godot</span>
                  <span className="pg-status">
                    {runState.godotFrame ? "engine view" : "loads on the first run"}
                  </span>
                </div>
                {runState.godotFrame}
              </section>
            )}
            <ConsolePane
              spec={spec}
              output={runState.output}
              phase={runState.phase}
              status={runState.status}
              stdin={stdin}
              onStdin={(value) => updatePrefs({ stdin: { ...prefs.stdin, [language]: value } })}
              onClear={runState.clear}
              askDownload={askDownload}
              onApproveDownload={approveDownload}
              onCancelDownload={() => setAskDownload(false)}
              welcome={welcome}
            />
          </div>
        </div>

        {showRefs && (
          <ReferencePanel
            suggestions={spec.refs}
            width={prefs.layout.refs}
            onWidth={setSize("refs")}
            onClose={() => (setRefsOpen(false), pane === "refs" && setPane("code"))}
            requested={requested}
          />
        )}
      </div>

      <div className="pg-panes" role="tablist" aria-label="Playground panes">
        {PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pane === p.id}
            data-tour={p.id === "refs" ? "refs" : p.id === "files" ? "files" : undefined}
            onClick={() => setPane(p.id)}
          >
            {p.label}
            {p.id === "output" && unread && (
              <span className="pg-unread" aria-label="(new output)">
                {" "}
                •
              </span>
            )}
          </button>
        ))}
      </div>

      <SymbolRow
        handleRef={editor}
        indent={indent}
        visible={coarse && editorFocused && pane === "code"}
      />
      {helpOpen && (
        <HelpPanel open spec={spec} onClose={() => setHelpOpen(false)} onTour={startTour} />
      )}
      {touring && <Tour onPane={setPane} onDone={endTour} />}
      <div className="pg-frames">{runState.frames}</div>
    </div>
  );
}
