"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatTime } from "@/lib/puzzles";
import type { Result } from "@/lib/game";
const API = (process.env.NEXT_PUBLIC_SCORES_API_URL || "").replace(/\/$/, "");
type Score = { id: number; name: string; timeMs: number; mistakes: number };
export default function Leaderboard({ date, result }: { date: string; result: Result | null }) {
  const [scores, setScores] = useState<Score[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(API ? "loading" : "unavailable");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const mounted = useRef(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!API) return;
    try {
      const response = await fetch(`${API}/scores?date=${encodeURIComponent(date)}`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Unavailable");
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(row => row && typeof row.name === "string" && Number.isSafeInteger(row.timeMs) && row.timeMs > 0 && Number.isSafeInteger(row.mistakes) && row.mistakes >= 0)) throw new Error("Invalid response");
      if (mounted.current && !signal?.aborted) { setScores(data.slice(0, 10)); setState("ready"); }
    } catch { if (mounted.current && !signal?.aborted) setState("unavailable"); }
  }, [date]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { mounted.current = false; controller.abort(); };
  }, [load]);
  useEffect(() => { setSaved(false); setMessage(""); }, [result]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!result || !API || saving || saved) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`${API}/scores`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, name: name.trim(), ...result }), signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Save failed");
      if (!mounted.current) return;
      setSaved(true); setMessage("Your time is saved.");
      await load();
    } catch { if (mounted.current) setMessage("Could not save right now. Please try again."); }
    finally { if (mounted.current) setSaving(false); }
  }
  return <section className="leaderboard" aria-labelledby="leaderboard-title">
    <div className="section-heading"><h2 id="leaderboard-title">Daily leaderboard</h2><span className="eyebrow">Top 10</span></div>
    {result && <form onSubmit={save} className="score-form"><label htmlFor="player-name">Your name</label><div className="form-row"><input id="player-name" value={name} onChange={e => setName(e.target.value)} required minLength={1} maxLength={20} placeholder="1–20 characters" autoComplete="nickname" disabled={saving || saved || !API} /><button className="button" disabled={!API || saving || saved || !name.trim()}>{saving ? "Saving…" : saved ? "Saved" : "Save to leaderboard"}</button></div><p role="status">{message}</p></form>}
    {state === "loading" && <p className="muted" role="status">Loading today’s times…</p>}
    {state === "unavailable" && <p className="unavailable" role="status"><span className="status-dot" aria-hidden="true" />Leaderboard unavailable right now.{API && <button className="text-button" onClick={() => { setState("loading"); void load(); }}>Retry</button>}</p>}
    {state === "ready" && (scores.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Rank</th><th scope="col">Name</th><th scope="col">Time</th><th scope="col">Mistakes</th></tr></thead><tbody>{scores.map((score, i) => <tr key={score.id}><td>{i + 1}</td><td>{score.name}</td><td>{formatTime(score.timeMs)}</td><td>{score.mistakes}</td></tr>)}</tbody></table></div> : <p className="muted">No times yet. Be the first to finish today’s puzzle.</p>)}
  </section>;
}
