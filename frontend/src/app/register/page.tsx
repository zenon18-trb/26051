"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/auth/register-schema";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const fieldErrors = result?.fieldErrors as Partial<Record<keyof RegisterInput, string[]>> | undefined;
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (messages?.[0]) setFieldError(field as keyof RegisterInput, { message: messages[0] });
        }
      }
      setError(result?.error ?? "We could not create your account. Please try again.");
      return;
    }

    if (!result.requiresEmailConfirmation) {
      router.push("/configure");
      return;
    }

    setMessage("Check your inbox to confirm your email, then sign in to begin configuring your shelter.");
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
        <p className="eyebrow auth-eyebrow">FIELD WORKSPACE ACCESS</p>
        <h1>Build for the conditions <em>beyond</em> the map.</h1>
        <p className="auth-intro-copy">Create a workspace to model your shelter, validate thermal choices, and keep every field analysis in one place.</p>
        <div className="auth-feature"><CheckCircle2 aria-hidden /> Climate-aware analysis</div>
        <div className="auth-feature"><CheckCircle2 aria-hidden /> Configurations ready for simulation</div>
      </section>

      <section className="auth-panel" aria-labelledby="register-title">
        {message ? (
          <div className="auth-success" role="status">
            <CheckCircle2 aria-hidden />
            <h2>Confirm your email</h2>
            <p>{message}</p>
            <Link className="auth-submit" href="/login">Go to sign in <ArrowUpRight aria-hidden /></Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">NEW FIELD ACCOUNT</p>
            <h2 id="register-title">Create your workspace</h2>
            <p className="auth-panel-copy">Already registered? <Link href="/login">Sign in</Link></p>
            <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <label>
                Your name
                <input type="text" autoComplete="name" aria-invalid={Boolean(errors.fullName)} {...register("fullName")} />
                {errors.fullName && <span className="auth-field-error" role="alert">{errors.fullName.message}</span>}
              </label>
              <label>
                Work email
                <input type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
                {errors.email && <span className="auth-field-error" role="alert">{errors.email.message}</span>}
              </label>
              <div className="auth-form-row">
                <label>
                  Password
                  <input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
                  {errors.password && <span className="auth-field-error" role="alert">{errors.password.message}</span>}
                </label>
                <label>
                  Confirm password
                  <input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
                  {errors.confirmPassword && <span className="auth-field-error" role="alert">{errors.confirmPassword.message}</span>}
                </label>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create account"} <ArrowUpRight aria-hidden />
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
