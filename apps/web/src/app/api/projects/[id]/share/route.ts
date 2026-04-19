import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireOwner(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const p = await prisma.project.findUnique({ where: { id }, select: { userId: true } });
  if (!p || p.userId !== session.user.id) return null;
  return session;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireOwner(id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const token = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.project.update({
    where: { id },
    data: { shareToken: token },
    select: { shareToken: true },
  });
  return NextResponse.json({ token: updated.shareToken });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await requireOwner(id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.project.update({ where: { id }, data: { shareToken: null } });
  return NextResponse.json({ ok: true });
}
