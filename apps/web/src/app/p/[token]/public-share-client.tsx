"use client";

import { useEffect, useRef } from "react";
import * as fabric from "fabric";

type Project = { id: string; name: string; width: number; height: number; scene: unknown };

export function PublicShareClient({ project }: { project: Project }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = new fabric.StaticCanvas(canvasRef.current, {
      width: project.width,
      height: project.height,
      backgroundColor: "#ffffff",
    });
    const fit = () => {
      const container = containerRef.current;
      if (!container) return;
      const padding = 32;
      const availW = container.clientWidth - padding * 2;
      const availH = container.clientHeight - padding * 2;
      const scale = Math.min(availW / project.width, availH / project.height, 1);
      const w = Math.round(project.width * scale);
      const h = Math.round(project.height * scale);
      c.setDimensions({ width: w, height: h });
      c.setViewportTransform([scale, 0, 0, scale, 0, 0]);
      c.requestRenderAll();
    };
    c.loadFromJSON(project.scene as object).then(() => {
      c.renderAll();
      fit();
    });
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      c.dispose();
    };
  }, [project]);

  return (
    <div ref={containerRef} className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[length:18px_18px]">
      <div className="shadow-2xl rounded-sm bg-white ring-1 ring-slate-200/60">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
