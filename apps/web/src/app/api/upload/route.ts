import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { putObject } from "@/lib/s3";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`upload:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `Unsupported type ${file.type}` }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/svg+xml" ? "svg"
    : file.type === "image/jpeg" ? "jpg"
    : file.type.split("/")[1];
  const key = `uploads/${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const url = await putObject(key, buf, file.type);

  return NextResponse.json({ url, size: file.size, type: file.type });
}

export const runtime = "nodejs";
