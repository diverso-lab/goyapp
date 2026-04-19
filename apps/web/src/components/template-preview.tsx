"use client";

import { useEffect, useState } from "react";
import * as fabric from "fabric";

export function TemplatePreview({
  scene,
  width,
  height,
  className,
}: {
  scene: unknown;
  width: number;
  height: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
        const targetW = 600;
        const multiplier = Math.min(1, targetW / width);
        const url = canvas.toDataURL({ format: "png", multiplier, quality: 0.85 });
        if (!cancelled) setDataUrl(url);
      } catch (e) {
        console.error("TemplatePreview render failed", e);
        if (!cancelled) setFailed(true);
      } finally {
        canvas?.dispose();
      }
    })();

    return () => { cancelled = true; };
  }, [scene, width, height]);

  return (
    <div
      className={className}
      style={{
        aspectRatio: `${width} / ${height}`,
        backgroundColor: "#f1f5f9",
        backgroundImage: dataUrl ? `url(${dataUrl})` : undefined,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontSize: 12,
      }}
    >
      {!dataUrl && (failed ? <span>{width}×{height}</span> : <span>…</span>)}
    </div>
  );
}
