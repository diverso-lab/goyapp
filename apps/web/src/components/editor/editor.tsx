"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as fabric from "fabric";
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Type as TypeIcon, Square, Circle, ImagePlus, Shapes, Layers as LayersIcon, Sliders,
  Keyboard, Copy, Trash2, ChevronUp, ChevronDown,
  AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyCenter, AlignEndHorizontal, AlignStartHorizontal,
  Save, FileDown, FileText, FileImage, Group as GroupIcon, Ungroup, Grid3x3,
  Bold, Italic, Sparkles, Triangle, Star, Hexagon, Minus,
  Share2, Link2, Unlink, History, X, Moon, Sun,
} from "lucide-react";
import { installSmartGuides } from "./smart-guides";
import { LayersPanel } from "./layers-panel";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { useDialog } from "@/components/ui/dialogs";

type Project = {
  id: string;
  name: string;
  width: number;
  height: number;
  scene: unknown;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SERIALIZE_PROPS = ["slot", "locked", "layerId", "autofit", "baseFontSize", "maxHeight"];

const DRAG_MIME = "application/x-goyapp-element";
const HISTORY_LIMIT = 60;
const AUTOSAVE_MS = 1500;
const FONT_OPTIONS = ["Inter", "Oswald", "Playfair Display", "Merriweather", "Georgia", "Arial", "Courier New"];

type Tab = "elements" | "uploads" | "layers" | "canvas";

export function Editor({
  project,
  mode = "project",
}: {
  project: Project;
  mode?: "project" | "template";
}) {
  const router = useRouter();
  const dialog = useDialog();
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
  const widthRef = useRef(project.width);
  const heightRef = useRef(project.height);

  const [tab, setTab] = useState<Tab>("elements");
  const [selected, setSelected] = useState<fabric.FabricObject | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [canvasBg, setCanvasBg] = useState<string>("#ffffff");
  const [canvasW, setCanvasW] = useState<number>(project.width);
  const [canvasH, setCanvasH] = useState<number>(project.height);
  const [showGrid, setShowGrid] = useState(false);
  const [layerTick, setLayerTick] = useState(0);

  const bumpLayerTick = useCallback(() => setLayerTick((t) => t + 1), []);

  const refreshHistoryFlags = () => {
    const h = historyRef.current;
    setCanUndo(h.index > 0);
    setCanRedo(h.index < h.stack.length - 1);
  };

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void save(); }, AUTOSAVE_MS);
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
    bumpLayerTick();
  }, [scheduleAutosave, bumpLayerTick]);

  const restoreSnapshot = useCallback(async (snap: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const h = historyRef.current;
    h.suspended = true;
    await canvas.loadFromJSON(JSON.parse(snap));
    canvas.renderAll();
    h.suspended = false;
    setSelected(null);
    bumpLayerTick();
  }, [bumpLayerTick]);

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
      setCanvasBg(typeof canvas.backgroundColor === "string" ? canvas.backgroundColor : "#ffffff");
      canvas.getObjects().forEach((o) => {
        if (o instanceof fabric.Textbox && (o as unknown as { autofit?: boolean }).autofit) {
          attachAutofit(o);
        }
      });
      const initial = JSON.stringify(canvas.toObject(SERIALIZE_PROPS));
      historyRef.current = { stack: [initial], index: 0, suspended: false };
      refreshHistoryFlags();
      bumpLayerTick();
    });

    const syncSelection = () => {
      const active = canvas.getActiveObject();
      setSelected(active ?? null);
      if (active instanceof fabric.ActiveSelection) {
        setSelectedCount(active.size());
      } else if (active) {
        setSelectedCount(1);
      } else {
        setSelectedCount(0);
      }
      bumpLayerTick();
    };
    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", () => { setSelected(null); setSelectedCount(0); bumpLayerTick(); });
    canvas.on("object:modified", pushHistory);
    canvas.on("object:added", pushHistory);
    canvas.on("object:removed", pushHistory);
    canvas.on("path:created", pushHistory);

    const uninstallGuides = installSmartGuides(canvas);

    // Wheel zoom
    canvas.on("mouse:wheel", (opt) => {
      const e = opt.e as WheelEvent;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); e.stopPropagation();
      let z = canvas.getZoom() * 0.999 ** e.deltaY;
      z = Math.max(0.1, Math.min(4, z));
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), z);
      setZoom(z);
    });

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
      if ((e.target as HTMLElement | null)?.closest("input,textarea,select,[contenteditable='true']")) return;
      if (e.code === "Space" && !panStateRef.current.spaceHeld) {
        panStateRef.current.spaceHeld = true;
        canvas.defaultCursor = "grab";
        e.preventDefault(); return;
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) { setShowShortcuts((v) => !v); return; }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (meta && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === "a") { e.preventDefault(); selectAll(); return; }
      if (meta && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); return; }
      if (meta && e.key.toLowerCase() === "g" && !e.shiftKey) { e.preventDefault(); groupSelection(); return; }
      if (meta && e.key.toLowerCase() === "g" && e.shiftKey) { e.preventDefault(); ungroupSelection(); return; }
      if (meta && e.key === "]") { e.preventDefault(); bringForward(); return; }
      if (meta && e.key === "[") { e.preventDefault(); sendBackward(); return; }
      if (e.key === "Escape") { canvas.discardActiveObject(); canvas.requestRenderAll(); return; }

      const active = canvas.getActiveObject();
      if (!active) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); deleteSelected(); return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") active.set({ left: (active.left ?? 0) - step });
      else if (e.key === "ArrowRight") active.set({ left: (active.left ?? 0) + step });
      else if (e.key === "ArrowUp") active.set({ top: (active.top ?? 0) - step });
      else if (e.key === "ArrowDown") active.set({ top: (active.top ?? 0) + step });
      active.setCoords();
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

  // Grid overlay via after:render
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const draw = () => {
      if (!showGrid) return;
      const ctx = canvas.getContext();
      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      const step = 40;
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      ctx.strokeStyle = "rgba(15,23,42,0.06)";
      ctx.lineWidth = 1 / canvas.getZoom();
      const w = widthRef.current, h = heightRef.current;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.restore();
    };
    canvas.on("after:render", draw);
    canvas.requestRenderAll();
    return () => { canvas.off("after:render", draw); };
  }, [showGrid]);

  const fitToContainer = useCallback(() => {
    const canvas = fabricRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const padding = 48;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scale = Math.min(availW / widthRef.current, availH / heightRef.current, 1);
    const w = Math.round(widthRef.current * scale);
    const h = Math.round(heightRef.current * scale);
    canvas.setDimensions({ width: w, height: h });
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    setZoom(scale);
    canvas.requestRenderAll();
  }, []);

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

  // --- Creation helpers ---
  const attachAutofit = (tb: fabric.Textbox) => {
    const run = () => {
      const withExtras = tb as unknown as { maxHeight?: number; baseFontSize?: number };
      const maxH = withExtras.maxHeight;
      const base = withExtras.baseFontSize ?? tb.fontSize;
      if (!maxH) return;
      let size = base;
      tb.set({ fontSize: size });
      tb.initDimensions();
      while (tb.height > maxH && size > 8) {
        size -= 1;
        tb.set({ fontSize: size });
        tb.initDimensions();
      }
      fabricRef.current?.requestRenderAll();
    };
    tb.on("changed", run);
  };

  const makeTextbox = (text: string, opts: Partial<fabric.TextboxProps>, preset: "heading" | "body") => {
    const tb = new fabric.Textbox(text, {
      fontFamily: preset === "heading" ? "Oswald" : "Inter",
      fontSize: preset === "heading" ? 144 : 64,
      fontWeight: preset === "heading" ? "bold" : "normal",
      fill: "#0f172a",
      textAlign: preset === "heading" ? "center" : "left",
      ...opts,
    });
    (tb as unknown as { autofit?: boolean }).autofit = true;
    (tb as unknown as { baseFontSize?: number }).baseFontSize = tb.fontSize;
    tb.initDimensions();
    (tb as unknown as { maxHeight?: number }).maxHeight = tb.height * 1.6;
    attachAutofit(tb);
    return tb;
  };

  const createAt = (kind: string, worldX: number, worldY: number) => {
    const c = fabricRef.current; if (!c) return;
    const cx = worldX, cy = worldY;
    let obj: fabric.FabricObject | null = null;
    switch (kind) {
      case "heading":
        obj = makeTextbox("Heading", { left: cx - 400, top: cy - 80, width: 800 }, "heading");
        break;
      case "body":
        obj = makeTextbox("Your text", { left: cx - 250, top: cy, width: 500 }, "body");
        break;
      case "rect":
        obj = new fabric.Rect({ left: cx - 150, top: cy - 100, width: 300, height: 200, fill: "#2563eb", rx: 12, ry: 12 });
        break;
      case "circle":
        obj = new fabric.Circle({ left: cx - 100, top: cy - 100, radius: 100, fill: "#16a34a" });
        break;
      case "triangle":
        obj = new fabric.Triangle({ left: cx - 100, top: cy - 100, width: 200, height: 200, fill: "#f97316" });
        break;
      case "star":
        obj = makeStar(cx, cy, 100, 50, 5, "#eab308");
        break;
      case "hex":
        obj = makePolygon(cx, cy, 110, 6, "#8b5cf6");
        break;
      case "line":
        obj = new fabric.Rect({ left: cx - 200, top: cy, width: 400, height: 4, fill: "#0f172a" });
        break;
    }
    if (!obj) return;
    c.add(obj); c.setActiveObject(obj); c.requestRenderAll();
  };

  const addText = () => createAt("body", widthRef.current / 2, heightRef.current / 2);
  const addHeading = () => createAt("heading", widthRef.current / 2, heightRef.current / 2);
  const addRect = () => createAt("rect", widthRef.current / 2, heightRef.current / 2);
  const addCircle = () => createAt("circle", widthRef.current / 2, heightRef.current / 2);
  const addLine = () => createAt("line", widthRef.current / 2, heightRef.current / 2);
  const addTriangle = () => createAt("triangle", widthRef.current / 2, heightRef.current / 2);
  const addStar = () => createAt("star", widthRef.current / 2, heightRef.current / 2);
  const addHex = () => createAt("hex", widthRef.current / 2, heightRef.current / 2);

  const uploadFile = async (file: File) => {
    const c = fabricRef.current; if (!c) return;
    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    const form = new FormData();
    form.append("file", file);
    let remoteUrl: string | null = null;
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (res.ok) {
        remoteUrl = (await res.json()).url as string;
      } else if (res.status === 413) {
        await dialog.alert({ title: "File too large", message: "Max 10 MB per upload.", tone: "error" });
        return;
      }
    } catch { /* fall back to data URL */ }

    if (isSvg) {
      const text = remoteUrl ? await (await fetch(remoteUrl)).text() : await file.text();
      const parsed = await fabric.loadSVGFromString(text);
      const objects = (parsed.objects ?? []).filter(Boolean) as fabric.FabricObject[];
      if (objects.length === 0) return;
      const group = fabric.util.groupSVGElements(objects, parsed.options ?? {});
      const gw = group.width ?? 1, gh = group.height ?? 1;
      const s = Math.min((widthRef.current * 0.7) / gw, (heightRef.current * 0.7) / gh, 1);
      group.set({ left: widthRef.current / 2, top: heightRef.current / 2, originX: "center", originY: "center", scaleX: s, scaleY: s });
      c.add(group); c.setActiveObject(group); c.requestRenderAll();
      return;
    }

    const src = remoteUrl ?? await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await fabric.FabricImage.fromURL(src, { crossOrigin: remoteUrl ? "anonymous" : undefined });
    const scale = Math.min(
      (widthRef.current * 0.6) / (img.width ?? 1),
      (heightRef.current * 0.6) / (img.height ?? 1),
    );
    img.set({ left: widthRef.current / 2, top: heightRef.current / 2, originX: "center", originY: "center", scaleX: scale, scaleY: scale });
    c.add(img); c.setActiveObject(img); c.requestRenderAll();
  };

  // --- Arrange ---
  const bringForward = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.bringObjectForward(a); c.requestRenderAll(); pushHistory(); } };
  const sendBackward = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.sendObjectBackwards(a); c.requestRenderAll(); pushHistory(); } };
  const bringToFront = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.bringObjectToFront(a); c.requestRenderAll(); pushHistory(); } };
  const sendToBack = () => { const c = fabricRef.current; const a = c?.getActiveObject(); if (c && a) { c.sendObjectToBack(a); c.requestRenderAll(); pushHistory(); } };
  const deleteSelected = () => {
    const c = fabricRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;
    if (active instanceof fabric.ActiveSelection) {
      active.getObjects().forEach((o) => c.remove(o));
    } else {
      c.remove(active);
    }
    c.discardActiveObject(); c.requestRenderAll();
  };
  const duplicate = async () => {
    const c = fabricRef.current; const a = c?.getActiveObject();
    if (!c || !a) return;
    const clone = await a.clone(SERIALIZE_PROPS);
    // New identity for the clone
    (clone as unknown as { layerId?: string }).layerId = undefined;
    clone.set({ left: (a.left ?? 0) + 20, top: (a.top ?? 0) + 20 });
    c.add(clone); c.setActiveObject(clone); c.requestRenderAll();
  };
  const selectAll = () => {
    const c = fabricRef.current; if (!c) return;
    const objs = c.getObjects().filter((o) => o.selectable !== false);
    if (objs.length === 0) return;
    const sel = new fabric.ActiveSelection(objs, { canvas: c });
    c.setActiveObject(sel);
    c.requestRenderAll();
  };
  const groupSelection = () => {
    const c = fabricRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!(active instanceof fabric.ActiveSelection)) return;
    const g = new fabric.Group(active.removeAll() as fabric.FabricObject[]);
    c.add(g); c.setActiveObject(g); c.requestRenderAll(); pushHistory();
  };
  const ungroupSelection = () => {
    const c = fabricRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!(active instanceof fabric.Group)) return;
    const items = active.removeAll() as fabric.FabricObject[];
    c.remove(active);
    items.forEach((o) => c.add(o));
    const sel = new fabric.ActiveSelection(items, { canvas: c });
    c.setActiveObject(sel); c.requestRenderAll(); pushHistory();
  };

  // --- Align to canvas ---
  const alignH = (how: "left" | "center" | "right") => {
    const c = fabricRef.current; const a = c?.getActiveObject();
    if (!c || !a) return;
    const br = a.getBoundingRect();
    const w = widthRef.current;
    const dx = how === "left" ? -br.left
      : how === "right" ? (w - (br.left + br.width))
      : (w / 2 - (br.left + br.width / 2));
    a.set({ left: (a.left ?? 0) + dx });
    a.setCoords(); c.requestRenderAll(); pushHistory();
  };
  const alignV = (how: "top" | "middle" | "bottom") => {
    const c = fabricRef.current; const a = c?.getActiveObject();
    if (!c || !a) return;
    const br = a.getBoundingRect();
    const h = heightRef.current;
    const dy = how === "top" ? -br.top
      : how === "bottom" ? (h - (br.top + br.height))
      : (h / 2 - (br.top + br.height / 2));
    a.set({ top: (a.top ?? 0) + dy });
    a.setCoords(); c.requestRenderAll(); pushHistory();
  };

  // --- Persistence ---
  const save = useCallback(async () => {
    const c = fabricRef.current; if (!c) return;
    setSaveState("saving");
    const url = mode === "template" ? `/api/templates/${project.id}` : `/api/projects/${project.id}`;
    const body: Record<string, unknown> = {
      scene: c.toObject(SERIALIZE_PROPS),
      name: projectName,
      width: widthRef.current,
      height: heightRef.current,
    };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaveState(res.ok ? "saved" : "error");
    if (res.ok) {
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      // Fire-and-forget — server decides whether to actually snapshot.
      if (mode === "project") {
        fetch(`/api/projects/${project.id}/revisions`, { method: "POST" }).catch(() => {});
      }
    }
  }, [project.id, projectName, mode]);

  const openShareDialog = async () => {
    if (mode !== "project") {
      await dialog.alert({ title: "Share is only for posters", tone: "info" });
      return;
    }
    const res = await fetch(`/api/projects/${project.id}/share`, { method: "POST" });
    if (!res.ok) {
      await dialog.alert({ title: "Could not create share link", tone: "error" });
      return;
    }
    const { token } = await res.json();
    const url = `${location.origin}/p/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    await dialog.alert({
      title: "Public link ready",
      message: `${url}\n\nCopied to clipboard. Anyone with this link can view (not edit) the poster.`,
      tone: "success",
    });
  };

  const saveAsTemplate = async () => {
    const c = fabricRef.current; if (!c) return;
    const name = await dialog.prompt({
      title: "Save as template",
      message: "Name this template so others can find it in the library.",
      placeholder: "e.g. Quarterly meetup",
      defaultValue: projectName,
      confirmLabel: "Save template",
    });
    if (!name) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name, width: widthRef.current, height: heightRef.current,
        scene: c.toObject(SERIALIZE_PROPS),
      }),
    });
    if (!res.ok) { await dialog.alert({ title: "Failed to save template", tone: "error" }); return; }
    await dialog.alert({ title: "Template saved", tone: "success" });
    router.refresh();
  };

  // --- Canvas settings ---
  const applyCanvasResize = () => {
    const c = fabricRef.current; if (!c) return;
    if (canvasW < 50 || canvasH < 50 || canvasW > 10000 || canvasH > 10000) return;
    widthRef.current = canvasW; heightRef.current = canvasH;
    fitToContainer();
    pushHistory();
  };
  useEffect(() => {
    const c = fabricRef.current; if (!c) return;
    c.backgroundColor = canvasBg;
    c.requestRenderAll();
  }, [canvasBg]);

  // --- Exports ---
  const withFullSize = <T,>(fn: () => T): T => {
    const c = fabricRef.current!;
    const prevVpt = [...(c.viewportTransform ?? [1, 0, 0, 1, 0, 0])] as fabric.TMat2D;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setDimensions({ width: widthRef.current, height: heightRef.current });
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
      body: JSON.stringify({ svg, width: widthRef.current, height: heightRef.current, filename: projectName }),
    });
    if (!res.ok) { await dialog.alert({ title: "PDF export failed", tone: "error" }); return; }
    downloadBlob(await res.blob(), `${projectName}.pdf`);
  };

  const slots = useMemo(() => {
    const canvas = fabricRef.current;
    if (!canvas) return [] as string[];
    const out = new Set<string>();
    canvas.getObjects().forEach((o) => {
      const s = (o as unknown as { slot?: string }).slot;
      if (typeof s === "string" && s.length > 0) out.add(s);
    });
    return [...out].sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerTick, selected]);

  const hasSelection = selectedCount > 0;
  const isMulti = selectedCount > 1;

  const saveDot =
    saveState === "saving" ? "bg-orange-400 animate-pulse"
    : saveState === "saved" ? "bg-emerald-500"
    : saveState === "error" ? "bg-red-500"
    : "bg-slate-300";
  const saveLabel =
    saveState === "saving" ? "Saving…"
    : saveState === "saved" ? "Saved"
    : saveState === "error" ? "Save failed"
    : "Autosaved";

  const selectedLayerId = selected ? (selected as unknown as { layerId?: string }).layerId ?? null : null;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top toolbar */}
      <div className="h-14 shrink-0 flex items-center gap-3 border-b border-slate-200 px-4 bg-white">
        <Input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onBlur={() => scheduleAutosave()}
          className="h-9 w-64 border-transparent bg-transparent shadow-none font-semibold text-slate-900 focus-visible:border-slate-200 focus-visible:bg-white"
          placeholder="Untitled poster"
        />
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${saveDot}`} />
          {saveLabel}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
            <Button variant="ghost" size="iconSm" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="iconSm" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
            <Button variant="ghost" size="iconSm" onClick={() => zoomBy(0.9)} title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-slate-600 w-11 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="iconSm" onClick={() => zoomBy(1.1)} title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="iconSm" onClick={fitToContainer} title="Fit">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="iconSm" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
            <Keyboard className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          {mode === "project" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push(`/editor/${project.id}/history`)} title="Version history">
                <History className="h-4 w-4" /> History
              </Button>
              <Button variant="ghost" size="sm" onClick={openShareDialog} title="Create share link">
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button variant="secondary" size="sm" onClick={saveAsTemplate}>
                <Save className="h-4 w-4" /> Save as template
              </Button>
            </>
          )}
          <ExportMenu onSvg={exportSVG} onPng={() => exportRaster("png")} onJpg={() => exportRaster("jpg")} onPdf={exportPDF} />
          <Button variant="ghost" size="iconSm" onClick={() => router.push("/dashboard")} title="Close editor">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left rail — Canva-style icon tabs */}
        <nav className="w-14 shrink-0 border-r border-slate-200 bg-white flex flex-col items-center py-3 gap-1">
          <RailTab active={tab === "elements"} onClick={() => setTab("elements")} Icon={Shapes} label="Elements" />
          <RailTab active={tab === "uploads"} onClick={() => setTab("uploads")} Icon={ImagePlus} label="Uploads" />
          <RailTab active={tab === "layers"} onClick={() => setTab("layers")} Icon={LayersIcon} label="Layers" />
          <RailTab active={tab === "canvas"} onClick={() => setTab("canvas")} Icon={Sliders} label="Canvas" />
        </nav>

        {/* Left panel (tab content) */}
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          {tab === "elements" && (
            <div className="p-3 space-y-4 overflow-y-auto">
              <p className="text-[10px] text-slate-400 -mb-1">Click to add at center · drag to a precise spot</p>
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Text</h3>
                <div className="grid grid-cols-2 gap-2">
                  <DraggableTile kind="heading" Icon={TypeIcon} label="Heading" onClick={addHeading} />
                  <DraggableTile kind="body" Icon={TypeIcon} label="Body" onClick={addText} />
                </div>
              </section>
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Shapes</h3>
                <div className="grid grid-cols-3 gap-2">
                  <DraggableTile kind="rect" Icon={Square} label="Rect" onClick={addRect} />
                  <DraggableTile kind="circle" Icon={Circle} label="Circle" onClick={addCircle} />
                  <DraggableTile kind="triangle" Icon={Triangle} label="Triangle" onClick={addTriangle} />
                  <DraggableTile kind="star" Icon={Star} label="Star" onClick={addStar} />
                  <DraggableTile kind="hex" Icon={Hexagon} label="Hex" onClick={addHex} />
                  <DraggableTile kind="line" Icon={Minus} label="Line" onClick={addLine} />
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Variability points</h3>
                {slots.length > 0 ? (
                  <ul className="space-y-1">
                    {slots.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => {
                            const c = fabricRef.current; if (!c) return;
                            const obj = c.getObjects().find((o) => (o as unknown as { slot?: string }).slot === s);
                            if (obj) { c.setActiveObject(obj); c.requestRenderAll(); setSelected(obj); }
                          }}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 bg-orange-50 ring-1 ring-orange-200 text-orange-900 font-mono text-[11px] hover:bg-orange-100 text-left"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-orange-500" /> {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Select a text element and give it a <em>slot name</em> below to make it form-fillable.
                  </p>
                )}
              </section>
            </div>
          )}

          {tab === "uploads" && (
            <div className="p-3 space-y-3 overflow-y-auto">
              <label className="block">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,.svg"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = ""; }}
                />
                <span className="flex items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 cursor-pointer text-sm text-slate-600 transition">
                  <ImagePlus className="h-4 w-4" /> Upload image or SVG
                </span>
              </label>
              <p className="text-[11px] text-slate-400 leading-snug">
                Max 10 MB. PNG · JPG · WebP · SVG · GIF. Stored on MinIO and referenced by URL — keeps your poster files light.
              </p>
            </div>
          )}

          {tab === "layers" && (
            <LayersPanel
              canvas={fabricRef.current}
              tick={layerTick}
              selectedId={selectedLayerId}
              onChange={bumpLayerTick}
            />
          )}

          {tab === "canvas" && (
            <div className="p-3 space-y-4 overflow-y-auto">
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Size</h3>
                <div className="flex items-center gap-2">
                  <Input type="number" value={canvasW} min={50} max={10000}
                    onChange={(e) => setCanvasW(Number(e.target.value))} className="w-24" />
                  <span className="text-slate-400 text-xs">×</span>
                  <Input type="number" value={canvasH} min={50} max={10000}
                    onChange={(e) => setCanvasH(Number(e.target.value))} className="w-24" />
                </div>
                <Button variant="secondary" size="sm" className="w-full mt-2" onClick={applyCanvasResize}>
                  Apply size
                </Button>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Background</h3>
                <div className="flex gap-2">
                  <input type="color" value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)}
                    className="h-9 w-12 rounded-md border border-slate-200 cursor-pointer" />
                  <Input value={canvasBg} onChange={(e) => setCanvasBg(e.target.value)} className="flex-1 font-mono text-xs uppercase" />
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">View</h3>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                  <Grid3x3 className="h-4 w-4" /> Show grid
                </label>
              </section>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <div
          ref={containerRef}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes(DRAG_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            const kind = e.dataTransfer.getData(DRAG_MIME);
            if (!kind) return;
            e.preventDefault();
            const c = fabricRef.current; if (!c) return;
            const canvasEl = canvasElRef.current; if (!canvasEl) return;
            const rect = canvasEl.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const vpt = c.viewportTransform ?? [1, 0, 0, 1, 0, 0];
            const worldX = (sx - vpt[4]) / vpt[0];
            const worldY = (sy - vpt[5]) / vpt[3];
            createAt(kind, worldX, worldY);
          }}
          className="flex-1 min-w-0 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[length:18px_18px] relative"
        >
          <div className="shadow-2xl rounded-sm bg-white ring-1 ring-slate-200/60">
            <canvas ref={canvasElRef} />
          </div>

          {/* Contextual action bar */}
          {hasSelection && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-slate-200 bg-white shadow-lg px-2 py-1.5">
              <Button variant="ghost" size="iconSm" onClick={() => alignH("left")} title="Align left">
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="iconSm" onClick={() => alignH("center")} title="Align center H">
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="iconSm" onClick={() => alignH("right")} title="Align right">
                <AlignRight className="h-4 w-4" />
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <Button variant="ghost" size="iconSm" onClick={() => alignV("top")} title="Align top">
                <AlignStartHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="iconSm" onClick={() => alignV("middle")} title="Align middle V">
                <AlignVerticalJustifyCenter className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="iconSm" onClick={() => alignV("bottom")} title="Align bottom">
                <AlignEndHorizontal className="h-4 w-4" />
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              <Button variant="ghost" size="iconSm" onClick={bringForward} title="Bring forward (⌘])">
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="iconSm" onClick={sendBackward} title="Send backward (⌘[)">
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div className="h-5 w-px bg-slate-200" />
              {isMulti ? (
                <Button variant="ghost" size="iconSm" onClick={groupSelection} title="Group (⌘G)">
                  <GroupIcon className="h-4 w-4" />
                </Button>
              ) : selected instanceof fabric.Group ? (
                <Button variant="ghost" size="iconSm" onClick={ungroupSelection} title="Ungroup (⌘⇧G)">
                  <Ungroup className="h-4 w-4" />
                </Button>
              ) : null}
              <Button variant="ghost" size="iconSm" onClick={duplicate} title="Duplicate (⌘D)">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="iconSm" onClick={deleteSelected} title="Delete" className="text-red-600">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {mode === "template" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-50 ring-1 ring-orange-200 text-orange-800 text-xs font-medium px-3 py-1 shadow-sm">
              Template mode — changes apply to <em>future</em> posters only
            </div>
          )}

          {slots.length === 0 && mode === "template" && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 text-[11px] text-slate-500 bg-white/80 px-3 py-1.5 rounded-full ring-1 ring-slate-200 shadow-sm">
              Add variability points to text so users can fill them in.
            </div>
          )}
        </div>

        {/* Right panel — Properties */}
        <aside className="w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          {selected ? (
            <PropertiesPanel
              object={selected}
              canvas={fabricRef.current}
              onAfterChange={() => {
                setSelected(fabricRef.current?.getActiveObject() ?? null);
                pushHistory();
              }}
            />
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">
              Select an element to edit its properties.
            </div>
          )}
        </aside>
      </div>

      <ShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}

function makeStar(cx: number, cy: number, outer: number, inner: number, points: number, fill: string): fabric.Polygon {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  const p = new fabric.Polygon(pts, { fill, originX: "center", originY: "center" });
  p.set({ left: cx, top: cy });
  return p;
}

function makePolygon(cx: number, cy: number, radius: number, sides: number, fill: string): fabric.Polygon {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
    pts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  const p = new fabric.Polygon(pts, { fill, originX: "center", originY: "center" });
  p.set({ left: cx, top: cy });
  return p;
}

function RailTab({
  active, onClick, Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Shapes;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center gap-0.5 w-12 py-2 rounded-lg text-[10px] font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
      title={label}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function DraggableTile({
  kind, Icon, label, onClick,
}: { kind: string; Icon: typeof Square; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, kind);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 p-2 transition cursor-grab active:cursor-grabbing"
      title={`Click or drag to add ${label}`}
    >
      <Icon className="h-5 w-5 text-slate-700" />
      <span className="text-[10px] text-slate-600">{label}</span>
    </button>
  );
}

function ExportMenu({
  onSvg, onPng, onJpg, onPdf,
}: {
  onSvg: () => void;
  onPng: () => void;
  onJpg: () => void;
  onPdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    return () => window.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <Button variant="primary" size="sm" onClick={() => setOpen((v) => !v)}>
        <FileDown className="h-4 w-4" /> Download
      </Button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-lg p-1 z-20">
          <DropItem Icon={FileText} label="PDF" hint="Fonts embedded" onClick={() => { setOpen(false); onPdf(); }} />
          <DropItem Icon={FileImage} label="PNG" hint="2× raster" onClick={() => { setOpen(false); onPng(); }} />
          <DropItem Icon={FileImage} label="JPG" hint="2× raster" onClick={() => { setOpen(false); onJpg(); }} />
          <DropItem Icon={FileText} label="SVG" hint="Vector" onClick={() => { setOpen(false); onSvg(); }} />
        </div>
      )}
    </div>
  );
}

function DropItem({ Icon, label, hint, onClick }: { Icon: typeof FileText; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full px-2.5 py-2 rounded-md hover:bg-slate-100 text-left"
    >
      <Icon className="h-4 w-4 text-slate-500" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-[10px] text-slate-400">{hint}</div>
      </div>
    </button>
  );
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
    update({
      shadow: new fabric.Shadow({
        color: patch.color ?? current.color,
        blur: patch.blur ?? current.blur,
        offsetX: patch.offsetX ?? current.offsetX,
        offsetY: patch.offsetY ?? current.offsetY,
      }),
    });
  };

  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Position & size</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="X" value={Math.round(object.left ?? 0)} onChange={(v) => update({ left: v })} />
          <NumField label="Y" value={Math.round(object.top ?? 0)} onChange={(v) => update({ top: v })} />
          <NumField label="Rotate" value={Math.round(object.angle ?? 0)} onChange={(v) => update({ angle: v })} />
          <NumField label="Opacity" value={Math.round((object.opacity ?? 1) * 100)} onChange={(v) => update({ opacity: Math.max(0, Math.min(1, v / 100)) })} />
          {!isText && (
            <>
              <NumField label="Width" value={Math.round((object.width ?? 0) * (object.scaleX ?? 1))}
                onChange={(v) => update({ scaleX: v / Math.max(1, object.width ?? 1) })} />
              <NumField label="Height" value={Math.round((object.height ?? 0) * (object.scaleY ?? 1))}
                onChange={(v) => update({ scaleY: v / Math.max(1, object.height ?? 1) })} />
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Appearance</h3>
        <div className="space-y-2.5">
          <FillControl object={object} onChange={update} />
          {!isText && (
            <>
              <ColorField label="Stroke" value={typeof object.stroke === "string" ? object.stroke : "#000000"}
                onChange={(v) => update({ stroke: v })} />
              <NumField label="Stroke width" value={object.strokeWidth ?? 0}
                onChange={(v) => update({ strokeWidth: Math.max(0, v) })} />
            </>
          )}
          {object instanceof fabric.Rect && (
            <NumField
              label="Corner radius"
              value={Math.round((object.rx as number | undefined) ?? 0)}
              onChange={(v) => update({ rx: Math.max(0, v), ry: Math.max(0, v) })}
            />
          )}
        </div>
      </div>

      {object instanceof fabric.FabricImage && (
        <ImageFiltersSection image={object} canvas={canvas} onAfterChange={onAfterChange} />
      )}

      <div className="rounded-lg border border-slate-200 p-3 space-y-2.5">
        <label className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Drop shadow</span>
          <input type="checkbox" checked={shadowEnabled} onChange={(e) => setShadow({ enabled: e.target.checked })} />
        </label>
        {shadowEnabled && (
          <div className="space-y-2.5">
            <ColorField label="Color" value={hexFromShadowColor(shadow?.color)}
              onChange={(v) => setShadow({ color: hexToRgba(v, alphaFromShadowColor(shadow?.color)) })} />
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Blur" value={Math.round(shadow?.blur ?? 0)} onChange={(v) => setShadow({ blur: v })} />
              <NumField label="Offset X" value={Math.round(shadow?.offsetX ?? 0)} onChange={(v) => setShadow({ offsetX: v })} />
              <NumField label="Offset Y" value={Math.round(shadow?.offsetY ?? 0)} onChange={(v) => setShadow({ offsetY: v })} />
            </div>
          </div>
        )}
      </div>

      {isText && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Typography</h3>
          <div className="space-y-2.5">
            <div>
              <Label>Text</Label>
              <Textarea value={(object as fabric.IText).text ?? ""}
                onChange={(e) => update({ text: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Size" value={(object as fabric.IText).fontSize ?? 16} onChange={(v) => update({ fontSize: v })} />
              <NumField label="Box W" value={Math.round((object as fabric.Textbox).width ?? 0)}
                onChange={(v) => update({ width: Math.max(40, v) })} />
            </div>
            <div>
              <Label>Font</Label>
              <select value={(object as fabric.IText).fontFamily ?? "Inter"}
                onChange={(e) => update({ fontFamily: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm">
                {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label>Align</Label>
              <div className="grid grid-cols-3 gap-1">
                {(["left", "center", "right"] as const).map((a) => {
                  const Ico = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                  return (
                    <button key={a} type="button" onClick={() => update({ textAlign: a })}
                      className={`h-9 rounded-lg border flex items-center justify-center transition ${
                        textAlign === a ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}>
                      <Ico className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button type="button"
                onClick={() => update({ fontWeight: (object as fabric.IText).fontWeight === "bold" ? "normal" : "bold" })}
                className={`h-9 rounded-lg border flex items-center justify-center transition ${
                  (object as fabric.IText).fontWeight === "bold" ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}>
                <Bold className="h-4 w-4" />
              </button>
              <button type="button"
                onClick={() => update({ fontStyle: (object as fabric.IText).fontStyle === "italic" ? "normal" : "italic" })}
                className={`h-9 rounded-lg border flex items-center justify-center transition ${
                  (object as fabric.IText).fontStyle === "italic" ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}>
                <Italic className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Line height" value={Number(((object as fabric.IText).lineHeight ?? 1).toFixed(2))}
                onChange={(v) => update({ lineHeight: Math.max(0.5, v) })} />
              <NumField label="Letter spacing" value={(object as fabric.IText).charSpacing ?? 0}
                onChange={(v) => update({ charSpacing: v })} />
            </div>

            <div className={`rounded-lg p-3 space-y-2 mt-2 ${currentSlot ? "bg-orange-50 ring-1 ring-orange-200" : "bg-slate-50 ring-1 ring-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${currentSlot ? "text-orange-800" : "text-slate-700"}`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {currentSlot ? "Variability point" : "Make this a variability point"}
                </span>
                {currentSlot && (
                  <button type="button" onClick={() => update({ slot: "" })}
                    className="text-[10px] text-orange-700 hover:underline">
                    Unmark
                  </button>
                )}
              </div>
              <p className="text-[10px] leading-snug text-slate-500">
                Users will fill this text from a form. Try <code className="font-mono">title</code>, <code className="font-mono">speaker</code>, <code className="font-mono">date</code>.
              </p>
              <input value={currentSlot}
                onChange={(e) => update({ slot: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                placeholder="slot name"
                className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-mono" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = normalizeHex(value);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer" />
        <Input value={hex} onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-xs uppercase" />
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

type GradientKind = "none" | "linear" | "radial";

function isFabricGradient(fill: unknown): fill is fabric.Gradient<"linear" | "radial"> {
  return !!fill && typeof fill === "object" && "colorStops" in (fill as object);
}

function makeGradient(kind: "linear" | "radial", color1: string, color2: string, angleDeg: number, w: number, h: number) {
  if (kind === "linear") {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const size = Math.max(w, h);
    const cx = w / 2, cy = h / 2;
    return new fabric.Gradient({
      type: "linear",
      coords: {
        x1: cx - Math.cos(rad) * size / 2,
        y1: cy - Math.sin(rad) * size / 2,
        x2: cx + Math.cos(rad) * size / 2,
        y2: cy + Math.sin(rad) * size / 2,
      },
      colorStops: [
        { offset: 0, color: color1 },
        { offset: 1, color: color2 },
      ],
    });
  }
  const cx = w / 2, cy = h / 2;
  return new fabric.Gradient({
    type: "radial",
    coords: { x1: cx, y1: cy, x2: cx, y2: cy, r1: 0, r2: Math.max(w, h) / 2 },
    colorStops: [
      { offset: 0, color: color1 },
      { offset: 1, color: color2 },
    ],
  });
}

function FillControl({
  object,
  onChange,
}: {
  object: fabric.FabricObject;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const fill = object.fill;
  const currentKind: GradientKind = isFabricGradient(fill) ? (fill.type === "radial" ? "radial" : "linear") : "none";

  const firstStop = isFabricGradient(fill) ? (fill.colorStops?.[0]?.color ?? "#2563eb") : (typeof fill === "string" ? fill : "#2563eb");
  const lastStop = isFabricGradient(fill) ? (fill.colorStops?.[fill.colorStops.length - 1]?.color ?? "#a855f7") : "#a855f7";

  const [color1, setColor1] = useState<string>(firstStop as string);
  const [color2, setColor2] = useState<string>(lastStop as string);
  const [angle, setAngle] = useState<number>(135);

  const w = (object.width ?? 100) * (object.scaleX ?? 1);
  const h = (object.height ?? 100) * (object.scaleY ?? 1);

  const setKind = (kind: GradientKind) => {
    if (kind === "none") {
      onChange({ fill: color1 });
      return;
    }
    onChange({ fill: makeGradient(kind, color1, color2, angle, w, h) });
  };

  const updateGradient = (next: { color1?: string; color2?: string; angle?: number; kind?: "linear" | "radial" }) => {
    const c1 = next.color1 ?? color1;
    const c2 = next.color2 ?? color2;
    const a = next.angle ?? angle;
    const k = next.kind ?? (currentKind === "none" ? "linear" : currentKind);
    if (next.color1 !== undefined) setColor1(c1);
    if (next.color2 !== undefined) setColor2(c2);
    if (next.angle !== undefined) setAngle(a);
    onChange({ fill: makeGradient(k, c1, c2, a, w, h) });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["none", "linear", "radial"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex-1 h-8 rounded-lg border text-xs capitalize transition ${
              currentKind === k ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            {k === "none" ? "Solid" : k}
          </button>
        ))}
      </div>

      {currentKind === "none" ? (
        <ColorField label="Fill" value={typeof fill === "string" ? fill : "#000000"} onChange={(v) => { setColor1(v); onChange({ fill: v }); }} />
      ) : (
        <>
          <ColorField label="From" value={color1} onChange={(v) => updateGradient({ color1: v })} />
          <ColorField label="To" value={color2} onChange={(v) => updateGradient({ color2: v })} />
          {currentKind === "linear" && (
            <div>
              <div className="flex items-center justify-between">
                <Label>Angle</Label>
                <span className="text-xs text-slate-400 tabular-nums">{Math.round(angle)}°</span>
              </div>
              <input
                type="range" min={0} max={360} step={1} value={angle}
                onChange={(e) => updateGradient({ angle: Number(e.target.value) })}
                className="w-full accent-slate-900"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ImageFiltersSection({
  image, canvas, onAfterChange,
}: {
  image: fabric.FabricImage;
  canvas: fabric.Canvas | null;
  onAfterChange: () => void;
}) {
  const withF = image as unknown as { _goyFilters?: { brightness: number; contrast: number; blur: number } };
  const [brightness, setBrightness] = useState(withF._goyFilters?.brightness ?? 0);
  const [contrast, setContrast] = useState(withF._goyFilters?.contrast ?? 0);
  const [blur, setBlur] = useState(withF._goyFilters?.blur ?? 0);

  const apply = (next: { brightness: number; contrast: number; blur: number }) => {
    const filters: unknown[] = [];
    if (next.brightness !== 0) filters.push(new fabric.filters.Brightness({ brightness: next.brightness }));
    if (next.contrast !== 0) filters.push(new fabric.filters.Contrast({ contrast: next.contrast }));
    if (next.blur !== 0) filters.push(new fabric.filters.Blur({ blur: next.blur }));
    image.filters = filters as fabric.FabricImage["filters"];
    image.applyFilters();
    withF._goyFilters = next;
    canvas?.requestRenderAll();
    onAfterChange();
  };

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Image filters</h3>
      <div className="space-y-3">
        <RangeField label="Brightness" min={-1} max={1} step={0.05} value={brightness}
          onChange={(v) => { setBrightness(v); apply({ brightness: v, contrast, blur }); }} />
        <RangeField label="Contrast" min={-1} max={1} step={0.05} value={contrast}
          onChange={(v) => { setContrast(v); apply({ brightness, contrast: v, blur }); }} />
        <RangeField label="Blur" min={0} max={1} step={0.01} value={blur}
          onChange={(v) => { setBlur(v); apply({ brightness, contrast, blur: v }); }} />
        <button type="button"
          onClick={() => { setBrightness(0); setContrast(0); setBlur(0); apply({ brightness: 0, contrast: 0, blur: 0 }); }}
          className="text-xs text-slate-500 hover:text-slate-800 hover:underline">
          Reset filters
        </button>
      </div>
    </div>
  );
}

function RangeField({
  label, value, onChange, min, max, step,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-slate-400 tabular-nums">{Number(value).toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-900" />
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
