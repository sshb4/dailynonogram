"use client";
import { useState } from "react";
import { shareText } from "@/lib/puzzles";
import type { Result } from "@/lib/game";
export default function ShareButton({ date, result }: { date: string; result: Result }) {
  const [status, setStatus] = useState("");
  async function copy() {
    const text = shareText(date, result.timeMs, result.mistakes);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const input = document.createElement("textarea");
        input.value = text;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Copy failed");
      }
      setStatus("Copied!");
    } catch { setStatus("Copy unavailable. You can copy the text below."); }
  }
  return <div className="share"><button className="button primary" onClick={copy}>Share your time <span aria-hidden="true">↗</span></button><span role="status">{status}</span>{status.startsWith("Copy unavailable") && <pre>{shareText(date, result.timeMs, result.mistakes)}</pre>}</div>;
}
