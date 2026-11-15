import data from "../data/puzzles.json";

export type Puzzle = { name: string; width: number; height: number; cells: (string | null)[][] };
export const LAUNCH_DATE = "2026-11-15";
export const BOARD_SIZE = 15;
const sourcePuzzles: Puzzle[] = data;

for (const puzzle of sourcePuzzles) {
  if (!Number.isInteger(puzzle.width) || !Number.isInteger(puzzle.height) || puzzle.width < 1 || puzzle.height < 1 ||
    puzzle.width > BOARD_SIZE || puzzle.height > BOARD_SIZE ||
    puzzle.cells.length !== puzzle.height || puzzle.cells.some(row => row.length !== puzzle.width ||
      row.some(cell => cell !== null && !/^#[0-9a-f]{6}$/i.test(cell)))) {
    throw new Error(`Invalid puzzle data: ${puzzle.name}`);
  }
}
if (!sourcePuzzles.length) throw new Error("At least one puzzle is required.");

// Artwork dimensions describe the picture, not the playable board.
// Center smaller pictures without stretching them; all other cells stay empty.
export const puzzles: Puzzle[] = sourcePuzzles.map(puzzle => {
  const left = Math.floor((BOARD_SIZE - puzzle.width) / 2);
  const top = Math.floor((BOARD_SIZE - puzzle.height) / 2);
  return {
    name: puzzle.name,
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    cells: Array.from({ length: BOARD_SIZE }, (_, row) =>
      Array.from({ length: BOARD_SIZE }, (_, column) =>
        puzzle.cells[row - top]?.[column - left] ?? null)),
  };
});

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function ordinal(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}
export function dailyPuzzle(date: string): { puzzle: Puzzle; dayIndex: number } {
  const dayIndex = ordinal(date) - ordinal(LAUNCH_DATE);
  return { puzzle: puzzles[((dayIndex % puzzles.length) + puzzles.length) % puzzles.length], dayIndex };
}
export function runs(line: (string | null)[]): number[] {
  const clues: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (cell !== null) run++;
    else if (run) { clues.push(run); run = 0; }
  }
  if (run) clues.push(run);
  return clues.length ? clues : [0];
}
export function clues(puzzle: Puzzle) {
  return {
    rows: puzzle.cells.map(runs),
    columns: Array.from({ length: puzzle.width }, (_, column) => runs(puzzle.cells.map(row => row[column]))),
  };
}
export function formatTime(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function formatDate(date: string, long = false): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: long ? "long" : "short", day: "numeric", ...(long ? { year: "numeric" } as const : {}) });
}
export function shareText(date: string, timeMs: number, mistakes: number): string {
  return `Pitcross — ${formatDate(date)}\nTime: ${formatTime(timeMs)} · ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}`;
}
