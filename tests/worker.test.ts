import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "../worker/index";
const calls: { sql: string; values: unknown[] }[] = [];
const env = { DB: { prepare(sql: string) { return { bind(...values: unknown[]) { calls.push({ sql, values }); return { async all() { return { results: [{ id: 1, name: "Sasha", timeMs: 154000, mistakes: 1 }] }; }, async run() { return { meta: { last_row_id: 1 } }; } }; } }; } } } as unknown as Env;
const valid = { date: "2026-11-15", name: "Sasha", timeMs: 154000, mistakes: 1 };
function post(body: unknown) { return new Request("https://example.com/scores", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: JSON.stringify(body) }); }
test("worker validates score fields and exact calendar dates", async () => {
  for (const body of [null, [], {}, { ...valid, name: " " }, { ...valid, name: "a".repeat(21) }, { ...valid, timeMs: 0 }, { ...valid, timeMs: 1.5 }, { ...valid, timeMs: "100" }, { ...valid, mistakes: -1 }, { ...valid, mistakes: 0.5 }, { ...valid, date: "2026-02-30" }, { ...valid, extra: true }]) {
    assert.equal((await worker.fetch(post(body), env)).status, 400, JSON.stringify(body));
  }
  const response = await worker.fetch(post(valid), env);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.deepEqual(calls.at(-1)?.values.slice(0, 4), [valid.date, valid.name, valid.timeMs, valid.mistakes]);
});
test("worker returns top ten with deterministic time/mistake order", async () => {
  const response = await worker.fetch(new Request("https://example.com/scores?date=2026-11-15"), env);
  assert.equal(response.status, 200);
  assert.match(calls.at(-1)!.sql, /ORDER BY time_ms ASC, mistakes ASC, id ASC LIMIT 10/);
  assert.equal((await response.json() as { name: string }[])[0].name, "Sasha");
  assert.equal((await worker.fetch(new Request("https://example.com/scores?date=bad"), env)).status, 400);
});
test("worker handles CORS, unknown routes, malformed/oversize requests, and database outage", async () => {
  assert.equal((await worker.fetch(new Request("https://example.com/scores", { method: "OPTIONS" }), env)).status, 204);
  assert.equal((await worker.fetch(new Request("https://example.com/"), env)).status, 404);
  assert.equal((await worker.fetch(new Request("https://example.com/scores", { method: "DELETE" }), env)).status, 405);
  assert.equal((await worker.fetch(post(valid), { ...env, ALLOWED_ORIGIN: "https://different.example" })).status, 403);
  assert.equal((await worker.fetch(new Request("https://example.com/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }), env)).status, 400);
  assert.equal((await worker.fetch(post({ ...valid, name: "x".repeat(3000) }), env)).status, 413);
  assert.equal((await worker.fetch(new Request("https://example.com/scores?date=2026-11-15"), { DB: { prepare() { throw new Error("offline"); } } } as unknown as Env)).status, 503);
});
