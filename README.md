# Pitcross (working title)

A daily nonogram built from the supplied build brief and three puzzle images. Next.js App Router, Tailwind CSS, static export, and an optional Cloudflare Worker + D1 leaderboard. No accounts. Puzzle colors appear only after solving.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To configure the optional leaderboard, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_SCORES_API_URL` to the Worker origin (no `/scores` suffix), and restart the dev server. With no API configured or with the Worker unreachable, the game and share button still work; the leaderboard shows an unavailable note. This is backend independence, not a service-worker installation or a guarantee of first-load access without internet.

```sh
npm test
npm run typecheck
npm run build
```

The static site is generated in `out/`. No Next.js server is needed to host it. For a local production preview, run `python3 -m http.server 3000 --directory out` after building.

## Playing

Every playable board is 15×15. Smaller pictures are centered within the board and padded with empty cells; clues include all 15 rows and columns. Numbers show consecutive runs of filled cells, separated by at least one empty cell. Click or drag to fill or erase. Right-click or choose X mark to mark/unmark a cell. X marks protect cells from filling until removed. A drag uses the action chosen by its first cell and visits each cell once. Fill strokes skip X marks, and X strokes skip filled squares, including when erasing. Arrow keys navigate cells; Space/Enter applies the selected mode.

The timer starts on the first cell change, includes time spent away from the tab, and stops automatically when the solution is complete. Every new incorrect fill counts as a mistake; erasing it does not undo that mistake. Reset clears the active board and timer. Only completed results are saved locally, per local calendar date. Returning to a solved day displays the result and colored picture. Replay leaves the previous saved daily result in place until the replay is completed; it never automatically posts or modifies an API score. Share copies the date, time, and mistake count, without the picture or its name.

## Daily rotation and adding puzzles

Set `LAUNCH_DATE` in `lib/puzzles.ts` to the local calendar day the game goes live. It currently uses **2026-11-15**, the date suggested in the brief. Before launch the same rotation wraps backwards so the game remains usable. Day differences use calendar dates to avoid daylight-saving drift. At local midnight, the active game switches to the new day.

`data/puzzles.json` is the application's source of truth. The original supplied `puzzles.json` is retained at the repo root for reference. The three supplied puzzles are unchanged and in order: ladybug (15×15), duck (10×10), red-blue (11×15).

Append new entries to `data/puzzles.json`; do not reorder existing entries. Each entry has `name`, integer `width` and `height` between 1 and 15 (the artwork dimensions), and a rectangular `cells` array. The loader places the artwork on a 15×15 board. Each cell is `null` or a six-digit hex color. For example:

```json
{"name":"example","width":2,"height":2,"cells":[[null,"#353935"],["#FE3C3B",null]]}
```

Clues are computed automatically from non-null cells, regardless of their color. Data shape is validated when loaded. Check that new puzzles are solvable from the clues before adding them. Keep styles in `app/globals.css`.

The requested rotation is `dayIndex % puzzles.length`. Appending extends that cycle. Mathematically, changing the list length also changes some historical date mappings; preserving an immutable archive would require a versioned schedule. This implementation follows the brief's modulo formula and does not add an archive.

## GitHub Pages deployment

1. Push this project to a GitHub repository with a `main` branch.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Optionally add the repository Actions variable `NEXT_PUBLIC_SCORES_API_URL` with your Worker origin.
4. Push to `main` or manually run **Deploy to GitHub Pages**.

`.github/workflows/deploy.yml` installs locked dependencies, runs tests and TypeScript checks, builds the static export, and deploys `out/`. The workflow gets `base_path` from GitHub's Pages configuration, supporting both project paths and root/custom domains. For a manual project-path build set `NEXT_PUBLIC_BASE_PATH=/your-repository` when running `npm run build`. Environment variables beginning `NEXT_PUBLIC_` are baked in at build time; rebuild after changing them.

The included workflow runs when you push to the repository’s `main` branch. Enable GitHub Pages in repository settings before deploying.

## Cloudflare Worker and D1

The Worker is optional and deployed separately from GitHub Pages. It exposes:

- `GET /scores?date=YYYY-MM-DD`: an array of up to ten `{ id, name, timeMs, mistakes }` rows sorted by time, mistakes, then insertion order.
- `POST /scores`: JSON `{ "date": "2026-11-15", "name": "Sasha", "timeMs": 154000, "mistakes": 1 }`; responds `201` with `{ "id": ... }`.

The API validates real calendar dates, a nonblank name of 1–20 characters, positive safe integer milliseconds, nonnegative safe integer mistakes, and rejects unknown fields. Names are trimmed. It uses prepared SQL statements. Each explicit save inserts a row, as specified; scores are client-reported and this casual leaderboard does not verify solve authenticity or enforce one score per person.

Create a Cloudflare account and authenticate Wrangler, then:

```sh
npx wrangler login
npx wrangler d1 create pitcross-scores
```

Replace the placeholder `database_id` in `worker/wrangler.toml` with the returned ID. Initialize and run locally:

```sh
npx wrangler d1 execute pitcross-scores --local --file worker/schema.sql --config worker/wrangler.toml
npm run worker:dev
```

Set `NEXT_PUBLIC_SCORES_API_URL=http://localhost:8787` in `.env.local` and restart Next.js. The local database is independent of production.

For production:

```sh
npx wrangler d1 execute pitcross-scores --remote --file worker/schema.sql --config worker/wrangler.toml
npm run worker:deploy
```

Use the deployed Worker origin as the GitHub Actions variable. Optionally uncomment `ALLOWED_ORIGIN` in `worker/wrangler.toml` to restrict browser access to your site origin (for example `https://YOUR-USERNAME.github.io`, without a repository path). By default CORS permits all origins. Deploying the Worker and creating remote resources requires your own Cloudflare credentials; no cloud resources are created by the local build.

## Verification

Tests cover clue generation, provided data, local date rotation including DST/prelaunch, timer and mistake behavior, X protection, complete solutions of all supplied puzzles, sharing format, Worker payload validation, CORS, failure handling, and top-ten SQL ordering. `npm run typecheck` checks frontend and Worker source; `npm run build` verifies the static export. Browser interaction and real remote deployments should also be checked in your target environment.
