import "./global.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "APE — Automated Portfolio Evaluator",
  description: "AI Portfolio Decision Co-Pilot (Automated Portfolio Evaluator)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}