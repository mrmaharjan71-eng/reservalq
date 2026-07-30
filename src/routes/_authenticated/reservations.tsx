import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, EmptyState, Field, Panel, SkeletonRows, inputClass, statusTone } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { currency, nightsBetween, shortDate, titleCase, todayISO } from "@/lib/format";
import {
  guestsQuery,
  logAudit,
  reservationsQuery,
  roomTypesQuery,
  roomsQuery,
  type Reservation,
} from "@/lib/hotel-data";

export const Route = createFileRoute("/_authenticated/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — Aurelia AI Hotel Management" },
      {
        name: "description",
        content:
          "Create bookings, assign rooms, check guests in and out, and track balances across every channel.",
      },
      { property: "og:title", content: "Reservations — Aurelia AI Hotel Management" },
      { property: "og:description", content: "Full reservation lifecycle management for the front desk." },
    ],
  }),
  component: ReservationsPage,
});

const STATUS_FILTERS = ["all", "pending", "confirmed", "checked_in", "checked_out", "cancelled"] as const;

function ReservationsPage() {
  const queryClient = useQueryClient();
  const reservations = useQuery(reservationsQuery);
  const rooms = useQuery(roomsQuery);
  const roomTypes = useQuery(roomTypesQuery);
  const guests = useQuery(guestsQuery);

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (reservations.data ?? []).filter((reservation) => {
      const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
      const matchesSearch =
        !term ||
        reservation.reference.toLowerCase().includes(term) ||
        (reservation.guests?.full_name ?? "").toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [reservations.data, statusFilter, search]);

  const updateStatus = useMutation({
    mutationFn: async ({ reservation, status }: { reservation: Reservation; status: string }) => {
      const { error } = await supabase.from("reservations").update({ status }).eq("id", reservation.id);
      if (error) throw new Error(error.message);

      if (status === "checked_in" && reservation.room_id) {
        await supabase.from("rooms").update({ condition: "clean" }).eq("id", reservation.room_id);
      }
      if (status === "checked_out" && reservation.room_id) {
        await supabase.from("rooms").update({ condition: "dirty" }).eq("id", reservation.room_id);
        await supabase.from("housekeeping_tasks").insert({
          room_id: reservation.room_id,
          task_type: "departure_clean",
          priority: 1,
          notes: `Departure clean after ${reservation.reference}`,
        });
      }
      await logAudit("reservation", reservation.id, `status:${status}`, { reference: reservation.reference });
    },
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(`${variables.reservation.reference} set to ${titleCase(variables.status)}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignRoom = useMutation({
    mutationFn: async ({ reservation, roomId }: { reservation: Reservation; roomId: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ room_id: roomId || null })
        .eq("id", reservation.id);
      if (error) throw new Error(error.message);
      await logAudit("reservation", reservation.id, "assign_room", { room_id: roomId });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Room assigned");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Rooms that are active and not occupied by another in-house reservation. */
  const availableRooms = (roomTypeId: string) => {
    const occupied = new Set(
      (reservations.data ?? [])
        .filter((r) => r.status === "checked_in" && r.room_id)
        .map((r) => r.room_id as string),
    );
    return (rooms.data ?? []).filter(
      (room) =>
        room.is_active &&
        room.condition !== "out_of_order" &&
        room.room_type_id === roomTypeId &&
        !occupied.has(room.id),
    );
  };

  return (
    <AppShell title="Reservations" subtitle="Booking lifecycle from enquiry through to departure">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Search reference or guest…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search reservations"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "primary" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {titleCase(status)}
            </Button>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => setShowForm((open) => !open)}>
          {showForm ? "Close" : "New reservation"}
        </Button>
      </div>

      {showForm && (
        <NewReservationForm
          guests={guests.data ?? []}
          roomTypes={roomTypes.data ?? []}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["reservations"] });
            queryClient.invalidateQueries({ queryKey: ["guests"] });
          }}
        />
      )}

      <Panel className="mt-5" title={`${filtered.length} reservations`} description="Sorted by arrival date">
        {reservations.isPending ? (
          <SkeletonRows rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No reservations match" description="Adjust the filters or create a new booking." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="pb-3 font-medium">Guest</th>
                  <th className="pb-3 font-medium">Stay</th>
                  <th className="pb-3 font-medium">Room</th>
                  <th className="pb-3 font-medium">Balance</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="py-3">
                      <p className="font-medium">
                        {reservation.guests?.full_name}{" "}
                        {reservation.guests?.is_vip && <Badge tone="brass">VIP</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reservation.reference} · {titleCase(reservation.channel)}
                      </p>
                    </td>
                    <td className="py-3">
                      {shortDate(reservation.check_in)} → {shortDate(reservation.check_out)}
                      <p className="text-xs text-muted-foreground">
                        {nightsBetween(reservation.check_in, reservation.check_out)} nights ·{" "}
                        {reservation.adults + reservation.children} guests
                      </p>
                    </td>
                    <td className="py-3">
                      <select
                        className={`${inputClass} min-w-[9rem]`}
                        value={reservation.room_id ?? ""}
                        onChange={(event) =>
                          assignRoom.mutate({ reservation, roomId: event.target.value })
                        }
                        aria-label={`Assign room for ${reservation.reference}`}
                      >
                        <option value="">Unassigned</option>
                        {reservation.room_id && reservation.rooms && (
                          <option value={reservation.room_id}>Room {reservation.rooms.room_number}</option>
                        )}
                        {availableRooms(reservation.room_type_id)
                          .filter((room) => room.id !== reservation.room_id)
                          .map((room) => (
                            <option key={room.id} value={room.id}>
                              Room {room.room_number} · {titleCase(room.condition)}
                            </option>
                          ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">{reservation.room_types?.name}</p>
                    </td>
                    <td className="py-3">
                      {currency(reservation.balance_due)}
                      <p className="text-xs text-muted-foreground">of {currency(reservation.total_amount)}</p>
                    </td>
                    <td className="py-3">
                      <Badge tone={statusTone(reservation.status)}>{titleCase(reservation.status)}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {reservation.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus.mutate({ reservation, status: "confirmed" })}
                          >
                            Confirm
                          </Button>
                        )}
                        {reservation.status === "confirmed" && (
                          <Button
                            size="sm"
                            disabled={!reservation.room_id}
                            title={reservation.room_id ? undefined : "Assign a room first"}
                            onClick={() => updateStatus.mutate({ reservation, status: "checked_in" })}
                          >
                            Check in
                          </Button>
                        )}
                        {reservation.status === "checked_in" && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus.mutate({ reservation, status: "checked_out" })}
                          >
                            Check out
                          </Button>
                        )}
                        {["pending", "confirmed"].includes(reservation.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus.mutate({ reservation, status: "cancelled" })}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function NewReservationForm({
  guests,
  roomTypes,
  onCreated,
}: {
  guests: { id: string; full_name: string }[];
  roomTypes: { id: string; name: string; base_rate: number }[];
  onCreated: () => void;
}) {
  const [guestId, setGuestId] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState(todayISO());
  const [checkOut, setCheckOut] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
  });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [requests, setRequests] = useState("");

  const selectedType = roomTypes.find((type) => type.id === roomTypeId);
  const nights = nightsBetween(checkIn, checkOut);
  const total = Number(selectedType?.base_rate ?? 0) * nights;

  const create = useMutation({
    mutationFn: async () => {
      if (new Date(checkOut) <= new Date(checkIn)) throw new Error("Check-out must be after check-in.");
      if (!roomTypeId) throw new Error("Choose a room type.");

      let finalGuestId = guestId;
      if (!finalGuestId) {
        if (!newGuestName.trim()) throw new Error("Choose an existing guest or enter a new guest name.");
        const { data, error } = await supabase
          .from("guests")
          .insert({ full_name: newGuestName.trim(), email: newGuestEmail.trim() || null })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        finalGuestId = data.id;
      }

      const rate = Number(selectedType?.base_rate ?? 0);
      const { data, error } = await supabase
        .from("reservations")
        .insert({
          guest_id: finalGuestId,
          room_type_id: roomTypeId,
          check_in: checkIn,
          check_out: checkOut,
          adults,
          children,
          nightly_rate: rate,
          total_amount: rate * nights,
          balance_due: rate * nights,
          status: "confirmed",
          channel: "front_desk",
          special_requests: requests,
        })
        .select("id, reference")
        .single();
      if (error) throw new Error(error.message);
      await logAudit("reservation", data.id, "created", { reference: data.reference });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Reservation ${data.reference} created`);
      onCreated();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel title="New reservation" description="Walk-in or phone booking">
      <form
        className="grid gap-4 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Existing guest">
          <select className={inputClass} value={guestId} onChange={(event) => setGuestId(event.target.value)}>
            <option value="">— New guest —</option>
            {guests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New guest name">
          <input
            className={inputClass}
            value={newGuestName}
            onChange={(event) => setNewGuestName(event.target.value)}
            disabled={Boolean(guestId)}
            maxLength={100}
          />
        </Field>
        <Field label="New guest email">
          <input
            className={inputClass}
            type="email"
            value={newGuestEmail}
            onChange={(event) => setNewGuestEmail(event.target.value)}
            disabled={Boolean(guestId)}
            maxLength={255}
          />
        </Field>
        <Field label="Room type">
          <select
            className={inputClass}
            value={roomTypeId}
            onChange={(event) => setRoomTypeId(event.target.value)}
          >
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} · {currency(type.base_rate)}/night
              </option>
            ))}
          </select>
        </Field>
        <Field label="Check-in">
          <input
            className={inputClass}
            type="date"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
          />
        </Field>
        <Field label="Check-out">
          <input
            className={inputClass}
            type="date"
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
          />
        </Field>
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
            max={6}
            value={children}
            onChange={(event) => setChildren(Number(event.target.value))}
          />
        </Field>
        <Field label="Special requests">
          <input
            className={inputClass}
            value={requests}
            onChange={(event) => setRequests(event.target.value)}
            maxLength={300}
          />
        </Field>
        <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {nights} nights · quoted total{" "}
            <span className="font-medium text-foreground">{currency(total)}</span>
          </p>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create reservation"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}