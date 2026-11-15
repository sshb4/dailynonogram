"use client";
import { useEffect, useRef, useState } from "react";
import { dailyPuzzle, formatDate, formatTime, localDate, type Puzzle } from "@/lib/puzzles";
import { applyMove, newGame, solvedGame, validResult, type Cell, type Game as GameState } from "@/lib/game";
import PicrossGrid from "./PicrossGrid";
import Leaderboard from "./Leaderboard";
import ShareButton from "./ShareButton";

export default function Game() {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setDate(localDate());
    update();
    const interval = setInterval(update, 1000);
    window.addEventListener("focus", update);
    return () => { clearInterval(interval); window.removeEventListener("focus", update); };
  }, []);
  return <main className="site-shell">
    <header className="site-header"><a className="wordmark" href="./">Pitcross<span className="working-title">Working title</span></a><span className="header-note">One picture. Every day.</span></header>
    {date ? <DailyGame key={date} date={date} puzzle={dailyPuzzle(date).puzzle} /> : <div className="loading" role="status">Loading today’s puzzle…</div>}
    <footer className="site-footer"><span>A little logic, every day.</span><span>No account needed.</span></footer>
  </main>;
}
function DailyGame({ date, puzzle }: { date: string; puzzle: Puzzle }) {
  const [game, setGame] = useState<GameState>(() => newGame(puzzle));
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"fill" | "x">("fill");
  const [elapsed, setElapsed] = useState(0);
  const [storageNote, setStorageNote] = useState("");
  const [returning, setReturning] = useState(false);
  const persistedResult = useRef<GameState["result"]>(null);
  const storageKey = `pitcross:${date}`;
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (stored?.puzzle === JSON.stringify(puzzle) && validResult(stored.result)) {
        setGame(solvedGame(puzzle, stored.result));
        persistedResult.current = stored.result;
        setReturning(true);
      }
    } catch { setStorageNote("Daily results can’t be saved in this browser."); }
    setReady(true);
  }, [puzzle, storageKey]);
  useEffect(() => {
    if (!ready || !game.result || persistedResult.current === game.result) return;
    persistedResult.current = game.result;
    try { localStorage.setItem(storageKey, JSON.stringify({ puzzle: JSON.stringify(puzzle), result: game.result })); }
    catch { setStorageNote("Your result could not be saved on this device. You can still share it."); }
  }, [game.result, puzzle, ready, storageKey]);
  useEffect(() => {
    if (game.startedAt === null || game.result) return;
    const tick = () => setElapsed(Math.max(0, Date.now() - game.startedAt!));
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [game.startedAt, game.result]);
  function move(index: number, value: Cell, tool: 1 | 2) {
    if (!ready) return;
    const now = Date.now();
    setGame(previous => applyMove(previous, puzzle, index, value, now, tool));
  }
  function reset() {
    setGame(newGame(puzzle)); setElapsed(0); setReturning(false);
  }
  return <>
    <section className="game-section" aria-labelledby="game-title">
      <div className="intro"><p className="eyebrow">Daily nonogram <span aria-hidden="true">/</span> {formatDate(date, true)}</p><h1 id="game-title">A picture is hiding here.</h1><p>Follow the numbers. Fill the squares. See what appears.</p></div>
      <div className="game-card">
        <div className="game-bar"><div className="puzzle-label"><span className="eyebrow">Today’s puzzle</span><span>{puzzle.width} × {puzzle.height}</span></div><div className="stats"><div><span className="stat-label">Time</span><span className="stat-value">{formatTime(game.result?.timeMs ?? elapsed)}</span></div><div><span className="stat-label">Mistakes</span><span className="stat-value">{game.mistakes}</span></div></div></div>
        <div className="board-area">{ready ? <PicrossGrid puzzle={puzzle} cells={game.cells} solved={!!game.result} mode={mode} onMove={move} /> : <p role="status">Loading your daily progress…</p>}</div>
        {game.result ? <div className="win-panel" role="status"><p className="eyebrow">{returning ? "Today’s puzzle completed" : "Picture complete"}</p><h2>{puzzle.name}</h2><p>Solved in <strong>{formatTime(game.result.timeMs)}</strong> with {game.result.mistakes} {game.result.mistakes === 1 ? "mistake" : "mistakes"}.</p><div className="win-actions"><ShareButton date={date} result={game.result} /><button className="text-button" onClick={reset}>Replay puzzle</button></div></div> : <div className="game-controls"><div className="mode-toggle" role="group" aria-label="Drawing mode"><button aria-pressed={mode === "fill"} onClick={() => setMode("fill")}><span className="fill-icon" aria-hidden="true" />Fill</button><button aria-pressed={mode === "x"} onClick={() => setMode("x")}><span className="x-icon" aria-hidden="true">×</span>X mark</button></div><button className="text-button" onClick={reset} disabled={!ready}>Reset</button></div>}
        {storageNote && <p className="storage-note" role="status">{storageNote}</p>}
      </div>
      <details className="instructions"><summary>How to play</summary><div><p>Each number is a run of filled squares in that row or column. Leave at least one empty square between runs. A zero means the whole line is empty.</p><p>Click or drag to fill. Click a filled square to clear it. Right-click, or choose X mark, to mark an empty square. Fill swipes skip X marks, and X swipes skip filled squares. Erasing also affects only the selected mark type. Remove an X before filling that square. On smaller screens, scroll sideways to see the whole grid.</p><p>Your timer starts with your first move. Filling an incorrect square adds a mistake. The picture reveals itself when every filled square is correct. Use arrow keys to move between squares and Space or Enter to draw.</p></div></details>
    </section>
    <Leaderboard date={date} result={game.result} />
  </>;
}
