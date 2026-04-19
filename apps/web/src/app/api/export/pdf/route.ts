import { z } from "zod";
import { auth } from "@/auth";
import { sanitizeSvg } from "@/lib/sanitize-svg";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  svg: z.string().min(10),
  width: z.number().positive(),
  height: z.number().positive(),
  filename: z.string().default("poster"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const rl = rateLimit(`pdf:${session.user.id}`, { limit: 30, windowMs: 60_000 });
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
  const upstream = await fetch(`${workerUrl}/render`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-worker-secret": secret } : {}),
    },
    body: JSON.stringify({ ...parsed.data, svg: sanitizeSvg(parsed.data.svg) }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(`PDF worker error: ${text}`, { status: 502 });
  }

  const name = `${parsed.data.filename}.pdf`;
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_").slice(0, 100);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
