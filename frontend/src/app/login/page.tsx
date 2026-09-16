"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    const next = searchParams.get("next");
    router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/configure");
  }

  return (
    <main className="auth-page">
      <div className="auth-grid" aria-hidden />
      <div className="auth-orbit auth-orbit-one" aria-hidden />
      <div className="auth-orbit auth-orbit-two" aria-hidden />
      <section className="auth-intro">
        <Link className="auth-brand" href="/" aria-label="Shelter Thermal Designer home">
          <span className="auth-brand-mark" aria-hidden><i /><i /><i /><i /></span>
          <span>Shelter Thermal <small>Designer</small></span>
        </Link>
        <p className="eyebrow auth-eyebrow">SIH26051 · THERMAL ANALYSIS WORKSPACE</p>
        <h1>Design for the conditions <em>beyond</em> the map.</h1>
        <p className="auth-intro-copy">Return to your field workspace to configure a shelter, assess the climate, and make every thermal decision count.</p>
        <div className="auth-feature"><CheckCircle2 aria-hidden /> Your analysis workspace is ready</div>
        <div className="auth-feature"><CheckCircle2 aria-hidden /> Continue from your last configuration</div>
      </section>

      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow">FIELD WORKSPACE ACCESS</p>
        <h2 id="login-title">Welcome back</h2>
        <p className="auth-panel-copy">New to Shelter Thermal? <Link href="/register">Create an account</Link></p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Work email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Opening workspace…" : "Enter workspace"} <ArrowUpRight aria-hidden />
          </button>
        </form>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
