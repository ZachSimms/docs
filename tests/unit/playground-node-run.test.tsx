/** Unit tests for `useNodeRun` with a fake WebContainer: install, dev server, Stop, and edits reaching the container. */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";
import { TEMPLATES } from "@/lib/playground/templates";

/** A fake process: its exit resolves when `finish` is called or it's killed. */
function fakeProcess(command: string) {
  let finish: (code: number) => void = () => undefined;
  const exit = new Promise<number>((resolve) => (finish = resolve));
  const process = {
    command,
    killed: false,
    exit,
    output: new ReadableStream<string>({ start: (c) => c.enqueue(`${command} output\n`) }),
    input: new WritableStream<string>(),
    kill() {
      process.killed = true;
      finish(143);
    },
    resize() {},
    finish: (code: number) => finish(code),
  };
  return process;
}

const spawned: ReturnType<typeof fakeProcess>[] = [];
const writes: string[] = [];
let serverReady: ((port: number, url: string) => void) | null = null;
const container = {
  mount: async () => undefined,
  fs: {
    rm: async () => undefined,
    mkdir: async () => undefined,
    writeFile: async (path: string) => void writes.push(path),
  },
  spawn: async (command: string, args: string[]) => {
    const process = fakeProcess(`${command} ${args.join(" ")}`);
    spawned.push(process);
    return process;
  },
  on: (_event: string, listener: (port: number, url: string) => void) => {
    serverReady = listener;
    return () => (serverReady = null);
  },
};
mock.module("@webcontainer/api", () => ({ WebContainer: { boot: async () => container } }));

const { useNodeRun } = await import("@/components/playground/useNodeRun");
const project = TEMPLATES.nextjs;
const commands = () => spawned.map((p) => p.command);

describe("useNodeRun", () => {
  it("installs, starts the dev server, shows the preview, and a stopped install is redone", async () => {
    const { result } = renderHook(() => useNodeRun());
    act(() => result.current.run(project));
    await waitFor(() => expect(commands()).toEqual(["npm install --no-audit --no-fund"]));

    // Stop in the middle of the install: it is killed and doesn't count as installed.
    act(() => result.current.stop());
    expect(spawned[0]!.killed).toBe(true);
    expect(result.current.phase).toBe("stopped");

    act(() => result.current.run(project));
    await waitFor(() => expect(commands()).toHaveLength(2));
    expect(spawned[1]!.command).toBe("npm install --no-audit --no-fund");
    spawned[1]!.finish(0);
    await waitFor(() => expect(commands()).toHaveLength(3));
    expect(spawned[2]!.command).toBe("npm run dev");

    // Only StackBlitz's preview domains are shown.
    act(() => serverReady?.(3000, "https://evil.test/"));
    expect(result.current.url).toBeNull();
    act(() => serverReady?.(3000, "https://abc--3000.local-credentialless.webcontainer-api.io"));
    expect(result.current.url).toBe("https://abc--3000.local-credentialless.webcontainer-api.io");
    expect(result.current.output.chunks.map((c) => c.text).join("")).toContain(
      "npm install --no-audit --no-fund output",
    );

    // Edits reach the running server.
    act(() =>
      result.current.sync({ ...project, files: { ...project.files, "app/page.tsx": "edited" } }),
    );
    await waitFor(() => expect(writes).toContain("app/page.tsx"));

    // Running again with the same dependencies skips the install.
    act(() => result.current.run(project));
    expect(spawned[2]!.killed).toBe(true);
    await waitFor(() => expect(commands()).toHaveLength(4));
    expect(spawned[3]!.command).toBe("npm run dev");
  });

  it("reports a failed install", async () => {
    spawned.length = 0;
    const { result } = renderHook(() => useNodeRun());
    const changed = {
      ...project,
      files: { ...project.files, "package.json": JSON.stringify({ dependencies: { zod: "4" } }) },
    };
    act(() => result.current.run(changed));
    await waitFor(() => expect(spawned).toHaveLength(1));
    spawned[0]!.finish(1);
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.output.chunks.map((c) => c.text).join("")).toContain(
      "npm install exited with 1",
    );
  });
});
