import type { Puzzle } from "./puzzles";
export type Cell = 0 | 1 | 2; // empty, filled, X
export type Result = { timeMs: number; mistakes: number };
export type Game = { cells: Cell[]; mistakes: number; startedAt: number | null; result: Result | null };
export function newGame(puzzle: Puzzle): Game {
  return { cells: Array<Cell>(puzzle.width * puzzle.height).fill(0), mistakes: 0, startedAt: null, result: null };
}
export function solvedGame(puzzle: Puzzle, result: Result): Game {
  return { cells: puzzle.cells.flat().map(cell => cell === null ? 0 : 1), mistakes: result.mistakes, startedAt: null, result };
}
export function applyMove(game: Game, puzzle: Puzzle, index: number, value: Cell, now: number, tool?: 1 | 2): Game {
  if (game.result || index < 0 || index >= game.cells.length || game.cells[index] === value) return game;
  const previous = game.cells[index];
  // A stroke can draw or erase its own mark, but must skip the other kind.
  if (previous !== 0 && ((value !== 0 && previous !== value) || (tool !== undefined && previous !== tool))) return game;
  const cells = [...game.cells];
  cells[index] = value;
  const solution = puzzle.cells.flat();
  const mistakes = game.mistakes + (value === 1 && solution[index] === null ? 1 : 0);
  const startedAt = game.startedAt ?? now;
  const solved = cells.every((cell, i) => (cell === 1) === (solution[i] !== null));
  return { cells, mistakes, startedAt, result: solved ? { timeMs: Math.max(1, now - startedAt), mistakes } : null };
}
export function validResult(value: unknown): value is Result {
  if (!value || typeof value !== "object") return false;
  const result = value as Result;
  return Number.isSafeInteger(result.timeMs) && result.timeMs > 0 && Number.isSafeInteger(result.mistakes) && result.mistakes >= 0;
}
