import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireOwner(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  if (!p || p.userId !== session.user.id) return null;
  return session;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; revId: string }> }) {
  const { id, revId } = await params;
  if (!(await requireOwner(id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rev = await prisma.projectRevision.findUnique({ where: { id: revId } });
  if (!rev || rev.projectId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ revision: rev });
}

// Restore — write the revision scene back to the project.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; revId: string }> }) {
  const { id, revId } = await params;
  if (!(await requireOwner(id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rev = await prisma.projectRevision.findUnique({ where: { id: revId } });
  if (!rev || rev.projectId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.project.update({ where: { id }, data: { scene: rev.scene as object } });
  return NextResponse.json({ ok: true });
}
