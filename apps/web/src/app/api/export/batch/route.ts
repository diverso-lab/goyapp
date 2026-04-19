import { z } from "zod";
import { auth } from "@/auth";
import { sanitizeSvg } from "@/lib/sanitize-svg";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  items: z
    .array(
      z.object({
        svg: z.string().min(10),
        width: z.number().positive(),
        height: z.number().positive(),
        filename: z.string().default("poster"),
      }),
    )
    .min(1)
    .max(500),
  zipName: z.string().default("posters"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  // Batches are heavy — stricter limit.
  const rl = rateLimit(`batch:${session.user.id}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "retry-after": String(rl.retryAfterSec) },
    });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const workerUrl = process.env.PDF_WORKER_URL ?? "http://localhost:4000";
  const secret = process.env.WORKER_SECRET ?? "";
  const body = {
    ...parsed.data,
    items: parsed.data.items.map((it) => ({ ...it, svg: sanitizeSvg(it.svg) })),
  };
  const upstream = await fetch(`${workerUrl}/batch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-worker-secret": secret } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new Response(`Batch worker error: ${text}`, { status: 502 });
  }

  const name = `${parsed.data.zipName}.zip`;
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_").slice(0, 100);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
