"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Preset = { key: string; label: string; sublabel: string; width: number; height: number; group: string };

// Print presets at 150 DPI to stay manageable in-browser while keeping print quality.
const PRESETS: Preset[] = [
  { key: "a4p",  group: "Print",  label: "A4 · Portrait",    sublabel: "1240×1754 (150dpi)", width: 1240, height: 1754 },
  { key: "a4l",  group: "Print",  label: "A4 · Landscape",   sublabel: "1754×1240 (150dpi)", width: 1754, height: 1240 },
  { key: "a5p",  group: "Print",  label: "A5 · Portrait",    sublabel: "874×1240 (150dpi)",  width: 874,  height: 1240 },
  { key: "a5l",  group: "Print",  label: "A5 · Landscape",   sublabel: "1240×874 (150dpi)",  width: 1240, height: 874  },
  { key: "a3p",  group: "Print",  label: "A3 · Portrait",    sublabel: "1754×2480 (150dpi)", width: 1754, height: 2480 },
  { key: "lett", group: "Print",  label: "US Letter",        sublabel: "1275×1650 (150dpi)", width: 1275, height: 1650 },

  { key: "story",  group: "Social", label: "Story · 9:16",   sublabel: "1080×1920",           width: 1080, height: 1920 },
  { key: "post",   group: "Social", label: "Social post",    sublabel: "1080×1350 (4:5)",     width: 1080, height: 1350 },
  { key: "square", group: "Social", label: "Square",         sublabel: "1080×1080",           width: 1080, height: 1080 },
  { key: "land",   group: "Social", label: "Landscape 16:9", sublabel: "1920×1080",           width: 1920, height: 1080 },
];

export function NewTemplateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [customW, setCustomW] = useState<number>(1240);
  const [customH, setCustomH] = useState<number>(1754);
  const [useCustom, setUseCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    if (!name.trim()) { setErr("Name is required"); return; }
    const w = useCustom ? customW : preset.width;
    const h = useCustom ? customH : preset.height;
    if (!w || !h || w < 50 || h < 50 || w > 10000 || h > 10000) {
      setErr("Invalid dimensions"); return;
    }
    setBusy(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        width: w, height: h,
        scene: { version: "6.0.0", background: "#ffffff", objects: [] },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => null))?.error ?? "Failed to create");
      return;
    }
    const { template } = await res.json();
    router.push(`/templates/${template.id}/edit`);
  }

  const groups = Array.from(new Set(PRESETS.map((p) => p.group)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">New template</h2>
          <p className="text-sm text-slate-500">Name it, pick a size, and start designing.</p>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <Label>Template name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quarterly meetup" autoFocus />
          </div>

          {groups.map((g) => (
            <div key={g}>
              <Label>{g}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESETS.filter((p) => p.group === g).map((p) => {
                  const isActive = !useCustom && preset.key === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => { setPreset(p); setUseCustom(false); }}
                      className={`text-left rounded-lg border px-3 py-2.5 transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PresetGlyph width={p.width} height={p.height} active={isActive} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.label}</div>
                          <div className={`text-[11px] ${isActive ? "text-slate-300" : "text-slate-500"}`}>{p.sublabel}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <Label>Custom</Label>
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={`w-full text-left rounded-lg border px-3 py-3 transition ${
                useCustom
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-medium text-slate-900 mb-2">Custom dimensions</div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input type="number" min={50} max={10000} value={customW} onChange={(e) => { setUseCustom(true); setCustomW(Number(e.target.value)); }} className="w-28" />
                <span className="text-slate-400 text-xs">×</span>
                <Input type="number" min={50} max={10000} value={customH} onChange={(e) => { setUseCustom(true); setCustomH(Number(e.target.value)); }} className="w-28" />
                <span className="text-xs text-slate-400">pixels</span>
              </div>
            </button>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
          <Button variant="secondary" size="md" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" size="md" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create & edit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresetGlyph({ width, height, active }: { width: number; height: number; active: boolean }) {
  const aspect = width / height;
  const maxSide = 22;
  const w = aspect >= 1 ? maxSide : Math.round(maxSide * aspect);
  const h = aspect >= 1 ? Math.round(maxSide / aspect) : maxSide;
  return (
    <span
      aria-hidden
      style={{
        width: w, height: h,
        borderRadius: 3,
        background: active ? "rgba(255,255,255,0.9)" : "#e2e8f0",
        border: active ? "1px solid rgba(255,255,255,0.9)" : "1px solid #cbd5e1",
        flexShrink: 0,
      }}
    />
  );
}
