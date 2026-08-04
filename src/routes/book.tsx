import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BedDouble, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Field, Panel, inputClass } from "@/components/ui-kit";
import { listPublicRoomTypes, submitGuestBooking } from "@/lib/booking.functions";
import { currency } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a Room — ReservalQ Hotel" },
      {
        name: "description",
        content:
          "Choose your room, dates and guests and send a booking request to the ReservalQ front desk in under a minute. No account needed.",
      },
      { property: "og:title", content: "Book a Room — ReservalQ Hotel" },
      {
        property: "og:description",
        content: "Fast in-app hotel booking — pick a room, choose your dates, done.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookPage,
});

function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function BookPage() {
  const loadRoomTypes = useServerFn(listPublicRoomTypes);
  const book = useServerFn(submitGuestBooking);

  const roomTypes = useQuery({ queryKey: ["public_room_types"], queryFn: () => loadRoomTypes() });

  const [roomTypeId, setRoomTypeId] = useState<string>("");
  const [checkIn, setCheckIn] = useState(today(1));
  const [checkOut, setCheckOut] = useState(today(3));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [confirmation, setConfirmation] = useState<{ reference: string; nights: number; total: number } | null>(
    null,
  );

  const selected = roomTypes.data?.find((type) => type.id === roomTypeId) ?? null;
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000,
    ),
  );
  const estimate = selected ? selected.base_rate * nights : 0;

  const submit = useMutation({
    mutationFn: async () =>
      book({
        data: {
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          roomTypeId,
          checkIn,
          checkOut,
          adults,
          children,
          requests: requests.trim(),
        },
      }),
    onSuccess: (result) => setConfirmation(result),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-shell)" }}>
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden />
          <span>Reserval<span className="brass-text">Q</span></span>
        </Link>
        <Link to="/concierge" className="text-sm text-primary underline-offset-4 hover:underline">
          Ask the concierge
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-20">
        <h1 className="font-display text-3xl">Book your stay</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Pick a room, choose your dates and send it through. The front desk confirms your request and holds the
          room for you.
        </p>

        {confirmation ? (
          <Panel title="Booking request received" description="Our front desk will confirm shortly.">
            <p className="font-display text-3xl brass-text">{confirmation.reference}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {confirmation.nights} night{confirmation.nights === 1 ? "" : "s"} · estimated{" "}
              {currency(confirmation.total)}. Keep this reference — the concierge can look it up for you.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/concierge"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
              >
                Chat with the concierge
              </Link>
              <Button variant="outline" onClick={() => setConfirmation(null)}>
                Make another booking
              </Button>
            </div>
          </Panel>
        ) : (
          <form
            className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!roomTypeId) return toast.error("Choose a room first.");
              submit.mutate();
            }}
          >
            <div className="space-y-4">
              <Panel title="Choose a room">
                {roomTypes.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading rooms…</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(roomTypes.data ?? []).map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setRoomTypeId(type.id)}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-colors",
                          roomTypeId === type.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-secondary/60",
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <BedDouble className="size-4 text-primary" aria-hidden />
                          {type.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{type.description}</span>
                        <span className="mt-3 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="size-3.5" aria-hidden /> up to {type.max_occupancy}
                          </span>
                          <span className="font-medium text-primary">{currency(type.base_rate)} / night</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Your details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      className={inputClass}
                      required
                      maxLength={100}
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Priya Sharma"
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className={inputClass}
                      maxLength={40}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+977 …"
                    />
                  </Field>
                  <Field label="Email (optional)">
                    <input
                      className={inputClass}
                      type="email"
                      maxLength={255}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <Field label="Special requests">
                    <input
                      className={inputClass}
                      maxLength={600}
                      value={requests}
                      onChange={(event) => setRequests(event.target.value)}
                      placeholder="Late arrival, high floor…"
                    />
                  </Field>
                </div>
              </Panel>
            </div>

            <Panel title="Dates and guests" className="h-fit">
              <div className="space-y-4">
                <Field label="Check-in">
                  <input
                    className={inputClass}
                    type="date"
                    required
                    min={today()}
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                  />
                </Field>
                <Field label="Check-out">
                  <input
                    className={inputClass}
                    type="date"
                    required
                    min={checkIn}
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Adults">
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      max={8}
                      value={adults}
                      onChange={(event) => setAdults(Number(event.target.value))}
                    />
                  </Field>
                  <Field label="Children">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      max={8}
                      value={children}
                      onChange={(event) => setChildren(Number(event.target.value))}
                    />
                  </Field>
                </div>

                <div className="rounded-md border border-border bg-surface-elevated p-4 text-sm">
                  <p className="flex justify-between text-muted-foreground">
                    <span>Nights</span>
                    <span className="text-foreground">{nights}</span>
                  </p>
                  <p className="mt-1 flex justify-between text-muted-foreground">
                    <span>Room</span>
                    <span className="text-foreground">{selected?.name ?? "—"}</span>
                  </p>
                  <p className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                    <span className="text-muted-foreground">Estimated total</span>
                    <span className="font-display text-xl brass-text">{currency(estimate)}</span>
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={submit.isPending}>
                  {submit.isPending ? "Sending…" : "Request booking"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  No payment now — the front desk confirms availability first.
                </p>
              </div>
            </Panel>
          </form>
        )}
      </main>
    </div>
  );
}
