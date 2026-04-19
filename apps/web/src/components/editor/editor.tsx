"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as fabric from "fabric";
import { installSmartGuides } from "./smart-guides";

type Project = {
  id: string;
  name: string;
  width: number;
  height: number;
  scene: unknown;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SERIALIZE_PROPS = ["slot"];
const HISTORY_LIMIT = 60;
const AUTOSAVE_MS = 1500;
const FONT_OPTIONS = ["Inter", "Oswald", "Playfair Display", "Merriweather", "Georgia", "Arial", "Courier New"];

export function Editor({ project }: { project: Project }) {
  const router = useRouter();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const historyRef = useRef<{ stack: string[]; index: number; suspended: boolean }>({
    stack: [],
    index: -1,
    suspended: false,
  });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panStateRef = useRef<{ active: boolean; lastX: number; lastY: number; spaceHeld: boolean }>({
    active: false, lastX: 0, lastY: 0, spaceHeld: false,
  });

  const [selected, setSelected] = useState<fabric.FabricObject | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [projectName, setProjectName] = useState(project.name);

  const refreshHistoryFlags = () => {
    const h = historyRef.current;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  };

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void save();
    }, AUTOSAVE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const h = historyRef.current;
    if (h.suspended) return;
    const snapshot = JSON.stringify(canvas.toObject(SERIALIZE_PROPS));
    if (h.stack[h.index] === snapshot) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(snapshot);
    if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
    h.index = h.stack.length - 1;
    refreshHistoryFlags();
    scheduleAutosave();
  }, [scheduleAutosave]);

  const restoreSnapshot = useCallback(async (snap: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const h = historyRef.current;
    h.suspended = true;
    await canvas.loadFromJSON(JSON.parse(snap));
    canvas.renderAll();
    h.suspended = false;
    setSelected(null);
  }, []);

  const undo = useCallback(async () => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    await restoreSnapshot(h.stack[h.index]);
    refreshHistoryFlags();
    scheduleAutosave();
  }, [restoreSnapshot, scheduleAutosave]);

  const redo = useCallback(async () => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    await restoreSnapshot(h.stack[h.index]);
    refreshHistoryFlags();
    scheduleAutosave();
  }, [restoreSnapshot, scheduleAutosave]);

  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: project.width,
      height: project.height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    historyRef.current.suspended = true;
    canvas.loadFromJSON(project.scene as object).then(() => {
      canvas.renderAll();
      fitToContainer();
      const initial = JSON.stringify(canvas.toObject(SERIALIZE_PROPS));
      historyRef.current = { stack: [initial], index: 0, suspended: false };
      refreshHistoryFlags();
    });

    const onSelect = () => setSelected(canvas.getActiveObject() ?? null);
    const onClear = () => setSelected(null);
    canvas.on("selection:created", onSelect);
    canvas.on("selection:updated", onSelect);
    canvas.on("selection:cleared", onClear);
    canvas.on("object:modified", pushHistory);
    canvas.on("object:added", pushHistory);
    canvas.on("object:removed", pushHistory);
    canvas.on("path:created", pushHistory);

    const uninstallGuides = installSmartGuides(canvas);

    // Wheel zoom
    canvas.on("mouse:wheel", (opt) => {
      const e = opt.e as WheelEvent;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      let z = canvas.getZoom() * 0.999 ** e.deltaY;
      z = Math.max(0.1, Math.min(4, z));
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), z);
      setZoom(z);
    });

    // Space+drag pan
    canvas.on("mouse:down", (opt) => {
      if (panStateRef.current.spaceHeld) {
        panStateRef.current.active = true;
        const e = opt.e as MouseEvent;
        panStateRef.current.lastX = e.clientX;
        panStateRef.current.lastY = e.clientY;
        canvas.selection = false;
        canvas.defaultCursor = "grabbing";
      }
    });
    canvas.on("mouse:move", (opt) => {
      if (!panStateRef.current.active) return;
      const e = opt.e as MouseEvent;
      const vpt = canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += e.clientX - panStateRef.current.lastX;
      vpt[5] += e.clientY - panStateRef.current.lastY;
      canvas.requestRenderAll();
      panStateRef.current.lastX = e.clientX;
      panStateRef.current.lastY = e.clientY;
    });
    canvas.on("mouse:up", () => {
      if (panStateRef.current.active) {
        panStateRef.current.active = false;
        canvas.selection = true;
        canvas.defaultCursor = panStateRef.current.spaceHeld ? "grab" : "default";
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input,textarea")) return;
      if (e.code === "Space" && !panStateRef.current.spaceHeld) {
        panStateRef.current.spaceHeld = true;
        canvas.defaultCursor = "grab";
        e.preventDefault();
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) { e.preventDefault(); redo(); return; }
      const active = canvas.getActiveObject();
      if (!active) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); canvas.remove(active); canvas.discardActiveObject(); canvas.requestRenderAll(); return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") active.set({ left: (active.left ?? 0) - step });
      else if (e.key === "ArrowRight") active.set({ left: (active.left ?? 0) + step });
      else if (e.key === "ArrowUp") active.set({ top: (active.top ?? 0) - step });
      else if (e.key === "ArrowDown") active.set({ top: (active.top ?? 0) + step });
      canvas.requestRenderAll();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        panStateRef.current.spaceHeld = false;
        panStateRef.current.active = false;
        canvas.defaultCursor = "default";
        canvas.selection = true;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      uninstallGuides();
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const fitToContainer = useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const padding = 48;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scale = Math.min(availW / project.width, availH / project.height, 1);
    const w = Math.round(project.width * scale);
    const h = Math.round(project.height * scale);
    canvas.setDimensions({ width: w, height: h });
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    setZoom(scale);
    canvas.requestRenderAll();
  }, [project.width, project.height]);

  useEffect(() => {
    const onResize = () => fitToContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToContainer]);

  const zoomBy = (factor: number) => {
    const c = fabricRef.current;
    if (!c) return;
    const center = new fabric.Point(c.getWidth() / 2, c.getHeight() / 2);
    const z = Math.max(0.1, Math.min(4, c.getZoom() * factor));
    c.zoomToPoint(center, z);
    setZoom(z);
  };

  const addText = () => {
    const c = fabricRef.current;
    if (!c) return;
    const t = new fabric.Textbox("Double-click to edit", {
      left: project.width / 2 - 300,
      top: project.height / 2,
      width: 600,
      fontFamily: "Inter",
      fontSize: 64,
      fill: "#111111",
      textAlign: "left",
    });
    c.add(t); c.setActiveObject(t); c.requestRenderAll();
  };
  const addRect = () => {
    const c = fabricRef.current;
    if (!c) return;
    const r = new fabric.Rect({
      left: project.width / 2 - 150, top: project.height / 2 - 100,
      width: 300, height: 200, fill: "#2563eb", rx: 12, ry: 12,
    });
    c.add(r); c.setActiveObject(r); c.requestRenderAll();
  };
  const addCircle = () => {
    const c = fabricRef.current;
    if (!c) return;
    const o = new fabric.Circle({
      left: project.width / 2 - 100, top: project.height / 2 - 100,
      radius: 100, fill: "#16a34a",
    });
    c.add(o); c.setActiveObject(o); c.requestRenderAll();
  };
  const uploadImage = async (file: File) => {
    const c = fabricRef.current;
    if (!c) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await fabric.FabricImage.fromURL(dataUrl);
    const scale = Math.min(
      (project.width * 0.6) / (img.width ?? 1),
      (project.height * 0.6) / (img.height ?? 1),
    );
    img.set({ left: project.width / 2, top: project.height / 2, originX: "center", originY: "center", scaleX: scale, scaleY: scale });
    c.add(img); c.setActiveObject(img); c.requestRenderAll();
  };

  const bringForward = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.bringObjectForward(a); c.requestRenderAll(); pushHistory(); } };
  const sendBackward = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.sendObjectBackwards(a); c.requestRenderAll(); pushHistory(); } };
  const deleteSelected = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.remove(a); c.discardActiveObject(); c.requestRenderAll(); } };
  const duplicate = async () => {
    const c = fabricRef.current; const a = c?.getActiveObject();
    if (!c || !a) return;
    const clone = await a.clone(SERIALIZE_PROPS);
    clone.set({ left: (a.left ?? 0) + 20, top: (a.top ?? 0) + 20 });
    c.add(clone); c.setActiveObject(clone); c.requestRenderAll();
  };

  const save = useCallback(async () => {
    const c = fabricRef.current;
    if (!c) return;
    setSaveState("saving");
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene: c.toObject(SERIALIZE_PROPS), name: projectName }),
    });
    setSaveState(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
  }, [project.id, projectName]);

  const saveAsTemplate = async () => {
    const c = fabricRef.current;
    if (!c) return;
    const name = prompt("Template name", projectName);
    if (!name) return;
    const category = prompt("Category (optional)", "") ?? undefined;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name, category: category || undefined,
        width: project.width, height: project.height,
        scene: c.toObject(SERIALIZE_PROPS),
      }),
    });
    if (!res.ok) { alert("Failed to save template"); return; }
    alert("Template saved");
    router.refresh();
  };

  const withFullSize = <T,>(fn: () => T): T => {
    const c = fabricRef.current!;
    const prevVpt = [...(c.viewportTransform ?? [1, 0, 0, 1, 0, 0])] as fabric.TMat2D;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setDimensions({ width: project.width, height: project.height });
    const out = fn();
    c.setViewportTransform(prevVpt);
    fitToContainer();
    return out;
  };
  const exportSVG = () => {
    const svg = withFullSize(() => fabricRef.current!.toSVG());
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${projectName}.svg`);
  };
  const exportRaster = (ext: "png" | "jpg") => {
    const dataUrl = withFullSize(() =>
      fabricRef.current!.toDataURL({ format: ext === "jpg" ? "jpeg" : "png", multiplier: 2, quality: 1 }),
    );
    fetch(dataUrl).then((r) => r.blob()).then((b) => downloadBlob(b, `${projectName}.${ext}`));
  };
  const exportPDF = async () => {
    const svg = withFullSize(() => fabricRef.current!.toSVG());
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ svg, width: project.width, height: project.height, filename: projectName }),
    });
    if (!res.ok) { alert("PDF export failed"); return; }
    downloadBlob(await res.blob(), `${projectName}.pdf`);
  };

  const slots = collectSlots(fabricRef.current);

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 shrink-0 flex items-center gap-4 border-b px-4 bg-card">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onBlur={() => scheduleAutosave()}
          className="h-8 rounded-md border bg-background px-2 text-sm w-64"
          placeholder="Untitled poster"
        />
        <span className="text-xs text-muted-foreground">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "All changes saved" : saveState === "error" ? "Save failed" : "Autosave on"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => zoomBy(0.9)} className="h-8 w-8 rounded-md border text-sm hover:bg-accent" title="Zoom out">−</button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => zoomBy(1.1)} className="h-8 w-8 rounded-md border text-sm hover:bg-accent" title="Zoom in">+</button>
          <button onClick={fitToContainer} className="h-8 px-2 rounded-md border text-xs hover:bg-accent" title="Fit">Fit</button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r p-3 space-y-2 overflow-y-auto">
          <div className="flex gap-2">
            <button onClick={undo} disabled={!canUndo} className="flex-1 h-9 rounded-md border text-sm hover:bg-accent disabled:opacity-40" title="Undo (Ctrl+Z)">↶</button>
            <button onClick={redo} disabled={!canRedo} className="flex-1 h-9 rounded-md border text-sm hover:bg-accent disabled:opacity-40" title="Redo (Ctrl+Shift+Z)">↷</button>
          </div>

          <h3 className="text-xs uppercase tracking-wide text-muted-foreground px-1 pt-2">Add</h3>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent" onClick={addText}>Text</button>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent" onClick={addRect}>Rectangle</button>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent" onClick={addCircle}>Circle</button>
          <label className="block w-full cursor-pointer rounded-md px-3 py-2 text-sm hover:bg-accent">
            Image…
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ""; }} />
          </label>

          <h3 className="text-xs uppercase tracking-wide text-muted-foreground px-1 pt-4">Arrange</h3>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50" disabled={!selected} onClick={bringForward}>Bring forward</button>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50" disabled={!selected} onClick={sendBackward}>Send backward</button>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm hover:bg-accent disabled:opacity-50" disabled={!selected} onClick={duplicate}>Duplicate</button>
          <button className="w-full text-left rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50" disabled={!selected} onClick={deleteSelected}>Delete</button>

          {slots.length > 0 && (
            <>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground px-1 pt-4">Slots</h3>
              <ul className="text-xs space-y-1 px-1">
                {slots.map((s) => (<li key={s} className="truncate"><code>{s}</code></li>))}
              </ul>
            </>
          )}

          <p className="text-[10px] text-muted-foreground px-1 pt-4 leading-relaxed">
            <strong>Tips:</strong><br />
            Ctrl/⌘+wheel = zoom<br />
            Space+drag = pan<br />
            Arrows = nudge (shift = 10px)
          </p>
        </aside>

        <div ref={containerRef} className="flex-1 min-w-0 bg-muted/40 flex items-center justify-center overflow-hidden">
          <div className="shadow-xl bg-white">
            <canvas ref={canvasElRef} />
          </div>
        </div>

        <aside className="w-72 shrink-0 border-l p-3 space-y-3 overflow-y-auto">
          <button onClick={saveAsTemplate} className="w-full h-9 rounded-md border text-sm hover:bg-accent">Save as template</button>

          <div className="border-t pt-3">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Export</h3>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={exportSVG} className="h-9 rounded-md border text-sm hover:bg-accent">SVG</button>
              <button onClick={() => exportRaster("png")} className="h-9 rounded-md border text-sm hover:bg-accent">PNG</button>
              <button onClick={() => exportRaster("jpg")} className="h-9 rounded-md border text-sm hover:bg-accent">JPG</button>
              <button onClick={exportPDF} className="h-9 rounded-md border text-sm hover:bg-accent">PDF</button>
            </div>
          </div>

          {selected && (
            <PropertiesPanel
              object={selected}
              canvas={fabricRef.current}
              onAfterChange={() => {
                setSelected(fabricRef.current?.getActiveObject() ?? null);
                pushHistory();
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function collectSlots(canvas: fabric.Canvas | null): string[] {
  if (!canvas) return [];
  const slots = new Set<string>();
  canvas.getObjects().forEach((o) => {
    const s = (o as unknown as { slot?: string }).slot;
    if (typeof s === "string" && s.length > 0) slots.add(s);
  });
  return [...slots].sort();
}

function PropertiesPanel({
  object, canvas, onAfterChange,
}: {
  object: fabric.FabricObject;
  canvas: fabric.Canvas | null;
  onAfterChange: () => void;
}) {
  const [, force] = useState(0);
  const rerender = () => force((v) => v + 1);

  const update = (patch: Record<string, unknown>) => {
    object.set(patch);
    object.setCoords();
    canvas?.requestRenderAll();
    rerender();
    onAfterChange();
  };

  const isText = object instanceof fabric.IText || object instanceof fabric.Textbox;
  const currentSlot = (object as unknown as { slot?: string }).slot ?? "";
  const textAlign = (object as fabric.IText).textAlign ?? "left";

  const shadow = object.shadow as fabric.Shadow | null | undefined;
  const shadowEnabled = !!shadow;
  const setShadow = (patch: Partial<{ color: string; blur: number; offsetX: number; offsetY: number; enabled: boolean }>) => {
    if (patch.enabled === false) { update({ shadow: null }); return; }
    const current = shadow ?? new fabric.Shadow({ color: "rgba(0,0,0,0.4)", blur: 12, offsetX: 4, offsetY: 4 });
    const next = new fabric.Shadow({
      color: patch.color ?? current.color,
      blur: patch.blur ?? current.blur,
      offsetX: patch.offsetX ?? current.offsetX,
      offsetY: patch.offsetY ?? current.offsetY,
    });
    update({ shadow: next });
  };

  return (
    <div className="border-t pt-3 space-y-3">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Properties</h3>

      <div className="grid grid-cols-2 gap-2">
        <NumField label="X" value={Math.round(object.left ?? 0)} onChange={(v) => update({ left: v })} />
        <NumField label="Y" value={Math.round(object.top ?? 0)} onChange={(v) => update({ top: v })} />
        <NumField label="Rot" value={Math.round(object.angle ?? 0)} onChange={(v) => update({ angle: v })} />
        <NumField label="Opac" value={Math.round((object.opacity ?? 1) * 100)} onChange={(v) => update({ opacity: Math.max(0, Math.min(1, v / 100)) })} />
      </div>

      {!isText && (
        <div className="grid grid-cols-2 gap-2">
          <NumField label="W" value={Math.round((object.width ?? 0) * (object.scaleX ?? 1))}
            onChange={(v) => update({ scaleX: v / Math.max(1, object.width ?? 1) })} />
          <NumField label="H" value={Math.round((object.height ?? 0) * (object.scaleY ?? 1))}
            onChange={(v) => update({ scaleY: v / Math.max(1, object.height ?? 1) })} />
        </div>
      )}

      <ColorField label="Fill" value={typeof object.fill === "string" ? object.fill : "#000000"}
        onChange={(v) => update({ fill: v })} />

      {!isText && (
        <>
          <ColorField label="Stroke" value={typeof object.stroke === "string" ? object.stroke : "#000000"}
            onChange={(v) => update({ stroke: v })} />
          <NumField label="Stroke width" value={object.strokeWidth ?? 0}
            onChange={(v) => update({ strokeWidth: Math.max(0, v) })} />
        </>
      )}

      <div className="border rounded-md p-2 space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={shadowEnabled}
            onChange={(e) => setShadow({ enabled: e.target.checked })} />
          Drop shadow
        </label>
        {shadowEnabled && (
          <>
            <ColorField label="Color" value={hexFromShadowColor(shadow?.color)}
              onChange={(v) => setShadow({ color: hexToRgba(v, alphaFromShadowColor(shadow?.color)) })} />
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Blur" value={Math.round(shadow?.blur ?? 0)} onChange={(v) => setShadow({ blur: v })} />
              <NumField label="Offset X" value={Math.round(shadow?.offsetX ?? 0)} onChange={(v) => setShadow({ offsetX: v })} />
              <NumField label="Offset Y" value={Math.round(shadow?.offsetY ?? 0)} onChange={(v) => setShadow({ offsetY: v })} />
            </div>
          </>
        )}
      </div>

      {isText && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Text</label>
            <textarea value={(object as fabric.IText).text ?? ""}
              onChange={(e) => update({ text: e.target.value })}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Size" value={(object as fabric.IText).fontSize ?? 16} onChange={(v) => update({ fontSize: v })} />
            <NumField label="Box W" value={Math.round((object as fabric.Textbox).width ?? 0)}
              onChange={(v) => update({ width: Math.max(40, v) })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Font</label>
            <select value={(object as fabric.IText).fontFamily ?? "Inter"}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="w-full h-9 rounded-md border bg-background px-2 text-sm">
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Align</label>
            <div className="grid grid-cols-3 gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} onClick={() => update({ textAlign: a })}
                  className={`h-9 rounded-md border text-xs ${textAlign === a ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => update({ fontWeight: (object as fabric.IText).fontWeight === "bold" ? "normal" : "bold" })}
              className={`h-9 rounded-md border text-xs font-bold ${(object as fabric.IText).fontWeight === "bold" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>B</button>
            <button onClick={() => update({ fontStyle: (object as fabric.IText).fontStyle === "italic" ? "normal" : "italic" })}
              className={`h-9 rounded-md border text-xs italic ${(object as fabric.IText).fontStyle === "italic" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>I</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Line height" value={Number(((object as fabric.IText).lineHeight ?? 1).toFixed(2))}
              onChange={(v) => update({ lineHeight: Math.max(0.5, v) })} />
            <NumField label="Letter spacing" value={(object as fabric.IText).charSpacing ?? 0}
              onChange={(v) => update({ charSpacing: v })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Slot name (for batch)</label>
            <input value={currentSlot} onChange={(e) => update({ slot: e.target.value })}
              placeholder="e.g. title, speaker, datetime"
              className="w-full h-9 rounded-md border bg-background px-2 text-sm font-mono" />
          </div>
        </>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type="number" value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-9 rounded-md border bg-background px-2 text-sm" />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = normalizeHex(value);
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded-md border cursor-pointer" />
        <input type="text" value={hex} onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-9 rounded-md border bg-background px-2 text-xs font-mono uppercase" />
      </div>
    </div>
  );
}

function normalizeHex(v: string): string {
  if (typeof v !== "string") return "#000000";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map((c) => c + c).join("");
  return "#000000";
}

function hexFromShadowColor(c: string | undefined): string {
  if (!c) return "#000000";
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const to = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${to(m[1])}${to(m[2])}${to(m[3])}`;
  }
  return normalizeHex(c);
}

function alphaFromShadowColor(c: string | undefined): number {
  if (!c) return 0.4;
  const m = c.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i);
  return m ? Number(m[1]) : 1;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
