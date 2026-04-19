import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LandingActions } from "./landing-actions";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-xl text-center space-y-8">
          <div className="flex justify-center">
            <Logo className="h-14 w-auto" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900">
            Design posters.<br />
            <span className="text-slate-500">Stay on brand.</span>
          </h1>
          <p className="text-lg text-slate-600">
            Pick a template. Fill a form or drag elements around freely. Export to SVG, PNG, JPG or PDF — pixel-perfect.
          </p>
          <LandingActions />
          <p className="text-xs text-slate-400">Accounts are created by an administrator.</p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
