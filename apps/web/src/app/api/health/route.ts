import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ComponentStatus = "up" | "down" | "skipped";

export async function GET() {
  const services: Record<string, { status: ComponentStatus; latencyMs?: number; error?: string }> = {};
  let ok = true;

  // DB
  {
    const t = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.db = { status: "up", latencyMs: Date.now() - t };
    } catch (e) {
      ok = false;
      services.db = { status: "down", error: (e as Error).message };
    }
  }

  // PDF worker
  {
    const url = process.env.PDF_WORKER_URL;
    if (!url) {
      services.pdfWorker = { status: "skipped" };
    } else {
      const t = Date.now();
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) services.pdfWorker = { status: "up", latencyMs: Date.now() - t };
        else { ok = false; services.pdfWorker = { status: "down", error: `HTTP ${res.status}` }; }
      } catch (e) {
        ok = false;
        services.pdfWorker = { status: "down", error: (e as Error).message };
      }
    }
  }

  return NextResponse.json(
    { ok, services, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
