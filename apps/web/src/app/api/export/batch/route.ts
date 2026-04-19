import { z } from "zod";
import { auth } from "@/auth";

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

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid input", { status: 400 });

  const workerUrl = process.env.PDF_WORKER_URL ?? "http://localhost:4000";
  const upstream = await fetch(`${workerUrl}/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return new Response(`Batch worker error: ${text}`, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${parsed.data.zipName}.zip"`,
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
