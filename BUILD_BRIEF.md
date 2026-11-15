# Pitcross — build brief

Give this brief plus the accompanying `puzzles.json` file to the coding
agent. The agent builds the repo. Do not invent requirements beyond this
brief. Working title is "Pitcross" — the final name is TBD, do not invent
a brand name, logo, or theme.

## What it is

A daily Picross (nonogram / picture-logic puzzle) web game. One new
puzzle per day. The goal is to solve it as fast as possible. It has a
daily leaderboard and a share-your-time feature (Wordle-style).

Super simple. No accounts, no login.

## Stack

- Next.js (App Router) + Tailwind CSS
- Static export (`output: 'export'`) so it can deploy to GitHub Pages
- GitHub Actions workflow: on push to `main`, build and deploy to
  GitHub Pages
- Leaderboard backend: Cloudflare Worker + D1 (free tier, SQLite-based).
  The frontend calls it only for scores. If the Worker is not set up yet,
  the game must still fully work offline of it (leaderboard section shows
  a "leaderboard unavailable" note, everything else works).
- Puzzles live in `data/puzzles.json` in the repo.

## Repo layout (suggested)

```
pitcross/
  app/
    page.tsx            # the game page
    layout.tsx
    globals.css
  components/
    PicrossGrid.tsx     # the playable grid + clues
    Leaderboard.tsx     # daily leaderboard
    ShareButton.tsx     # copy-your-time
  lib/
    puzzles.ts          # loads puzzles.json, daily rotation, clue math
    timer.ts            # timer helpers (if needed)
  data/
    puzzles.json        # puzzle data (provided with this brief)
  worker/
    index.ts            # Cloudflare Worker: scores API
    schema.sql          # D1 table for scores
  .github/
    workflows/
      deploy.yml        # build + deploy to GitHub Pages on push to main
  README.md             # how to run locally, how to add puzzles, how to deploy
```

## Puzzle data — `data/puzzles.json` (provided)

Format — an array of puzzles, in rotation order:

```json
[
  {
    "name": "ladybug",
    "width": 15,
    "height": 15,
    "cells": [
      [null, null, "#353935", "..."],
      "..."
    ]
  }
]
```

- `cells` is rows top-to-bottom, each row left-to-right.
- Each entry is either `null` (empty cell) or a hex color string
  (a filled cell, shown in that color on the solved reveal).
- A puzzle's filled cells are the ones that are not `null`.

The file provided with this brief has exactly 3 puzzles, in this order:
1. `ladybug` — 15 wide x 15 tall, colors: dark gray `#353935`, red `#FE3C3B`
2. `duck` — 10 wide x 10 tall, colors: yellow `#F3D302`, orange `#EC7302`, black `#000000`
3. `red-blue` — 11 wide x 15 tall, colors: near-black `#1A1C19`, red `#E3403B`, blue `#4898D7`

## Daily rotation

- A `LAUNCH_DATE` constant (e.g. `"2026-11-15"`) in `lib/puzzles.ts`.
  Set it to the day the game goes live; the owner can change it.
- `dayIndex = floor((today - LAUNCH_DATE) / 1 day)` using the player's
  local date.
- Today's puzzle = `puzzles[dayIndex % puzzles.length]`.
- Adding puzzles later = append an entry to `data/puzzles.json`. The
  rotation automatically gets longer. Do not renumber or reorder
  existing entries (that would change which puzzle a past day had).

## Gameplay

- The grid is the puzzle's width x height (not fixed 15x15 — puzzles
  have different sizes; the grid must size to the puzzle).
- Row clues (left of each row) and column clues (above each column)
  are computed from the filled cells: runs of consecutive filled cells,
  e.g. a row with filled cells at positions 2-3 and 6-8 shows "2 3".
  A row/column with no filled cells shows "0".
- During play, filled cells all use ONE fill color (pick a simple
  default, e.g. dark slate) — the picture's real colors are hidden
  until the solve is complete.
- Controls:
  - Click a cell to fill it. Click a filled cell to clear it.
  - Drag across cells to fill several at once.
  - Right-click a cell (and a Fill / X toggle button for touch) to mark
    it with an X. X-marked cells cannot be filled until unmarked.
  - A "Check" or auto-check: the puzzle is solved when every filled
    cell is correct and no incorrect cell is filled. Check automatically
    after each move; do not require a submit button.
  - A "Reset" button to clear the grid and restart the timer.
  - A "Hint" is NOT required. Do not add one.
- Timer:
  - Starts on the player's first grid action (fill, X, or clear).
  - Stops the moment the puzzle is solved.
  - Displayed as M:SS (e.g. 2:34) while playing.
- Mistakes:
  - Filling a cell that is empty in the solution counts as 1 mistake.
    Show the mistake count while playing. Do not block the player or
    clear the cell — just count it.
  - Un-filling a wrong cell does not remove the mistake.
- Win screen (on solve):
  - The grid re-renders with each filled cell in its real color from
    `cells` (the full-color picture reveal).
  - Show the puzzle name, the final time, and the mistake count.
  - Show a name field + "Save to leaderboard" button (see below).
  - Show a "Share" button (see below).
  - A "Play" state for already-solved days: if the player already
    solved today's puzzle (tracked in localStorage), show their time
    and the solved picture, with the option to replay (replay does not
    overwrite the saved leaderboard entry unless they save again).

## Leaderboard

- One leaderboard per day (per puzzle/date). Sorted by fastest time,
  then fewest mistakes. Show top 10, with rank, name, time, mistakes.
- Worker API (D1 table `scores`):
  - `POST /scores` with JSON `{ "date": "2026-11-15", "name": "Sasha",
    "timeMs": 154000, "mistakes": 1 }` — inserts one row. Validate:
    name 1-20 chars, timeMs a positive integer, mistakes a
    non-negative integer. Reject anything else.
  - `GET /scores?date=2026-11-15` — returns the day's scores sorted by
    timeMs asc, mistakes asc, limited to 10.
  - The frontend sends `date` as the puzzle's local date (same date
    used for the daily rotation).
- D1 schema:
  ```sql
  CREATE TABLE scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    time_ms INTEGER NOT NULL,
    mistakes INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_scores_date_time ON scores (date, time_ms, mistakes);
  ```
- If the Worker/API is unreachable, the leaderboard section shows a
  short "leaderboard unavailable right now" note. The game, timer, and
  share button must still work.
- Do not build accounts, login, or an admin page.

## Share / copy your time

A "Share" button on the win screen copies this text (and shows a
"copied" confirmation):

```
Pitcross — Nov 15
Time: 2:34 · 1 mistake
```

- Use the puzzle's local date in the first line, formatted like
  "Nov 15".
- Time formatted as M:SS. Mistakes as "0 mistakes" / "1 mistake" /
  "N mistakes".
- Do NOT include the solved picture in the share text (it would spoil
  the puzzle for others).

## Styling

- Styling is NOT decided yet. Use a clean, minimal, readable default:
  light background, dark grid lines, one fill color, clear clues, big
  tap targets. It must be usable on mobile (touch) and desktop.
- Do not invent a brand, theme, mascot, or color scheme. Keep all
  styling in one place (e.g. `globals.css` / Tailwind config) so it is
  easy to restyle later.

## Definition of done

- `npm run dev` runs the game locally; `npm run build` produces a
  static export that deploys to GitHub Pages via the Actions workflow.
- Playing a full puzzle works: clues are correct, fill/X/drag work,
  timer starts on first move and stops on solve, mistakes are counted,
  the win screen reveals the picture in full color with time + mistakes.
- The daily rotation shows a different puzzle each day and repeats the
  list when it runs out.
- The leaderboard saves a score and shows the day's top 10 (with the
  Worker running); the game still works if the Worker is down.
- The share button copies the text above and confirms it copied.
- README explains: how to run it, how to add a puzzle (append to
  `data/puzzles.json`), and how the deploy works.

## Out of scope (do not build)

- Accounts, login, or user profiles.
- An admin/upload page for puzzles (puzzles are added by editing
  `data/puzzles.json` in the repo).
- Hints, difficulty settings, or extra game modes.
- The 4 other pictures (perry, grogu, minion, grinch) — they are
  bigger than 15x15 and are excluded for now. They may be added later
  if resized; do not include them.
- Any styling theme beyond a clean minimal default.
