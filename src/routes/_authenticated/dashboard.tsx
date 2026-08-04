import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, Panel, SkeletonRows, Stat, statusTone } from "@/components/ui-kit";
import { currency, longDate, shortDate, titleCase, todayISO } from "@/lib/format";
import { aiActionsQuery, housekeepingQuery, reservationsQuery, roomsQuery } from "@/lib/hotel-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content:
          "Live occupancy, arrivals, departures, revenue and AI recommendations for today's hotel operations.",
      },
      { property: "og:title", content: "Operations Dashboard — ReservalQ AI Hotel Management" },
      {
        property: "og:description",
        content: "Live occupancy, arrivals, departures and AI recommendations in one operations view.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const today = todayISO();
  const reservations = useQuery(reservationsQuery);
  const rooms = useQuery(roomsQuery);
  const tasks = useQuery(housekeepingQuery);
  const aiActions = useQuery(aiActionsQuery);

  const list = reservations.data ?? [];
  const arrivals = list.filter((r) => r.check_in === today && r.status !== "cancelled");
  const departures = list.filter((r) => r.check_out === today && r.status !== "cancelled");
  const inHouse = list.filter((r) => r.status === "checked_in");
  const unassigned = list.filter((r) => !r.room_id && ["pending", "confirmed"].includes(r.status));

  const sellableRooms = (rooms.data ?? []).filter((room) => room.is_active && room.condition !== "out_of_order");
  const occupancy = sellableRooms.length
    ? Math.round((inHouse.length / sellableRooms.length) * 100)
    : 0;
  const revenueToday = inHouse.reduce((sum, r) => sum + Number(r.nightly_rate), 0);
  const adr = inHouse.length ? revenueToday / inHouse.length : 0;
  const openTasks = (tasks.data ?? []).filter((task) => task.status !== "completed");
  const proposals = (aiActions.data ?? []).filter((action) => action.status === "proposed");

  return (
    <AppShell title="Operations dashboard" subtitle={longDate(today)}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Occupancy" value={`${occupancy}%`} hint={`${inHouse.length} of ${sellableRooms.length} sellable rooms`} />
        <Stat label="Room revenue today" value={currency(revenueToday)} hint={`ADR ${currency(adr)}`} />
        <Stat label="Arrivals / departures" value={`${arrivals.length} / ${departures.length}`} hint="Scheduled for today" />
        <Stat label="Open housekeeping" value={String(openTasks.length)} hint={`${proposals.length} AI items awaiting approval`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel
          title="Today's arrivals"
          description="Guests expected at the front desk"
          className="xl:col-span-2"
          action={
            <Link to="/reservations" className="text-sm text-primary underline-offset-4 hover:underline">
              All reservations
            </Link>
          }
        >
          {reservations.isPending ? (
            <SkeletonRows />
          ) : arrivals.length === 0 ? (
            <EmptyState title="No arrivals today" description="Every expected guest has already been processed." />
          ) : (
            <ul className="divide-y divide-border">
              {arrivals.map((reservation) => (
                <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {reservation.guests?.full_name}{" "}
                      {reservation.guests?.is_vip && <Badge tone="brass">VIP</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reservation.reference} · {reservation.room_types?.name} ·{" "}
                      {reservation.rooms?.room_number
                        ? `Room ${reservation.rooms.room_number}`
                        : "Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {shortDate(reservation.check_in)} → {shortDate(reservation.check_out)}
                    </span>
                    <Badge tone={statusTone(reservation.status)}>{titleCase(reservation.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="AI Booking Manager"
          description="Recommendations awaiting human approval"
          action={
            <Link to="/ai-manager" className="text-sm text-primary underline-offset-4 hover:underline">
              Open
            </Link>
          }
        >
          {aiActions.isPending ? (
            <SkeletonRows rows={3} />
          ) : proposals.length === 0 ? (
            <EmptyState title="Queue clear" description="No pending AI recommendations right now." />
          ) : (
            <ul className="space-y-3">
              {proposals.slice(0, 4).map((action) => (
                <li key={action.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="info">{titleCase(action.action_type)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(Number(action.confidence) * 100)}% confidence
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{action.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Unassigned reservations" description="Need a room before arrival">
          {unassigned.length === 0 ? (
            <EmptyState title="All assigned" description="Every upcoming booking has a room." />
          ) : (
            <ul className="divide-y divide-border">
              {unassigned.map((reservation) => (
                <li key={reservation.id} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    {reservation.guests?.full_name}
                    <span className="ml-2 text-xs text-muted-foreground">{reservation.room_types?.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{shortDate(reservation.check_in)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Housekeeping priorities" description="Highest priority open tasks">
          {tasks.isPending ? (
            <SkeletonRows rows={3} />
          ) : openTasks.length === 0 ? (
            <EmptyState title="Board clear" description="No open housekeeping tasks." />
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.slice(0, 5).map((task) => (
                <li key={task.id} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    Room {task.rooms?.room_number}
                    <span className="ml-2 text-xs text-muted-foreground">{titleCase(task.task_type)}</span>
                  </span>
                  <Badge tone={statusTone(task.status)}>{titleCase(task.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}