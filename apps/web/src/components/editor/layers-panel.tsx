"use client";

import { useEffect, useState } from "react";
import * as fabric from "fabric";
import { Eye, EyeOff, Lock, Unlock, Type, Square, Circle, Image as ImageIcon, Shapes } from "lucide-react";

type Entry = {
  id: string;
  type: string;
  label: string;
  visible: boolean;
  locked: boolean;
  selected: boolean;
};

export const LAYER_SERIALIZE_PROPS = ["slot", "locked", "layerId"];

function identityOf(obj: fabric.FabricObject): string {
  const withId = obj as unknown as { layerId?: string };
  if (!withId.layerId) {
    withId.layerId = `ly_${Math.random().toString(36).slice(2, 10)}`;
  }
  return withId.layerId!;
}

function summarize(obj: fabric.FabricObject): { label: string; type: string; Icon: typeof Type } {
  if (obj instanceof fabric.IText || obj instanceof fabric.Textbox) {
    const t = ((obj as fabric.IText).text ?? "").slice(0, 24);
    return { label: t || "Text", type: "Text", Icon: Type };
  }
  if (obj instanceof fabric.Rect) return { label: "Rectangle", type: "Rect", Icon: Square };
  if (obj instanceof fabric.Circle) return { label: "Circle", type: "Circle", Icon: Circle };
  if (obj instanceof fabric.FabricImage) return { label: "Image", type: "Image", Icon: ImageIcon };
  if (obj instanceof fabric.Group) return { label: "Group", type: "Group", Icon: Shapes };
  return { label: obj.type ?? "Object", type: obj.type ?? "Object", Icon: Shapes };
}

export function LayersPanel({
  canvas,
  tick,
  selectedId,
  onChange,
}: {
  canvas: fabric.Canvas | null;
  tick: number;
  selectedId: string | null;
  onChange: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (!canvas) { setEntries([]); return; }
    const list = canvas.getObjects().map((o): Entry => {
      const id = identityOf(o);
      const { label, type } = summarize(o);
      return {
        id,
        type,
        label,
        visible: o.visible !== false,
        locked: !!(o as unknown as { locked?: boolean }).locked,
        selected: selectedId === id,
      };
    });
    // Top of z-order first in visual list
    list.reverse();
    setEntries(list);
  }, [canvas, tick, selectedId]);

  if (!canvas) return null;

  const findByLayerId = (id: string) =>
    canvas.getObjects().find((o) => (o as unknown as { layerId?: string }).layerId === id) ?? null;

  const toggleVisible = (id: string) => {
    const obj = findByLayerId(id);
    if (!obj) return;
    obj.set({ visible: !(obj.visible !== false) });
    canvas.requestRenderAll();
    onChange();
  };

  const toggleLock = (id: string) => {
    const obj = findByLayerId(id);
    if (!obj) return;
    const locked = !(obj as unknown as { locked?: boolean }).locked;
    obj.set({
      selectable: !locked,
      evented: !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockRotation: locked,
      lockScalingX: locked,
      lockScalingY: locked,
    });
    (obj as unknown as { locked?: boolean }).locked = locked;
    if (locked && canvas.getActiveObject() === obj) canvas.discardActiveObject();
    canvas.requestRenderAll();
    onChange();
  };

  const selectOnCanvas = (id: string) => {
    const obj = findByLayerId(id);
    if (!obj || !obj.selectable) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    onChange();
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const objects = canvas.getObjects();
    const src = objects.find((o) => (o as unknown as { layerId?: string }).layerId === dragId);
    const tgt = objects.find((o) => (o as unknown as { layerId?: string }).layerId === targetId);
    if (!src || !tgt) return;

    // Visual list is top-to-bottom, so moving "above" the target in the list means higher z-index.
    canvas.remove(src);
    const tgtIndex = canvas.getObjects().indexOf(tgt);
    // Insert after target in z-order (so it appears above target).
    (canvas as unknown as { insertAt: (obj: fabric.FabricObject, index: number) => void }).insertAt(src, tgtIndex + 1);
    canvas.requestRenderAll();
    setDragId(null);
    setDragOverId(null);
    onChange();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-slate-100">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Layers</h3>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 px-3 py-6 text-center">No elements yet — add something on the left.</p>
      ) : (
        <ul className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {entries.map((e) => {
            const { Icon } = summarize(findByLayerId(e.id)!);
            return (
              <li
                key={e.id}
                draggable
                onDragStart={() => setDragId(e.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                onDragOver={(ev) => { ev.preventDefault(); setDragOverId(e.id); }}
                onDragLeave={() => setDragOverId((x) => (x === e.id ? null : x))}
                onDrop={() => onDrop(e.id)}
                onClick={() => selectOnCanvas(e.id)}
                className={`group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-colors ${
                  e.selected ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                } ${!e.visible ? "opacity-50" : ""} ${
                  dragOverId === e.id && dragId && dragId !== e.id
                    ? "before:absolute before:-top-0.5 before:left-1 before:right-1 before:h-0.5 before:bg-orange-500 before:rounded-full"
                    : ""
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{e.label}</span>
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); toggleVisible(e.id); }}
                  className={`p-1 rounded hover:bg-white/20 ${e.selected ? "" : "opacity-0 group-hover:opacity-100"}`}
                  title={e.visible ? "Hide" : "Show"}
                >
                  {e.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); toggleLock(e.id); }}
                  className={`p-1 rounded hover:bg-white/20 ${e.selected ? "" : "opacity-0 group-hover:opacity-100"} ${e.locked ? "text-amber-500" : ""}`}
                  title={e.locked ? "Unlock" : "Lock"}
                >
                  {e.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
