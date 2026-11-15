import type { D1Database } from "@cloudflare/workers-types";
export interface Env { DB: D1Database; ALLOWED_ORIGIN?: string }
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || "*";
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    };
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
    if (origin !== "*" && request.headers.has("Origin") && request.headers.get("Origin") !== origin) return json({ error: "Origin not allowed" }, 403);
    const url = new URL(request.url);
    if (url.pathname !== "/scores") return json({ error: "Not found" }, 404);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      if (request.method === "GET") {
        const date = url.searchParams.get("date");
        if (!validDate(date)) return json({ error: "A valid date (YYYY-MM-DD) is required" }, 400);
        const result = await env.DB.prepare("SELECT id, name, time_ms AS timeMs, mistakes FROM scores WHERE date = ? ORDER BY time_ms ASC, mistakes ASC, id ASC LIMIT 10").bind(date).all();
        return json(result.results);
      }
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return json({ error: "Content-Type must be application/json" }, 415);
      // Stream with a bound so malformed requests cannot allocate an unbounded body.
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "JSON body required" }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return json({ error: "Request too large" }, 413); }
        chunks.push(value);
      }
      let body: unknown;
      try {
        const combined = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
        body = JSON.parse(new TextDecoder().decode(combined));
      } catch { return json({ error: "Invalid JSON" }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid score" }, 400);
      const payload = body as Record<string, unknown>;
      const { date, name, timeMs, mistakes } = payload;
      if (Object.keys(payload).some(key => !["date", "name", "timeMs", "mistakes"].includes(key)) ||
        !validDate(date) || typeof name !== "string" || name.length > 20 || name.trim().length < 1 ||
        !Number.isSafeInteger(timeMs) || (timeMs as number) <= 0 ||
        !Number.isSafeInteger(mistakes) || (mistakes as number) < 0) {
        return json({ error: "Expected a valid date, name (1–20 characters), positive integer timeMs, and non-negative integer mistakes" }, 400);
      }
      const result = await env.DB.prepare("INSERT INTO scores (date, name, time_ms, mistakes, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(date, name.trim(), timeMs, mistakes, new Date().toISOString()).run();
      return json({ id: result.meta.last_row_id }, 201);
    } catch { return json({ error: "Leaderboard unavailable right now" }, 503); }
  },
};
