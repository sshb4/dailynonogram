import { test } from "node:test";
import assert from "node:assert/strict";
import sourcePuzzles from "../data/puzzles.json";
import { applyMove, newGame, solvedGame } from "../lib/game";
import { clues, dailyPuzzle, formatTime, LAUNCH_DATE, localDate, puzzles, runs, shareText, type Puzzle } from "../lib/puzzles";
const puzzle: Puzzle = { name: "test", width: 3, height: 2, cells: [["#000000", null, "#ffffff"], [null, "#000000", null]] };

test("provided puzzles have the expected dimensions and valid clues", () => {
  assert.deepEqual(puzzles.map(p => [p.name, p.width, p.height]), [["ladybug", 15, 15], ["duck", 15, 15], ["red-blue", 15, 15]]);
  for (const p of puzzles) {
    const hints = clues(p);
    assert.equal(hints.rows.length, p.height);
    assert.equal(hints.columns.length, p.width);
    assert.equal(hints.rows.flat().reduce((a, b) => a + b, 0), p.cells.flat().filter(Boolean).length);
    assert.equal(hints.columns.flat().reduce((a, b) => a + b, 0), p.cells.flat().filter(Boolean).length);
  }
  assert.deepEqual(runs([null, "a", "b", null, "c", "d", "e"]), [2, 3]);
  assert.deepEqual(runs([null, null]), [0]);
  assert.deepEqual(clues(puzzle), { rows: [[1, 1], [1]], columns: [[1], [1], [1]] });
});
test("every board has 225 cells with centered, unchanged artwork and empty padding", () => {
  puzzles.forEach((board, index) => {
    const source = sourcePuzzles[index];
    const top = Math.floor((15 - source.height) / 2);
    const left = Math.floor((15 - source.width) / 2);
    assert.equal(newGame(board).cells.length, 225);
    assert.equal(board.cells.length, 15);
    board.cells.forEach((row, y) => {
      assert.equal(row.length, 15);
      row.forEach((cell, x) => assert.equal(cell, source.cells[y - top]?.[x - left] ?? null));
    });
    assert.deepEqual(board.cells.flat().filter(Boolean).sort(), source.cells.flat().filter(Boolean).sort());
    const hints = clues(board);
    board.cells.forEach((row, y) => { if (row.every(cell => cell === null)) assert.deepEqual(hints.rows[y], [0]); });
    for (let x = 0; x < 15; x++) {
      if (board.cells.every(row => row[x] === null)) assert.deepEqual(hints.columns[x], [0]);
    }
    const empty = board.cells.flat().findIndex(cell => cell === null);
    if (empty !== -1) assert.equal(applyMove(newGame(board), board, empty, 1, 1000).mistakes, 1);
  });
});
test("daily rotation wraps, handles prelaunch and DST by calendar day", () => {
  assert.equal(dailyPuzzle(LAUNCH_DATE).puzzle.name, "ladybug");
  assert.equal(dailyPuzzle("2026-11-16").puzzle.name, "duck");
  assert.equal(dailyPuzzle("2026-11-17").puzzle.name, "red-blue");
  assert.equal(dailyPuzzle("2026-11-18").puzzle.name, "ladybug");
  assert.equal(dailyPuzzle("2026-11-14").puzzle.name, "red-blue");
  assert.equal(dailyPuzzle("2027-03-15").dayIndex - dailyPuzzle("2027-03-14").dayIndex, 1);
  assert.equal(localDate(new Date(2026, 10, 15, 23, 59)), "2026-11-15");
});
test("timer starts on first X; X protects fill; mistakes count per new wrong fill", () => {
  let game = newGame(puzzle);
  game = applyMove(game, puzzle, 0, 2, 1000);
  assert.equal(game.startedAt, 1000);
  assert.equal(applyMove(game, puzzle, 0, 1, 1500), game);
  game = applyMove(game, puzzle, 0, 0, 2000);
  game = applyMove(game, puzzle, 1, 1, 2500);
  assert.equal(game.mistakes, 1);
  assert.equal(applyMove(game, puzzle, 1, 1, 2600), game);
  game = applyMove(game, puzzle, 1, 0, 2700);
  assert.equal(game.mistakes, 1);
  game = applyMove(game, puzzle, 1, 1, 2800);
  assert.equal(game.mistakes, 2);
});
test("fill and X strokes preserve the other marks while drawing and erasing", () => {
  let original = newGame(puzzle);
  for (const [index, value] of [[0, 1], [1, 2], [3, 1], [4, 2]] as const) {
    original = applyMove(original, puzzle, index, value, 1000 + index);
  }
  for (const [tool, value, expected] of [
    [2, 2, [1, 2, 2, 1, 2, 2]],
    [1, 1, [1, 2, 1, 1, 2, 1]],
    [2, 0, [1, 0, 0, 1, 0, 0]],
    [1, 0, [0, 2, 0, 0, 2, 0]],
  ] as const) {
    let game = original;
    for (let index = 0; index < game.cells.length; index++) {
      game = applyMove(game, puzzle, index, value, 2000 + index, tool);
    }
    assert.deepEqual(game.cells, expected);
    if (tool === 2 || value === 0) assert.equal(game.mistakes, original.mistakes);
  }
  assert.equal(applyMove(original, puzzle, 0, 2, 3000, 2), original);
  assert.equal(applyMove(original, puzzle, 1, 1, 3000, 1), original);
});
test("solve requires no wrong fills, stops clock, and freezes moves", () => {
  let game = newGame(puzzle);
  for (const index of [0, 1, 2, 4]) game = applyMove(game, puzzle, index, 1, 1000 + index * 10);
  assert.equal(game.result, null);
  game = applyMove(game, puzzle, 1, 0, 5000);
  assert.deepEqual(game.result, { timeMs: 4000, mistakes: 1 });
  assert.equal(applyMove(game, puzzle, 0, 0, 8000), game);
  assert.deepEqual(solvedGame(puzzle, game.result!).cells, [1, 0, 1, 0, 1, 0]);
  assert.equal(newGame(puzzle).startedAt, null);
});
test("every provided puzzle can complete without X marks", () => {
  for (const puzzle of puzzles) {
    let game = newGame(puzzle);
    puzzle.cells.flat().forEach((cell, index) => { if (cell !== null) game = applyMove(game, puzzle, index, 1, 1000 + index * 10); });
    assert.ok(game.result);
    assert.equal(game.result.mistakes, 0);
  }
});
test("share format avoids picture spoilers", () => {
  assert.equal(formatTime(154000), "2:34");
  assert.equal(shareText("2026-11-15", 154000, 1), "Pitcross — Nov 15\nTime: 2:34 · 1 mistake");
  assert.match(shareText("2026-11-15", 999, 0), /0:00 · 0 mistakes$/);
});
