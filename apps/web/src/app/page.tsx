import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Goyapp</h1>
        <p className="text-lg text-muted-foreground">
          Pick a template. Drag anything. Export to SVG, PNG, JPG or PDF — pixel-perfect.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-md border px-6 text-sm font-medium hover:bg-accent"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
