/** Unit tests for `lib/playground/runtime/web-preview.ts`: the live preview document. */
import { describe, expect, it } from "bun:test";
import { buildPreviewSrcDoc } from "@/lib/playground/runtime/web-preview";

describe("buildPreviewSrcDoc", () => {
  it("adds a doctype and the shim before a bare fragment", () => {
    const doc = buildPreviewSrcDoc("<p>hi</p>", "tok-1");
    expect(doc.startsWith("<!doctype html><script>")).toBe(true);
    expect(doc).toContain('"tok-1"');
    expect(doc.endsWith("<p>hi</p>")).toBe(true);
  });

  it("keeps the page's doctype first and puts the shim in its head", () => {
    const withHead = buildPreviewSrcDoc(
      "<!doctype html><html><head><title>x</title></head><body></body></html>",
      "t",
    );
    expect(withHead.indexOf("<head>")).toBeLessThan(withHead.indexOf("<script>"));
    expect(withHead.indexOf("<script>")).toBeLessThan(withHead.indexOf("<title>"));
    const doctypeOnly = buildPreviewSrcDoc("<!DOCTYPE html>\n<p>x</p>", "t");
    expect(doctypeOnly.startsWith("<!DOCTYPE html><script>")).toBe(true);
  });

  it("can't be broken out of by a token containing a closing script tag", () => {
    const doc = buildPreviewSrcDoc("<p>x</p>", "</script><script>alert(1)");
    expect(doc.match(/<\/script>/g)).toHaveLength(1);
  });
});
