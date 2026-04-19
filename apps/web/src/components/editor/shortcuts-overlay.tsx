"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const ROWS: [string, string][] = [
  ["⌘/Ctrl + Z", "Undo"],
  ["⌘/Ctrl + ⇧ Z", "Redo"],
  ["⌘/Ctrl + Wheel", "Zoom"],
  ["Space + Drag", "Pan"],
  ["⇧ + click", "Multi-select"],
  ["⌘/Ctrl + A", "Select all"],
  ["⌘/Ctrl + G", "Group selection"],
  ["⌘/Ctrl + ⇧ G", "Ungroup"],
  ["⌘/Ctrl + D", "Duplicate"],
  ["⌘/Ctrl + ]", "Bring forward"],
  ["⌘/Ctrl + [", "Send backward"],
  ["Arrows", "Nudge 1 px"],
  ["⇧ + Arrows", "Nudge 10 px"],
  ["Delete / Backspace", "Delete selection"],
  ["Esc", "Deselect"],
  ["?", "This help"],
];

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Keyboard shortcuts</h2>
            <p className="text-xs text-slate-500">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">Esc</kbd> to close.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {ROWS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                <span className="text-slate-700">{v}</span>
                <kbd className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{k}</kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
