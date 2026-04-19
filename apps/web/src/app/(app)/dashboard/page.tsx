import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [templates, projects] = await Promise.all([
    prisma.template.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        width: true,
        height: true,
        scene: true,
        createdById: true,
      },
    }),
    prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, width: true, height: true, scene: true, updatedAt: true },
    }),
  ]);

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/dashboard" className="text-xl font-bold">
          Goyapp
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{session.user.email}</span>
          <form action={doSignOut}>
            <button className="text-sm underline">Sign out</button>
          </form>
        </div>
      </header>

      <DashboardClient
        currentUserId={session.user.id}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? null,
          category: t.category ?? null,
          width: t.width,
          height: t.height,
          scene: t.scene,
          createdById: t.createdById ?? null,
        }))}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          width: p.width,
          height: p.height,
          scene: p.scene,
          updatedAt: p.updatedAt.toISOString(),
        }))}
      />
    </main>
  );
}
