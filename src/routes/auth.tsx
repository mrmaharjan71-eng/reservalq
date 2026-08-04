import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button, Field, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Administration Sign In — ReservalQ Hotel Management" },
      {
        name: "description",
        content:
          "Secure, invite-only sign-in for the ReservalQ owner, manager and sales manager accounts controlling hotel operations.",
      },
      { property: "og:title", content: "Administration Sign In — ReservalQ Hotel Management" },
      { property: "og:description", content: "Secure administration access to ReservalQ hotel operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ACCOUNTS = [
  { role: "Owner", detail: "Full oversight of every account and every operation." },
  { role: "Manager", detail: "Front desk, rooms, housekeeping and the AI manager." },
  { role: "Sales manager", detail: "Reservations, guests, rates and revenue." },
];

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) return setError("Those credentials were not recognised.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-shell)" }}
    >
      <div className="panel w-full max-w-md p-7">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">ReservalQ Administration</p>
        <h1 className="mt-2 font-display text-2xl">Administration sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access is limited to the three designated hotel administration accounts.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Field label="Account email">
            <input
              className={inputClass}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@reservalq.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Designated password">
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Verifying…" : "Sign in"}
          </Button>
        </form>

        <ul className="mt-6 space-y-2 border-t border-border pt-5">
          {ACCOUNTS.map((account) => (
            <li key={account.role} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{account.role}</span> — {account.detail}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Self sign-up is disabled. Guests can{" "}
          <Link to="/book" className="text-primary underline-offset-4 hover:underline">
            book
          </Link>{" "}
          or{" "}
          <Link to="/concierge" className="text-primary underline-offset-4 hover:underline">
            chat
          </Link>{" "}
          without an account.
        </p>
      </div>
    </div>
  );
}
