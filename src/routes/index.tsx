import { Link, createFileRoute } from "@tanstack/react-router";
import { Bot, CalendarRange, ShieldCheck, Sparkles, SprayCan } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurelia — AI Hotel Management System for Real Hotels" },
      {
        name: "description",
        content:
          "Enterprise property management with an AI front desk manager: reservations, room assignment, housekeeping and approvals in one operations console.",
      },
      { property: "og:title", content: "Aurelia — AI Hotel Management System for Real Hotels" },
      {
        property: "og:description",
        content: "Enterprise property management with an AI front desk manager: reservations, room assignment, housekeeping and approvals in one operations console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: CalendarRange,
    title: "Reservation lifecycle",
    body: "Bookings, room assignment, check-in and check-out with automatic housekeeping hand-off.",
  },
  {
    icon: SprayCan,
    title: "Live operations",
    body: "Floor-by-floor room condition and a prioritised housekeeping board driven by real arrivals.",
  },
  {
    icon: Bot,
    title: "AI booking manager",
    body: "Grounded in live occupancy. It proposes actions with reasoning — staff approve or reject.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise controls",
    body: "Role-based access, row-level security and an audit log behind every state change.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-shell)" }}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Aurelia <span className="brass-text">HMS</span>
        </span>
        <div className="flex items-center gap-2">
          <Link
            to="/concierge"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Guest chat
          </Link>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
          >
            Staff sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="py-16">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Enterprise property management
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">
            The hotel operations console with an <span className="brass-text">AI front desk manager</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Aurelia runs the real work of a property — reservations, room inventory, housekeeping and guest
            history — while an AI manager reads live state and recommends the next move. Nothing executes
            without a human approval.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
            >
              Enter the console
            </Link>
            <Link
              to="/dashboard"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              View today's operations
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="panel p-6">
              <Icon className="size-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
