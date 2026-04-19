"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { Footer } from "@/components/footer";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { setErr("Wrong email or password"); return; }
    router.push("/dashboard"); router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Logo className="h-10 w-auto" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sign in to continue.</p>
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Log in"}
        </Button>
        <p className="text-xs text-center text-slate-400">
          Need an account? Ask an administrator to invite you.
        </p>
      </form>
      </div>
      <Footer />
    </main>
  );
}
