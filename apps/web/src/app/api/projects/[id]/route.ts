import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  scene: z.unknown().optional(),
});

async function requireOwner(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { status: 401 as const };
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { status: 404 as const };
  if (project.userId !== session.user.id) return { status: 403 as const };
  return { project, userId: session.user.id };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await requireOwner(id);
  if ("status" in res) return NextResponse.json({ error: "Forbidden" }, { status: res.status });
  return NextResponse.json({ project: res.project });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await requireOwner(id);
  if ("status" in res) return NextResponse.json({ error: "Forbidden" }, { status: res.status });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.project.update({
    where: { id },
    data: parsed.data as never,
    select: { id: true, updatedAt: true },
  });
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await requireOwner(id);
  if ("status" in res) return NextResponse.json({ error: "Forbidden" }, { status: res.status });
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
