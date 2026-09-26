/** Unit tests for `lib/playground/zip.ts` and `lib/playground/download.ts`: downloads from the file menu. */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileDownload, projectArchiveName, zipDownload } from "@/lib/playground/download";
import { TEMPLATES } from "@/lib/playground/templates";
import { crc32, createZip, dosDateTime } from "@/lib/playground/zip";

/** Read a stored ZIP back through its central directory: name → text (folders map to ""). */
function readZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const out = new Map<string, string>();
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    expect(view.getUint16(at + 8, true) & 0x0800).toBe(0x0800); // UTF-8 names
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const localName = view.getUint16(local + 26, true);
    const data = bytes.subarray(local + 30 + localName, local + 30 + localName + size);
    expect(crc32(data)).toBe(view.getUint32(at + 16, true));
    out.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return out;
}

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("encodes DOS times", () => {
    expect(dosDateTime(new Date(2026, 8, 26, 13, 45, 31))).toEqual({
      time: (13 << 11) | (45 << 5) | 15,
      date: (46 << 9) | (9 << 5) | 26,
    });
  });

  it("round-trips files, folders and UTF-8 names", () => {
    const zip = createZip([
      { path: "notes/" },
      { path: "notes/café.md", data: "# Café ☕" },
      { path: "a.txt", data: "" },
    ]);
    expect([...readZip(zip)]).toEqual([
      ["notes/", ""],
      ["notes/café.md", "# Café ☕"],
      ["a.txt", ""],
    ]);
  });

  it("is a valid archive for the system unzip tool, when there is one", () => {
    if (spawnSync("unzip", ["-v"]).status !== 0) return;
    const dir = mkdtempSync(path.join(tmpdir(), "pg-zip-"));
    const file = path.join(dir, "t.zip");
    writeFileSync(file, zipDownload(TEMPLATES.python, null, "python-playground").data);
    const result = spawnSync("unzip", ["-t", file], { encoding: "utf8" });
    expect(result.stdout).toContain("No errors detected");
  });
});

describe("downloads", () => {
  const project = TEMPLATES.python;

  it("saves a file under its own name, with its contents", () => {
    const download = fileDownload(project, "shapes/circle.py")!;
    expect(download.name).toBe("circle.py");
    expect(new TextDecoder().decode(download.data)).toBe(project.files["shapes/circle.py"]);
    expect(fileDownload(project, "missing.py")).toBeNull();
  });

  it("zips a folder with the folder at the top", () => {
    const download = zipDownload(project, "shapes", "x");
    expect(download.name).toBe("shapes.zip");
    const entries = readZip(download.data);
    expect([...entries.keys()].sort()).toEqual([
      "shapes/",
      "shapes/__init__.py",
      "shapes/circle.py",
    ]);
    expect(entries.get("shapes/circle.py")).toBe(project.files["shapes/circle.py"]);
  });

  it("zips the whole project under its name, keeping empty folders", () => {
    const withEmpty = { ...project, dirs: [...project.dirs, "empty"] };
    const download = zipDownload(withEmpty, null, projectArchiveName("python"));
    expect(download.name).toBe("python-playground.zip");
    const names = [...readZip(download.data).keys()];
    expect(names).toContain("python-playground/empty/");
    expect(names).toContain("python-playground/main.py");
    expect(names).toContain("python-playground/data/values.txt");
    expect(names.every((n) => n.startsWith("python-playground/") && !n.includes(".."))).toBe(true);
  });
});
