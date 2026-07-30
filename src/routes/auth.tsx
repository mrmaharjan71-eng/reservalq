import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, Field, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — Aurelia AI Hotel Management" },
      {
        name: "description",
        content:
          "Secure sign-in for hotel staff to access reservations, rooms, housekeeping and the AI Booking Manager.",
      },
      { property: "og:title", content: "Staff Sign In — Aurelia AI Hotel Management" },
      { property: "og:description", content: "Secure sign-in for Aurelia hotel operations staff." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName || email.split("@")[0] },
        },
      });
      setBusy(false);
      if (signUpError) return setError(signUpError.message);
      if (!data.session) return setMessage("Check your email to confirm the account, then sign in.");
      return navigate({ to: "/dashboard", replace: true });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) return setError(signInError.message);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-shell)" }}
    >
      <div className="panel w-full max-w-md p-7">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Aurelia Hotel Group</p>
        <h1 className="mt-2 font-display text-2xl">
          {mode === "signin" ? "Staff sign in" : "Create staff account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Front desk, housekeeping and management access to live hotel operations.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <Field label="Full name">
              <input
                className={inputClass}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Alex Moreau"
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="Work email">
            <input
              className={inputClass}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@hotel.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-md bg-success/15 px-3 py-2 text-sm text-success">{message}</p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "First time here?" : "Already have access?"}{" "}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "signin" ? "Create a staff account" : "Sign in instead"}
          </button>
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          The first account created becomes the hotel administrator.
        </p>
      </div>
    </div>
  );
}