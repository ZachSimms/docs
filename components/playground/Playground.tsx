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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
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
import { NODE_ROUTE, nodeSupport, type NodeSupport } from "@/lib/playground/webcontainer";
import {
  isSheetUrl,
  OPEN_DOCS_EVENT,
  OPEN_REFERENCE_EVENT,
  parseDocRequest,
  PLAYGROUND_PATH,
  type DocRequest,
} from "@/lib/reference-panel";
import { CodeEditor, type EditorHandle } from "./CodeEditor";
import { ConsolePane } from "./ConsolePane";
import { FileTree, type TreeCommand } from "./FileTree";
import { HelpPanel } from "./HelpPanel";
import { HttpClient } from "./HttpClient";
import { MarkdownPreview } from "./MarkdownPreview";
import { NodePanel } from "./NodePanel";
import { PlaygroundToolbar } from "./PlaygroundToolbar";
import { ReferencePanel } from "./ReferencePanel";
import { Splitter } from "./Splitter";
import { SymbolRow } from "./SymbolRow";
import { Tour } from "./Tour";
import { useNodeRun } from "./useNodeRun";
import { usePlaygroundRun } from "./usePlaygroundRun";
import { useProjects } from "./useProjects";
import { useIntellisense } from "./intellisense/useIntellisense";
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

/** Whether this browser can run a WebContainer (see `nodeSupport`); fixed for the page's life. */
function useNodeSupport(): NodeSupport | "checking" {
  return useSyncExternalStore(
    () => () => undefined,
    () =>
      nodeSupport({
        crossOriginIsolated: window.crossOriginIsolated === true,
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
      }),
    () => "checking" as const,
  );
}

/** Props for {@link Playground}. */
interface PlaygroundProps {
  /** `node`: the cross-origin-isolated WebContainer page, which only runs Node projects. */
  route?: "main" | "node";
}

/** Render the playground. */
export function Playground({ route = "main" }: PlaygroundProps) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const onNodeRoute = route === "node";
  // The Node page shows the Next.js project whatever was last picked on the main page.
  const language: LanguageId =
    onNodeRoute && getLanguage(prefs.language).runner !== "node" ? "nextjs" : prefs.language;
  const spec = getLanguage(language);
  const { project, setProject, saveFailed } = useProjects(language);
  const intellisense = useIntellisense(language, project.files, project.open);
  const runState = usePlaygroundRun();
  const nodeRun = useNodeRun();
  const support = useNodeSupport();
  /** What the console and Stop act on: the WebContainer on the Node page. */
  const active = onNodeRoute ? { ...nodeRun, live: nodeRun.phase === "running" } : runState;
  const [pane, setPane] = useState<Pane>("code");
  const [refsOpen, setRefsOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [askDownload, setAskDownload] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [requested, setRequested] = useState<{ url: string; n: number } | null>(null);
  const [requestedDoc, setRequestedDoc] = useState<(DocRequest & { n: number }) | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  /** Preview beside the editor for `.md` files (always on in the Markdown project). */
  const [mdPreview, setMdPreview] = useState(true);
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
  const outputSize = active.output.size;
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
    // "Open docs" in an editor hover: show the page in the panel's Docs tab.
    const onDocs = (event: Event) => {
      const doc = parseDocRequest((event as CustomEvent).detail);
      if (!doc) return;
      setRequestedDoc((current) => ({ ...doc, n: (current?.n ?? 0) + 1 }));
      setRefsOpen(true);
      setPane("refs");
    };
    window.addEventListener(OPEN_REFERENCE_EVENT, onOpen);
    window.addEventListener(OPEN_DOCS_EVENT, onDocs);
    return () => {
      window.removeEventListener(OPEN_REFERENCE_EVENT, onOpen);
      window.removeEventListener(OPEN_DOCS_EVENT, onDocs);
    };
  }, []);

  const stdin = prefs.stdin[language] ?? spec.stdinExample ?? "";

  const startRun = useCallback(() => {
    if (spec.runner === "web") {
      setPreviewKey((k) => k + 1);
    } else if (spec.runner === "node") {
      if (onNodeRoute && support === null) nodeRun.run(project);
    } else {
      runState.run(language, project, stdin);
    }
    setPane("output");
  }, [spec.runner, runState, nodeRun, onNodeRoute, support, language, project, stdin]);

  // Edits reach the running dev server.
  const syncNode = nodeRun.sync;
  useEffect(() => {
    if (onNodeRoute) syncNode(project);
  }, [onNodeRoute, syncNode, project]);

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
    if (onNodeRoute && getLanguage(id).runner !== "node") {
      // Back to the main page (a full load drops this page's isolation headers).
      nodeRun.stop();
      savePrefs({ ...prefs, language: id });
      window.location.assign(PLAYGROUND_PATH);
      return;
    }
    if (!onNodeRoute && getLanguage(id).runner === "node") {
      // Next.js runs on its own cross-origin-isolated page, which needs a full page load.
      updatePrefs({ language: id });
      savePrefs({ ...prefs, language: id });
      // A full page load, not client-side navigation: the isolation headers only apply to a new document.
      window.location.assign(NODE_ROUTE);
      return;
    }
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
    active.stop();
    active.clear();
    setProject(spec.template);
    setResetKey((k) => k + 1);
  };

  const startTour = () => {
    setHelpOpen(false);
    updatePrefs({ welcomed: true, zen: false });
    setTouring(true);
  };

  const endTour = useCallback(() => setTouring(false), []);

  const isMarkdownFile = modeForPath(project.open) === "markdown";
  const showMdPreview = isMarkdownFile && (spec.runner === "markdown" || mdPreview);
  const isRunning = active.phase === "running";
  const code = project.files[project.open] ?? "";
  const indent = modeForPath(project.open) === "gdscript" ? "\t" : "  ";
  const showTree = !prefs.zen && (prefs.treeOpen || pane === "files");
  const showRefs = refsOpen || pane === "refs";
  const welcome =
    prefs.welcomed || active.output.chunks.length > 0 ? null : (
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
      data-md={showMdPreview ? "split" : undefined}
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
          canStop={isRunning || active.live}
          refsOpen={refsOpen}
          notice={saveFailed ? "couldn't save (storage full or disabled)" : notice}
          onLanguage={chooseLanguage}
          onRun={run}
          onStop={active.stop}
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
                onPreview={(path) => {
                  openFile(path);
                  setMdPreview(true);
                }}
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
              {isMarkdownFile && spec.runner !== "markdown" && (
                <button
                  type="button"
                  className="link"
                  aria-pressed={mdPreview}
                  onClick={() => setMdPreview(!mdPreview)}
                  title="Show the Markdown preview beside the editor"
                >
                  <i>preview</i>
                </button>
              )}
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
              onFocusChange={(focused) => (
                setEditorFocused(focused),
                focused && intellisense.arm()
              )}
              loadAssist={intellisense.loadAssist}
            />
            {showMdPreview && <MarkdownPreview source={code} path={project.open} />}
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
            {spec.runner === "bun" && (
              <HttpClient
                key={language}
                port={runState.served}
                presets={spec.httpPresets ?? []}
                send={runState.request}
                resizer={
                  <Splitter
                    part="http"
                    edge="right"
                    size={prefs.layout.http}
                    onSize={setSize("http")}
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
            {spec.runner === "node" &&
              (onNodeRoute ? (
                <NodePanel
                  support={support}
                  url={nodeRun.url}
                  running={isRunning}
                  project={project}
                  resizer={
                    <Splitter
                      part="preview"
                      edge="right"
                      size={prefs.layout.preview}
                      onSize={setSize("preview")}
                    />
                  }
                />
              ) : (
                <section className="pg-preview pg-node" aria-label="Next.js preview">
                  <div className="pg-node-unsupported" role="note">
                    <p>Next.js runs on its own page, which can host a WebContainer.</p>
                    <p>
                      {/* A plain link (a full page load): the isolation headers only apply to a new document. */}
                      <a href={NODE_ROUTE}>
                        <i>open the Next.js playground →</i>
                      </a>
                    </p>
                  </div>
                </section>
              ))}
            <ConsolePane
              spec={spec}
              output={active.output}
              phase={active.phase}
              status={active.status}
              stdin={stdin}
              onStdin={(value) => updatePrefs({ stdin: { ...prefs.stdin, [language]: value } })}
              onClear={active.clear}
              askDownload={askDownload}
              onApproveDownload={approveDownload}
              onCancelDownload={() => setAskDownload(false)}
              welcome={welcome}
            />
          </div>
        </div>

        {showRefs && (
          <ReferencePanel
            language={language}
            suggestions={spec.refs}
            width={prefs.layout.refs}
            onWidth={setSize("refs")}
            onClose={() => (setRefsOpen(false), pane === "refs" && setPane("code"))}
            requested={requested}
            requestedDoc={requestedDoc}
            isolated={onNodeRoute}
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
