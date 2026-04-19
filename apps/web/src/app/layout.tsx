import "./globals.css";
import type { Metadata } from "next";
import { DialogProvider } from "@/components/ui/dialogs";

export const metadata: Metadata = {
  title: "Goyapp — Poster editor",
  description: "Create posters from templates. Drag anything, export anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
