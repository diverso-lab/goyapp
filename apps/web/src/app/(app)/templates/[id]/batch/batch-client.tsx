"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as fabric from "fabric";

const SERIALIZE_PROPS = ["slot"];

type Template = {
  id: string;
  name: string;
  width: number;
  height: number;
  scene: unknown;
};

type FabricObjectJSON = Record<string, unknown> & { slot?: string; text?: string };

export function BatchClient({ template }: { template: Template }) {
  const slots = useMemo(() => collectSlots(template.scene), [template.scene]);

  const sampleRow = useMemo(() => {
    const obj: Record<string, string> = {};
    slots.forEach((s) => (obj[s] = `Example ${s}`));
    return obj;
  }, [slots]);

  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify([sampleRow, { ...sampleRow, ...(slots[0] ? { [slots[0]]: "Second poster" } : {}) }], null, 2),
  );
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [filenameField, setFilenameField] = useState<string>(slots[0] ?? "");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of objects");
      if (!parsed.every((r) => r && typeof r === "object")) throw new Error("Each row must be an object");
      setRows(parsed as Record<string, string>[]);
      setParseError(null);
    } catch (e) {
      setParseError((e as Error).message);
    }
  }, [jsonText]);

  async function generate() {
    if (!rows.length || busy || parseError) return;
    setBusy(true);
    setStatus("Rendering variants…");
    setProgress({ done: 0, total: rows.length });

    try {
      const items: { svg: string; width: number; height: number; filename: string }[] = [];
      const offscreen = document.createElement("canvas");
      const canvas = new fabric.StaticCanvas(offscreen, {
        width: template.width,
        height: template.height,
        backgroundColor: "#ffffff",
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const scene = applyRowToScene(template.scene, row);
        await canvas.loadFromJSON(scene);
        canvas.renderAll();
        const svg = canvas.toSVG();
        const nameRaw = (filenameField && row[filenameField]) || `${template.name}-${i + 1}`;
        items.push({
          svg,
          width: template.width,
          height: template.height,
          filename: String(nameRaw),
        });
        setProgress({ done: i + 1, total: rows.length });
      }
      canvas.dispose();

      setStatus("Generating PDFs…");
      const res = await fetch("/api/export/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items, zipName: template.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Done — ${rows.length} poster${rows.length === 1 ? "" : "s"} generated.`);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm hover:underline">← Back</Link>
          <h1 className="text-lg font-semibold">Batch generate — {template.name}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Rows (JSON array)</h2>
            <span className="text-xs text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full h-[480px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
            spellCheck={false}
          />
          {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Slots in this template</h3>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This template has no named slots yet. Open it in the editor, select a text object, and set a slot name
                (e.g. <code>title</code>) to make it substitutable here.
              </p>
            ) : (
              <ul className="text-xs space-y-1">
                {slots.map((s) => (
                  <li key={s} className="flex justify-between">
                    <code className="bg-muted px-1.5 rounded">{s}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Filename field</h3>
            <p className="text-xs text-muted-foreground">Which slot value becomes the PDF filename.</p>
            <select
              value={filenameField}
              onChange={(e) => setFilenameField(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">(auto: {template.name}-N)</option>
              {slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button
            onClick={generate}
            disabled={busy || !rows.length || !!parseError || slots.length === 0}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {busy
              ? progress
                ? `Rendering ${progress.done}/${progress.total}…`
                : "Working…"
              : `Generate ${rows.length} PDF${rows.length === 1 ? "" : "s"}`}
          </button>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </aside>
      </div>
    </main>
  );
}

function collectSlots(scene: unknown): string[] {
  const objects = (scene as { objects?: FabricObjectJSON[] } | null)?.objects ?? [];
  const found = new Set<string>();
  for (const o of objects) if (typeof o.slot === "string" && o.slot) found.add(o.slot);
  return [...found].sort();
}

function applyRowToScene(scene: unknown, row: Record<string, unknown>): object {
  const cloned = JSON.parse(JSON.stringify(scene)) as { objects?: FabricObjectJSON[] };
  if (Array.isArray(cloned.objects)) {
    for (const obj of cloned.objects) {
      if (typeof obj.slot === "string" && obj.slot in row) {
        const v = row[obj.slot];
        obj.text = v == null ? "" : String(v);
      }
    }
  }
  return cloned;
}
