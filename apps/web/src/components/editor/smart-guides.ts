import * as fabric from "fabric";

type GuideLine = { orientation: "v" | "h"; position: number };

const SNAP_TOLERANCE = 6;

export function installSmartGuides(canvas: fabric.Canvas) {
  let currentGuides: GuideLine[] = [];

  const getEdges = (obj: fabric.FabricObject) => {
    const br = obj.getBoundingRect();
    return {
      left: br.left,
      right: br.left + br.width,
      top: br.top,
      bottom: br.top + br.height,
      centerX: br.left + br.width / 2,
      centerY: br.top + br.height / 2,
      width: br.width,
      height: br.height,
    };
  };

  const onMoving = (e: { target?: fabric.FabricObject }) => {
    const target = e.target;
    if (!target) return;
    const others = canvas.getObjects().filter((o) => o !== target);
    const me = getEdges(target);

    const canvasW = canvas.getWidth() / canvas.getZoom();
    const canvasH = canvas.getHeight() / canvas.getZoom();

    const verticalTargets: { pos: number; type: "left" | "right" | "centerX" }[] = [
      { pos: 0, type: "left" },
      { pos: canvasW, type: "right" },
      { pos: canvasW / 2, type: "centerX" },
    ];
    const horizontalTargets: { pos: number; type: "top" | "bottom" | "centerY" }[] = [
      { pos: 0, type: "top" },
      { pos: canvasH, type: "bottom" },
      { pos: canvasH / 2, type: "centerY" },
    ];
    for (const o of others) {
      const oe = getEdges(o);
      verticalTargets.push({ pos: oe.left, type: "left" }, { pos: oe.right, type: "right" }, { pos: oe.centerX, type: "centerX" });
      horizontalTargets.push({ pos: oe.top, type: "top" }, { pos: oe.bottom, type: "bottom" }, { pos: oe.centerY, type: "centerY" });
    }

    const guides: GuideLine[] = [];
    let dx = 0;
    let dy = 0;

    for (const side of ["left", "right", "centerX"] as const) {
      for (const t of verticalTargets) {
        if (Math.abs(me[side] - t.pos) < SNAP_TOLERANCE) {
          dx = t.pos - me[side];
          guides.push({ orientation: "v", position: t.pos });
          break;
        }
      }
      if (dx) break;
    }
    for (const side of ["top", "bottom", "centerY"] as const) {
      for (const t of horizontalTargets) {
        if (Math.abs(me[side] - t.pos) < SNAP_TOLERANCE) {
          dy = t.pos - me[side];
          guides.push({ orientation: "h", position: t.pos });
          break;
        }
      }
      if (dy) break;
    }

    if (dx !== 0) target.set({ left: (target.left ?? 0) + dx });
    if (dy !== 0) target.set({ top: (target.top ?? 0) + dy });
    if (dx !== 0 || dy !== 0) target.setCoords();
    currentGuides = guides;
  };

  const onModifiedOrClear = () => {
    currentGuides = [];
    canvas.requestRenderAll();
  };

  const afterRender = () => {
    if (currentGuides.length === 0) return;
    const ctx = canvas.getContext();
    ctx.save();
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 1 / canvas.getZoom();
    ctx.setLineDash([4 / canvas.getZoom(), 4 / canvas.getZoom()]);
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const canvasW = canvas.getWidth() / canvas.getZoom();
    const canvasH = canvas.getHeight() / canvas.getZoom();
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
    for (const g of currentGuides) {
      ctx.beginPath();
      if (g.orientation === "v") {
        ctx.moveTo(g.position, 0);
        ctx.lineTo(g.position, canvasH);
      } else {
        ctx.moveTo(0, g.position);
        ctx.lineTo(canvasW, g.position);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  canvas.on("object:moving", onMoving);
  canvas.on("object:modified", onModifiedOrClear);
  canvas.on("mouse:up", onModifiedOrClear);
  canvas.on("after:render", afterRender);

  return () => {
    canvas.off("object:moving", onMoving);
    canvas.off("object:modified", onModifiedOrClear);
    canvas.off("mouse:up", onModifiedOrClear);
    canvas.off("after:render", afterRender);
  };
}
