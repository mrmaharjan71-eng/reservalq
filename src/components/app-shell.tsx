import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BedDouble,
  Bot,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  BookOpen,
  Building2,
  Sparkles,
  SprayCan,
  MessagesSquare,
} from "lucide-react";
import { type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/reservations", label: "Reservations", icon: CalendarRange },
  { to: "/rooms", label: "Rooms", icon: BedDouble },
  { to: "/room-setup", label: "Room Setup", icon: Building2 },
  { to: "/housekeeping", label: "Housekeeping", icon: SprayCan },
  { to: "/ai-manager", label: "AI Manager", icon: Bot },
  { to: "/guest-chats", label: "Guest Chats", icon: MessagesSquare },
  { to: "/knowledge", label: "Concierge Data", icon: BookOpen },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen lg:flex" style={{ background: "var(--gradient-shell)" }}>
      <aside className="border-b border-sidebar-border bg-sidebar lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <Sparkles className="size-5 text-primary" aria-hidden />
          <span className="font-display text-lg leading-none">
            <span>Reserval<span className="brass-text">Q</span></span>
          </span>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-3 pb-5 lg:block">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground lg:hidden"
          >
            Sign out
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}