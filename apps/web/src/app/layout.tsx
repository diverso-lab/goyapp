import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goyapp — Poster editor",
  description: "Create posters from templates. Drag anything, export anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
