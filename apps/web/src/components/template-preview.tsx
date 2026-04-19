"use client";

import { useEffect, useState } from "react";
import * as fabric from "fabric";

// In-memory cache so scrolling the dashboard doesn't re-render every thumbnail.
const previewCache = new Map<string, string>();
const MAX_CACHE = 200;

function cacheKey(scene: unknown, width: number, height: number): string {
  // Cheap-ish hash — the scene JSON is already available client-side.
  try {
    return `${width}x${height}:${JSON.stringify(scene).length}:${JSON.stringify(scene).slice(0, 120)}`;
  } catch {
    return `${width}x${height}:${Math.random()}`;
  }
}

export function TemplatePreview({
  scene,
  width,
  height,
  className,
  aspect = "4 / 5",
}: {
  scene: unknown;
  width: number;
  height: number;
  className?: string;
  aspect?: string;
}) {
  const key = cacheKey(scene, width, height);
  const [dataUrl, setDataUrl] = useState<string | null>(() => previewCache.get(key) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (previewCache.has(key)) {
      setDataUrl(previewCache.get(key)!);
      return;
    }
    let cancelled = false;
    let canvas: fabric.StaticCanvas | null = null;
    const el = document.createElement("canvas");

    (async () => {
      try {
        if (typeof document !== "undefined" && document.fonts) {
          await document.fonts.ready;
        }
        canvas = new fabric.StaticCanvas(el, {
          width,
          height,
          backgroundColor: "#ffffff",
          enableRetinaScaling: false,
          renderOnAddRemove: false,
        });
        await canvas.loadFromJSON(scene as object);
        if (cancelled) return;
        canvas.renderAll();
        const targetW = 700;
        const multiplier = Math.min(1, targetW / width);
        const url = canvas.toDataURL({ format: "png", multiplier, quality: 0.85 });
        if (!cancelled) {
          previewCache.set(key, url);
          if (previewCache.size > MAX_CACHE) {
            const firstKey = previewCache.keys().next().value;
            if (firstKey) previewCache.delete(firstKey);
          }
          setDataUrl(url);
        }
      } catch (e) {
        console.error("TemplatePreview render failed", e);
        if (!cancelled) setFailed(true);
      } finally {
        canvas?.dispose();
      }
    })();

    return () => { cancelled = true; };
  }, [key, scene, width, height]);

  return (
    <div
      className={`${className ?? ""} goyapp-preview-frame`}
      style={{
        aspectRatio: aspect,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 16,
      }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt=""
          draggable={false}
          className="goyapp-preview-img"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            borderRadius: 3,
          }}
        />
      ) : (
        <span className="text-slate-400 text-xs">
          {failed ? `${width}×${height}` : "…"}
        </span>
      )}
    </div>
  );
}
