import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_REVISIONS_PER_PROJECT = 30;
const MIN_SECONDS_BETWEEN_REVISIONS = 60; // don't snapshot more than once per minute per project

async function requireOwner(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const p = await prisma.project.findUnique({ where: { id }, select: { userId: true, scene: true } });
  if (!p || p.userId !== session.user.id) return null;
  return { session, project: p };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await requireOwner(id);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const revisions = await prisma.projectRevision.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ revisions });
}

// Called by the editor on autosave — the server decides whether to snapshot based on the minute-rule.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOwner(id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const latest = await prisma.projectRevision.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < MIN_SECONDS_BETWEEN_REVISIONS * 1000) {
    return NextResponse.json({ ok: true, snapshotted: false });
  }

  const rev = await prisma.projectRevision.create({
    data: { projectId: id, scene: ctx.project.scene as object },
    select: { id: true, createdAt: true },
  });

  const keepIds = await prisma.projectRevision.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: MAX_REVISIONS_PER_PROJECT,
    select: { id: true },
  });
  const keepSet = new Set(keepIds.map((r) => r.id));
  await prisma.projectRevision.deleteMany({
    where: { projectId: id, id: { notIn: [...keepSet] } },
  });

  return NextResponse.json({ ok: true, snapshotted: true, revision: rev });
}
