import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tpl = await prisma.template.findUnique({ where: { id }, select: { createdById: true } });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = tpl.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  scene: z.unknown().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tpl = await prisma.template.findUnique({ where: { id }, select: { createdById: true } });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isOwner = tpl.createdById === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.template.update({
    where: { id },
    data: parsed.data as never,
    select: { id: true },
  });
  return NextResponse.json({ template: updated });
}
