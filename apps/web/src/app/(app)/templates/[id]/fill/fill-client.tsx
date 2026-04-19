"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { useDialog } from "@/components/ui/dialogs";

type Template = {
  id: string;
  name: string;
  width: number;
  height: number;
  scene: unknown;
};

type FabricObj = { slot?: string; text?: string; type?: string };

function collectSlots(scene: unknown): { name: string; initial: string; multiline: boolean }[] {
  const objects = (scene as { objects?: FabricObj[] } | null)?.objects ?? [];
  const seen = new Map<string, { name: string; initial: string; multiline: boolean }>();
  for (const o of objects) {
    if (typeof o.slot === "string" && o.slot && !seen.has(o.slot)) {
      const text = typeof o.text === "string" ? o.text : "";
      seen.set(o.slot, {
        name: o.slot,
        initial: text,
        multiline: text.includes("\n") || text.length > 40,
      });
    }
  }
  return [...seen.values()];
}

function applyValuesToScene(scene: unknown, values: Record<string, string>): object {
  const clone = JSON.parse(JSON.stringify(scene)) as { objects?: FabricObj[] };
  if (Array.isArray(clone.objects)) {
    for (const o of clone.objects) {
      if (typeof o.slot === "string" && o.slot in values) {
        o.text = values[o.slot] ?? "";
      }
    }
  }
  return clone;
}

export function FillClient({ template }: { template: Template }) {
  const router = useRouter();
  const dialog = useDialog();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<fabric.StaticCanvas | null>(null);
  const slots = useMemo(() => collectSlots(template.scene), [template.scene]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(slots.map((s) => [s.name, s.initial])),
  );
  const [filename, setFilename] = useState<string>(() => template.name);
  const [busy, setBusy] = useState<string | null>(null);

  // Initialize static canvas + initial render
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;
    const c = new fabric.StaticCanvas(el, {
      width: template.width,
      height: template.height,
      backgroundColor: "#ffffff",
    });
    fabricRef.current = c;
    c.loadFromJSON(applyValuesToScene(template.scene, values)).then(() => {
      c.renderAll();
      fit();
    });
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      c.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  // Live-update text when values change
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    c.getObjects().forEach((o) => {
      const slot = (o as unknown as { slot?: string }).slot;
      if (slot && slot in values) {
        (o as fabric.IText).set({ text: values[slot] ?? "" });
      }
    });
    c.requestRenderAll();
  }, [values]);

  function fit() {
    const c = fabricRef.current;
    const container = containerRef.current;
    if (!c || !container) return;
    const padding = 32;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scale = Math.min(availW / template.width, availH / template.height, 1);
    const w = Math.round(template.width * scale);
    const h = Math.round(template.height * scale);
    c.setDimensions({ width: w, height: h });
    c.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    c.requestRenderAll();
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function withFullSize<T>(fn: () => T): T {
    const c = fabricRef.current!;
    const prevVpt = [...(c.viewportTransform ?? [1, 0, 0, 1, 0, 0])] as fabric.TMat2D;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setDimensions({ width: template.width, height: template.height });
    const out = fn();
    c.setViewportTransform(prevVpt);
    fit();
    return out;
  }

  async function exportSVG() {
    setBusy("svg");
    const svg = withFullSize(() => fabricRef.current!.toSVG());
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
    setBusy(null);
  }

  async function exportRaster(ext: "png" | "jpg") {
    setBusy(ext);
    const dataUrl = withFullSize(() =>
      fabricRef.current!.toDataURL({ format: ext === "jpg" ? "jpeg" : "png", multiplier: 2, quality: 1 }),
    );
    const blob = await fetch(dataUrl).then((r) => r.blob());
    downloadBlob(blob, `${filename}.${ext}`);
    setBusy(null);
  }

  async function exportPDF() {
    setBusy("pdf");
    const svg = withFullSize(() => fabricRef.current!.toSVG());
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ svg, width: template.width, height: template.height, filename }),
      });
      if (!res.ok) throw new Error("PDF export failed");
      downloadBlob(await res.blob(), `${filename}.pdf`);
    } catch (e) {
      await dialog.alert({ title: "Something went wrong", message: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function saveAsProject() {
    setBusy("save");
    const c = fabricRef.current!;
    const scene = c.toObject(["slot"]);
    try {
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: filename, templateId: template.id }),
      });
      if (!createRes.ok) throw new Error("Could not create project");
      const { project } = await createRes.json();
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      router.push(`/editor/${project.id}`);
    } catch (e) {
      await dialog.alert({ title: "Something went wrong", message: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-8 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            ← Dashboard
          </Button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{template.name}</h1>
            <p className="text-xs text-slate-500">Fill in the blanks, preview in real time, export.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => router.push(`/templates/${template.id}/batch`)}>
          Generate many (batch)
        </Button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-0 min-h-0">
        <aside className="order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-slate-200 bg-white px-6 py-6 lg:px-8 lg:py-8 space-y-6 overflow-y-auto">
          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Content</h2>
            <p className="text-xs text-slate-500 mb-4">
              Each field below maps to a slot in the template. Edit freely — layout stays fixed.
            </p>

            {slots.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                This template has no named slots. Open it in the editor to add them.
              </div>
            ) : (
              <div className="space-y-4">
                {slots.map((s) => (
                  <div key={s.name}>
                    <Label>{s.name}</Label>
                    {s.multiline ? (
                      <Textarea
                        value={values[s.name] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [s.name]: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={values[s.name] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [s.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">File name</h2>
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Export</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="md" onClick={exportPDF} disabled={!!busy}>
                {busy === "pdf" ? "…" : "Download PDF"}
              </Button>
              <Button variant="secondary" size="md" onClick={() => exportRaster("png")} disabled={!!busy}>
                {busy === "png" ? "…" : "PNG"}
              </Button>
              <Button variant="secondary" size="md" onClick={() => exportRaster("jpg")} disabled={!!busy}>
                {busy === "jpg" ? "…" : "JPG"}
              </Button>
              <Button variant="secondary" size="md" onClick={exportSVG} disabled={!!busy}>
                {busy === "svg" ? "…" : "SVG"}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={saveAsProject} disabled={!!busy}>
              {busy === "save" ? "Saving…" : "Save & open in editor"}
            </Button>
          </section>
        </aside>

        <div ref={containerRef} className="order-1 lg:order-2 min-w-0 flex items-center justify-center p-4 lg:p-8 min-h-[50vh] lg:min-h-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[length:18px_18px]">
          <div className="shadow-xl rounded bg-white">
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>
    </main>
  );
}
