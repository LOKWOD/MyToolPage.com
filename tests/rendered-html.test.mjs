import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("publishes canonical discovery metadata, sitemap, and robots rules", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("discovery-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const context = { waitUntil() {}, passThroughOnException() {} };
  const home = await worker.fetch(new Request("http://localhost/"), env, context);
  const html = await home.text();
  assert.match(html, /rel="canonical" href="https:\/\/mytoolpage\.com\/"/);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /Field day planner/);
  assert.match(html, /Paired sales support/);
  assert.match(html, /Break-even billing rate/);

  const sitemap = await worker.fetch(new Request("http://localhost/sitemap.xml"), env, context);
  assert.equal(sitemap.status, 200);
  assert.match(await sitemap.text(), /https:\/\/mytoolpage\.com\//);

  const robots = await worker.fetch(new Request("http://localhost/robots.txt"), env, context);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/mytoolpage\.com\/sitemap\.xml/);
});
