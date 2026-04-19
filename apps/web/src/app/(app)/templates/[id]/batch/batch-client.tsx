"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Footer } from "@/components/footer";

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
  const router = useRouter();
  const slots = useMemo(() => collectSlots(template.scene), [template.scene]);

  const sampleRow = useMemo(() => {
    const obj: Record<string, string> = {};
    slots.forEach((s) => (obj[s] = `Example ${s}`));
    return obj;
  }, [slots]);

  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(
      [sampleRow, { ...sampleRow, ...(slots[0] ? { [slots[0]]: "Second poster" } : {}) }],
      null,
      2,
    ),
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
        items.push({ svg, width: template.width, height: template.height, filename: String(nameRaw) });
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
      a.href = url; a.download = `${template.name}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Done — ${rows.length} poster${rows.length === 1 ? "" : "s"} generated.`);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-8 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>← Dashboard</Button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Batch generate</h1>
            <p className="text-xs text-slate-500">{template.name} — {rows.length} row{rows.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => router.push(`/templates/${template.id}/fill`)}>
          Single fill-in
        </Button>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="mb-0">Rows (JSON array)</Label>
          </div>
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="h-[480px] font-mono text-xs resize-none"
            spellCheck={false}
          />
          {parseError && <p className="text-sm text-red-600">{parseError}</p>}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Slots in this template</h3>
            {slots.length === 0 ? (
              <p className="text-xs text-slate-500">
                This template has no named slots yet. Open it in the editor, select a text object, and set a slot name.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <li key={s} className="inline-flex items-center rounded-md bg-orange-50 ring-1 ring-orange-200 text-orange-800 px-2 py-0.5 text-[11px] font-mono">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            <div>
              <Label>Filename field</Label>
              <select
                value={filenameField}
                onChange={(e) => setFilenameField(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">(auto: {template.name}-N)</option>
                {slots.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={generate}
            disabled={busy || !rows.length || !!parseError || slots.length === 0}
          >
            {busy
              ? progress ? `Rendering ${progress.done}/${progress.total}…` : "Working…"
              : `Generate ${rows.length} PDF${rows.length === 1 ? "" : "s"}`}
          </Button>
          {status && <p className="text-xs text-slate-500">{status}</p>}
        </aside>
      </div>
      <Footer />
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
