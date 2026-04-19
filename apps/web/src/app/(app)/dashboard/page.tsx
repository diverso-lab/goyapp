import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { Button } from "@/components/ui/button";
import { AdminLinkIfAdmin } from "./admin-link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [templates, projects] = await Promise.all([
    prisma.template.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, description: true, category: true,
        width: true, height: true, scene: true, createdById: true,
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

  const isAdmin = session.user.role === "ADMIN";

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur px-8 py-4">
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-auto" />
          <span className="text-xs text-slate-400 hidden sm:inline">Poster studio</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 hidden sm:inline">{session.user.email}</span>
          <ThemeToggle />
          <AdminLinkIfAdmin isAdmin={isAdmin} />
          <form action={doSignOut}>
            <Button type="submit" variant="ghost" size="sm">Sign out</Button>
          </form>
        </div>
      </header>

      <DashboardClient
        currentUserId={session.user.id}
        isAdmin={isAdmin}
        templates={templates.map((t) => ({
          id: t.id, name: t.name,
          description: t.description ?? null, category: t.category ?? null,
          width: t.width, height: t.height, scene: t.scene,
          createdById: t.createdById ?? null,
        }))}
        projects={projects.map((p) => ({
          id: p.id, name: p.name, width: p.width, height: p.height,
          scene: p.scene, updatedAt: p.updatedAt.toISOString(),
        }))}
      />
      <Footer />
    </main>
  );
}
