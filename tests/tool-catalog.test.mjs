import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("registers fourteen tools in the shared index, command center, and launcher", () => {
  assert.equal([...page.matchAll(/\{ id: "[^"]+" as const,/g)].length, 14);
  assert.match(page, /id: "fieldday" as const/);
  assert.match(page, /id: "repairs" as const/);
  assert.match(page, /CommandCenter[\s\S]*TOOLS\.map/);
  assert.match(page, /FloatingToolStrip[\s\S]*TOOLS\.map/);
  assert.match(page, /MyToolPage v0\.5\.0 · 14 tools/);
});

test("keeps keyboard, device persistence, and mobile overflow safeguards", () => {
  assert.match(page, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(page, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(page, /mtp-field-day/);
  assert.match(page, /mtp-repair-scope/);
  assert.match(css, /@media \(max-width: 740px\)/);
  assert.match(css, /\.schedule-table-wrap \{[^}]*overflow-x: auto/s);
  assert.match(css, /\.repair-table-wrap \{[^}]*overflow-x: auto/s);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
