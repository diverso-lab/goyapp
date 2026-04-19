import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.string().max(60).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scene: z.unknown(),
});

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, category: true, width: true, height: true, previewUrl: true },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const tpl = await prisma.template.create({
    data: { ...parsed.data, scene: parsed.data.scene as object, createdById: session.user.id },
    select: { id: true },
  });
  return NextResponse.json({ template: tpl }, { status: 201 });
}
