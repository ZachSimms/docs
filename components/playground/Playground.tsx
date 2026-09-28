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
 * Two modes (`Prefs.mode`, or `?mode=exercise` in the URL): projects of files, and exercises
 * (`components/exercises/`), where the file tree's place holds the exercise panel (request
 * form, brief, hints), the editor holds the solution file, the output pane shows the hidden
 * tests' results and the review, and Run runs the tests. Both share the runner and the
 * reference panel.
 *
 * Security: this component never evaluates user code. Running goes through
 * `usePlaygroundRun` (sandboxed frames and remote services).
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ExercisePanel } from "@/components/exercises/ExercisePanel";
import { ExerciseResults } from "@/components/exercises/ExerciseResults";
import { useExerciseSession } from "@/components/exercises/useExerciseSession";
import { solutionFile } from "@/lib/exercises/options";
import { isTypingTarget } from "@/lib/keys";
import { getLanguage, modeForPath, type LanguageId } from "@/lib/playground/languages";
import { projectArchiveName } from "@/lib/playground/download";
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
import {
  EXERCISE_TOUR_STEPS,
  isHelpShortcut,
  isZenShortcut,
  TOUR_STEPS,
  type TourStep,
} from "@/lib/playground/shortcuts";
import { loadPrefs, savePrefs, type PlaygroundMode, type Prefs } from "@/lib/playground/storage";
import {
  isSheetUrl,
  OPEN_DOCS_EVENT,
  OPEN_REFERENCE_EVENT,
  parseDocRequest,
  type DocRequest,
} from "@/lib/reference-panel";
import { CodeEditor, type EditorHandle } from "./CodeEditor";
import { ConsolePane } from "./ConsolePane";
import { FileTree, type TreeCommand } from "./FileTree";
import { HelpPanel } from "./HelpPanel";
import { HttpClient } from "./HttpClient";
import { MarkdownPreview } from "./MarkdownPreview";
import { PlaygroundToolbar } from "./PlaygroundToolbar";
import { ReferencePanel } from "./ReferencePanel";
import { Splitter } from "./Splitter";
import { SymbolRow } from "./SymbolRow";
import { Tour } from "./Tour";
import { usePlaygroundRun } from "./usePlaygroundRun";
import { SAVE_DEBOUNCE_MS, useProjects } from "./useProjects";
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

/** The mode a `?mode=` query asks for, if any (links from elsewhere open exercises this way). */
function modeFromUrl(): PlaygroundMode | null {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "exercise" || mode === "code" ? mode : null;
}

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
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const loaded = loadPrefs();
    const asked = modeFromUrl();
    return asked ? { ...loaded, mode: asked } : loaded;
  });
  const language = prefs.language;
  const spec = getLanguage(language);
  const { project, setProject, saveFailed } = useProjects(language);
  const runState = usePlaygroundRun();
  const exerciseMode = prefs.mode === "exercise";
  const session = useExerciseSession(runState, {
    approved: (id) => prefs.approvedDownloads.includes(id),
    approve: (id) =>
      setPrefs((current) =>
        current.approvedDownloads.includes(id)
          ? current
          : { ...current, approvedDownloads: [...current.approvedDownloads, id] },
      ),
  });
  const exercise = exerciseMode ? session.exercise : null;
  const exerciseFile = exercise ? solutionFile(exercise.language) : "";
  const exerciseFiles = useMemo(
    () => (exerciseFile ? { [exerciseFile]: session.code } : {}),
    [exerciseFile, session.code],
  );
  // Intellisense follows whatever the editor shows: the project, or the exercise's solution file.
  const intellisense = useIntellisense(
    exercise ? exercise.language : language,
    exercise ? exerciseFiles : project.files,
    exercise ? exerciseFile : project.open,
  );
  const [pane, setPane] = useState<Pane>("code");
  const [refsOpen, setRefsOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [askDownload, setAskDownload] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [requested, setRequested] = useState<{ url: string; n: number } | null>(null);
  const [requestedDoc, setRequestedDoc] = useState<(DocRequest & { n: number }) | null>(null);
  /** Counts docs requests, so a repeat request (after the last was shown and cleared) is new. */
  const docRequests = useRef(0);
  const [helpOpen, setHelpOpen] = useState(false);
  /** The tour being shown: the playground's, or the exercise mode's. */
  const [touring, setTouring] = useState<PlaygroundMode | null>(null);
  /** The exercise mode's "How it works" card, reopened after it was dismissed. */
  const [introOpen, setIntroOpen] = useState(false);
  /** Preview beside the editor for `.md` files (always on in the Markdown project). */
  const [mdPreview, setMdPreview] = useState(true);
  const editor = useRef<EditorHandle | null>(null);
  const coarse = useCoarsePointer();

  const updatePrefs = useCallback((change: Partial<Prefs>) => {
    setPrefs((current) => ({ ...current, ...change }));
  }, []);

  // Persist preferences (outside the state updater, which must stay pure), debounced: a splitter
  // drag changes them on every pointer move. Saved at once when the page goes away or unmounts.
  const latestPrefs = useRef(prefs);
  const prefsDirty = useRef(false);
  useEffect(() => {
    if (latestPrefs.current === prefs) return; // the first render: nothing changed yet
    latestPrefs.current = prefs;
    prefsDirty.current = true;
    const handle = setTimeout(() => {
      prefsDirty.current = false;
      savePrefs(prefs);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [prefs]);
  useEffect(() => {
    const flush = () => {
      if (!prefsDirty.current) return;
      prefsDirty.current = false;
      savePrefs(latestPrefs.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);

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
    // "Open docs" in an editor hover: show the page in the panel's Docs tab.
    const onDocs = (event: Event) => {
      const doc = parseDocRequest((event as CustomEvent).detail);
      if (!doc) return;
      docRequests.current += 1;
      setRequestedDoc({ ...doc, n: docRequests.current });
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

  /** Switch between projects and exercises; the URL follows, so the mode can be linked. */
  const chooseMode = (mode: PlaygroundMode) => {
    runState.stop();
    runState.clear();
    setAskDownload(false);
    updatePrefs({ mode });
    const url = mode === "exercise" ? "?mode=exercise" : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
  };

  /** Exercise mode's Run: the hidden tests against the solution file. */
  const runTests = useCallback(() => {
    if (!exercise || session.working) return;
    session.runTests();
    setPane("output");
  }, [exercise, session]);

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
    setIntroOpen(false);
    if (exerciseMode) {
      // The exercise tour points into the exercise panel: make sure it is showing.
      updatePrefs({ exerciseWelcomed: true, zen: false, treeOpen: true });
      setTouring("exercise");
    } else {
      updatePrefs({ welcomed: true, zen: false });
      setTouring("code");
    }
  };

  const endTour = useCallback(() => setTouring(null), []);

  const isMarkdownFile = modeForPath(project.open) === "markdown";
  const showMdPreview = isMarkdownFile && (spec.runner === "markdown" || mdPreview);
  const isRunning = runState.phase === "running";
  const code = project.files[project.open] ?? "";
  const indent = modeForPath(project.open) === "gdscript" ? "\t" : "  ";
  const showTree = !prefs.zen && (prefs.treeOpen || pane === "files");
  const showRefs = refsOpen || pane === "refs";
  // Once opened, the panel stays mounted (hidden when not shown) so its sheet, search and docs survive.
  const [refsMounted, setRefsMounted] = useState(false);
  if (showRefs && !refsMounted) setRefsMounted(true);
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
      data-mode={prefs.mode}
      data-runner={exerciseMode ? "exercise" : spec.runner}
      data-refs={showRefs ? "open" : "closed"}
      data-tree={prefs.treeOpen ? "open" : "closed"}
      data-zen={prefs.zen ? "on" : "off"}
      data-md={showMdPreview ? "split" : undefined}
      style={layoutStyle(prefs.layout) as CSSProperties}
    >
      {prefs.zen ? (
        <div className="pg-zenbar" role="toolbar" aria-label="Zen mode">
          <button
            type="button"
            className="link"
            onClick={exerciseMode ? runTests : run}
            disabled={isRunning || (exerciseMode && !exercise)}
          >
            <i>{exerciseMode ? "▶ Run tests" : "▶ Run"}</i>
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
          mode={prefs.mode}
          onMode={chooseMode}
          canRunTests={exercise !== null && !session.working}
          onSubmit={() => {
            if (!exercise || session.working) return;
            session.submit();
            setPane("output");
          }}
          spec={spec}
          running={isRunning}
          canStop={isRunning || runState.live}
          refsOpen={refsOpen}
          notice={saveFailed ? "couldn't save (storage full or disabled)" : notice}
          onLanguage={chooseLanguage}
          onRun={exerciseMode ? runTests : run}
          onStop={runState.stop}
          onReset={exerciseMode ? session.resetCode : reset}
          onZen={toggleZen}
          onHelp={() => setHelpOpen(true)}
          onRefs={() => setRefsOpen((open) => !open)}
        />
      )}

      <div className="pg-main">
        <nav
          className="pg-files"
          aria-label={exerciseMode ? "Exercise" : "Files"}
          data-tour="files"
        >
          {showTree && exerciseMode ? (
            <>
              <ExercisePanel
                session={session}
                intro={!prefs.exerciseWelcomed || introOpen}
                onIntro={(show) => {
                  setIntroOpen(show);
                  if (!show) updatePrefs({ exerciseWelcomed: true });
                }}
                onTour={startTour}
                onHide={() =>
                  pane === "files" ? setPane("code") : updatePrefs({ treeOpen: false })
                }
              />
              <Splitter
                part="brief"
                edge="right"
                size={prefs.layout.brief}
                onSize={setSize("brief")}
              />
            </>
          ) : showTree ? (
            <>
              <FileTree
                key={language}
                project={project}
                archiveName={projectArchiveName(language)}
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
                aria-label={exerciseMode ? "Show the exercise" : "Show files"}
                title={exerciseMode ? "Show the exercise" : "Show files"}
                onClick={() => updatePrefs({ treeOpen: true })}
              >
                <i>»</i>
              </button>
            )
          )}
        </nav>

        <div className="pg-work">
          <div className="pg-tabs" role="group" aria-label="Open files">
            {exerciseMode && exercise && (
              <span className="pg-tab" data-active="">
                <button type="button" aria-current="true" title={exerciseFile}>
                  {exerciseFile}
                </button>
              </span>
            )}
            {!exerciseMode &&
              project.tabs.map((tab) => (
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
              {!exerciseMode && isMarkdownFile && spec.runner !== "markdown" && (
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
            aria-label={`Editing ${exerciseMode ? exerciseFile || "nothing yet" : project.open}`}
            data-tour="editor"
          >
            {exerciseMode ? (
              exercise ? (
                <CodeEditor
                  key={`exercise:${exercise.id}`}
                  path={exerciseFile}
                  paths={[exerciseFile]}
                  value={session.code}
                  onChange={(_, value) => session.setCode(value)}
                  onRun={runTests}
                  wrap={prefs.wrap}
                  handleRef={editor}
                  onFocusChange={(focused) => (
                    setEditorFocused(focused),
                    focused && intellisense.arm()
                  )}
                  loadAssist={intellisense.loadAssist}
                />
              ) : (
                <p className="pg-empty">
                  {session.busy ??
                    "Generate an exercise in the panel on the left; your code goes here."}
                </p>
              )
            ) : (
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
            )}
            {!exerciseMode && showMdPreview && (
              <MarkdownPreview source={code} path={project.open} />
            )}
          </div>
          <div className="pg-out" data-tour="output">
            <Splitter
              part="output"
              edge="top"
              size={prefs.layout.output}
              onSize={setSize("output")}
            />
            {exerciseMode && <ExerciseResults session={session} />}
            {!exerciseMode && spec.runner === "web" && (
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
            {!exerciseMode && spec.runner === "bun" && (
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
            {!exerciseMode && spec.runner === "godot" && (
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
            {!exerciseMode && (
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
            )}
          </div>
        </div>

        {refsMounted && (
          <ReferencePanel
            hidden={!showRefs}
            language={language}
            suggestions={spec.refs}
            width={prefs.layout.refs}
            onWidth={setSize("refs")}
            onClose={() => (setRefsOpen(false), pane === "refs" && setPane("code"))}
            requested={requested}
            requestedDoc={requestedDoc}
            onDocShown={() => setRequestedDoc(null)}
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
            {exerciseMode && p.id === "files"
              ? "Task"
              : exerciseMode && p.id === "output"
                ? "Tests"
                : p.label}
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
        <HelpPanel
          open
          spec={spec}
          mode={prefs.mode}
          onClose={() => setHelpOpen(false)}
          onTour={startTour}
        />
      )}
      {touring && (
        <Tour
          key={touring}
          steps={touring === "exercise" ? EXERCISE_TOUR_STEPS : TOUR_STEPS}
          onPane={setPane}
          onDone={endTour}
        />
      )}
      <div className="pg-frames">{runState.frames}</div>
    </div>
  );
}
