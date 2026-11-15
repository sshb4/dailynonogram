"use client";
import { useMemo, useRef, type CSSProperties, type PointerEvent } from "react";
import { clues, type Puzzle } from "@/lib/puzzles";
import type { Cell } from "@/lib/game";

type Props = { puzzle: Puzzle; cells: Cell[]; solved: boolean; mode: "fill" | "x"; onMove: (index: number, value: Cell, tool: 1 | 2) => void };
export default function PicrossGrid({ puzzle, cells, solved, mode, onMove }: Props) {
  const hints = useMemo(() => clues(puzzle), [puzzle]);
  const stroke = useRef<{ pointer: number; value: Cell; tool: 1 | 2; visited: Set<number>; last: number | null } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const maxRows = Math.max(...hints.rows.map(row => row.length));
  const maxColumns = Math.max(...hints.columns.map(column => column.length));
  function paint(index: number) {
    const current = stroke.current;
    if (!current || current.visited.has(index)) return;
    current.visited.add(index);
    onMove(index, current.value, current.tool);
  }
  function cellAt(event: PointerEvent): number | null {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-cell]");
    return element && root.current?.contains(element) ? Number(element.dataset.cell) : null;
  }
  function begin(event: PointerEvent) {
    if (solved || (event.button !== 0 && event.button !== 2)) return;
    const index = cellAt(event);
    if (index === null) return;
    event.preventDefault();
    const marking = event.button === 2 || mode === "x";
    const value: Cell = marking ? cells[index] === 2 ? 0 : 2 : cells[index] === 1 ? 0 : 1;
    stroke.current = { pointer: event.pointerId, value, tool: marking ? 2 : 1, visited: new Set(), last: index };
    root.current?.setPointerCapture(event.pointerId);
    paint(index);
  }
  function drag(event: PointerEvent) {
    const current = stroke.current;
    if (!current || current.pointer !== event.pointerId) return;
    const index = cellAt(event);
    if (index === null) { current.last = null; return; }
    // Fill intermediate cells when a quick pointer movement skips a cell.
    if (current.last !== null) {
      const x0 = current.last % puzzle.width, y0 = Math.floor(current.last / puzzle.width);
      const x1 = index % puzzle.width, y1 = Math.floor(index / puzzle.width);
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let step = 1; step <= steps; step++) paint(Math.round(y0 + (y1 - y0) * step / steps) * puzzle.width + Math.round(x0 + (x1 - x0) * step / steps));
    }
    paint(index);
    current.last = index;
  }
  return <div className="puzzle-scroll" aria-label="Puzzle grid and clues">
    <div className="puzzle" style={{ "--columns": puzzle.width, "--rows": puzzle.height, "--row-clues": maxRows, "--column-clues": maxColumns } as CSSProperties}>
      <div className="clue-corner" aria-hidden="true">{puzzle.width} × {puzzle.height}</div>
      <div className="column-clues">{hints.columns.map((column, i) => <div className="column-clue" key={i} aria-label={`Column ${i + 1}: ${column.join(", ")}`}>{column.map((n, j) => <span key={j}>{n}</span>)}</div>)}</div>
      <div className="row-clues">{hints.rows.map((row, i) => <div className="row-clue" key={i} aria-label={`Row ${i + 1}: ${row.join(", ")}`}>{row.map((n, j) => <span key={j}>{n}</span>)}</div>)}</div>
      <div className={`cells ${solved ? "is-solved" : ""}`} ref={root} onPointerDown={begin} onPointerMove={drag} onPointerUp={() => { stroke.current = null; }} onPointerCancel={() => { stroke.current = null; }} onLostPointerCapture={() => { stroke.current = null; }} onContextMenu={event => event.preventDefault()}>
        {cells.map((cell, index) => {
          const row = Math.floor(index / puzzle.width), column = index % puzzle.width;
          const color = solved ? puzzle.cells[row][column] : null;
          return <button type="button" key={index} data-cell={index} className={`cell ${cell === 1 ? "filled" : ""} ${cell === 2 && !solved ? "marked" : ""} ${(column + 1) % 5 === 0 && column < puzzle.width - 1 ? "block-right" : ""} ${(row + 1) % 5 === 0 && row < puzzle.height - 1 ? "block-bottom" : ""}`}
            style={color ? { backgroundColor: color } : undefined} disabled={solved} aria-label={`Row ${row + 1}, column ${column + 1}: ${cell === 1 ? "filled" : cell === 2 ? "X" : "empty"}`} aria-pressed={cell !== 0}
            onClick={event => { if (event.detail === 0) onMove(index, mode === "x" ? cell === 2 ? 0 : 2 : cell === 1 ? 0 : 1, mode === "x" ? 2 : 1); }}
            onKeyDown={event => {
              const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.width, ArrowDown: puzzle.width }[event.key];
              if (offset !== undefined) {
                event.preventDefault();
                const next = index + offset;
                if (next >= 0 && next < cells.length) root.current?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
              }
            }}>{cell === 2 && !solved ? "×" : ""}</button>;
        })}
      </div>
    </div>
  </div>;
}
