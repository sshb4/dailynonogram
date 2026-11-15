import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Pitcross — Daily nonogram", description: "A daily picture-logic puzzle. Follow the clues, fill the grid, and reveal the picture." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
