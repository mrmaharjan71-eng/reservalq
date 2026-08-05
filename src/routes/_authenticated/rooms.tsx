import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, Field, Panel, SkeletonRows, inputClass, statusTone } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { currency, titleCase } from "@/lib/format";
import {
  logAudit,
  myRolesQuery,
  reservationsQuery,
  roomTypesQuery,
  roomsQuery,
  type Room,
  type RoomType,
} from "@/lib/hotel-data";
import type { Database } from "@/integrations/supabase/types";

type RoomCondition = Database["public"]["Enums"]["room_condition"];
const CONDITIONS: RoomCondition[] = ["clean", "dirty", "inspected", "out_of_order"];
const EDIT_ROLES = ["owner", "admin", "front_desk_manager"];

const service = z.string().trim().min(1).max(40);
const categorySchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400),
  base_rate: z.number().min(0).max(10_000_000),
  max_occupancy: z.number().int().min(1).max(10),
  amenities: z.array(service).max(40),
});
const roomSchema = z.object({
  room_number: z.string().trim().min(1).max(12),
  floor: z.number().int().min(0).max(120),
  room_type_id: z.string().uuid(),
  is_active: z.boolean(),
  notes: z.string().trim().max(400),
});

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms & Inventory — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content: "Room inventory by floor with live cleaning status, editable specifications and services.",
      },
      { property: "og:title", content: "Rooms & Inventory — ReservalQ AI Hotel Management" },
      { property: "og:description", content: "Live room status board and room specification editor." },
    ],
  }),
  component: RoomsPage,
});

function ServiceEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const parsed = service.safeParse(draft);
    if (!parsed.success) return;
    if (values.includes(parsed.data)) {
      setDraft("");
      return;
    }
    onChange([...values, parsed.data]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">No services listed yet.</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={inputClass}
          value={draft}
          maxLength={40}
          placeholder="Add a service (e.g. Airport pickup)"
          aria-label="Add a service"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="ghost" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
}: {
  initial: Partial<RoomType>;
  submitLabel: string;
  onSubmit: (values: z.infer<typeof categorySchema>) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [code, setCode] = useState(initial.code ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [rate, setRate] = useState(String(initial.base_rate ?? 0));
  const [occupancy, setOccupancy] = useState(String(initial.max_occupancy ?? 2));
  const [amenities, setAmenities] = useState<string[]>(initial.amenities ?? []);

  function submit() {
    const parsed = categorySchema.safeParse({
      code,
      name,
      description,
      base_rate: Number(rate),
      max_occupancy: Number(occupancy),
      amenities,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the category details.");
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-elevated p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category code">
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Category name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Base rate per night">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </Field>
        <Field label="Max occupancy">
          <input
            className={inputClass}
            type="number"
            min={1}
            max={10}
            value={occupancy}
            onChange={(e) => setOccupancy(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Specification">
        <textarea
          className={`${inputClass} min-h-20`}
          value={description}
          maxLength={400}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bed configuration, size, view, in-room facilities…"
        />
      </Field>
      <Field label="Services & amenities">
        <ServiceEditor values={amenities} onChange={setAmenities} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RoomForm({
  room,
  roomTypes,
  onSubmit,
  onCancel,
  pending,
}: {
  room: Room;
  roomTypes: RoomType[];
  onSubmit: (values: z.infer<typeof roomSchema>) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [roomNumber, setRoomNumber] = useState(room.room_number);
  const [floor, setFloor] = useState(String(room.floor));
  const [typeId, setTypeId] = useState(room.room_type_id);
  const [isActive, setIsActive] = useState(room.is_active);
  const [notes, setNotes] = useState(room.notes ?? "");

  function submit() {
    const parsed = roomSchema.safeParse({
      room_number: roomNumber,
      floor: Number(floor),
      room_type_id: typeId,
      is_active: isActive,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the room details.");
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Room number">
          <input className={inputClass} value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
        </Field>
        <Field label="Floor">
          <input className={inputClass} type="number" value={floor} onChange={(e) => setFloor(e.target.value)} />
        </Field>
      </div>
      <Field label="Category">
        <select className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {roomTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Room specification notes">
        <textarea
          className={`${inputClass} min-h-16`}
          value={notes}
          maxLength={400}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Corner unit, garden view, accessible bathroom…"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Bookable
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save room"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RoomsPage() {
  const queryClient = useQueryClient();
  const rooms = useQuery(roomsQuery);
  const roomTypes = useQuery(roomTypesQuery);
  const reservations = useQuery(reservationsQuery);
  const roles = useQuery(myRolesQuery);

  const canEdit = (roles.data ?? []).some((role) => EDIT_ROLES.includes(role));
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const occupiedBy = new Map(
    (reservations.data ?? [])
      .filter((reservation) => reservation.status === "checked_in" && reservation.room_id)
      .map((reservation) => [reservation.room_id as string, reservation.guests?.full_name ?? "In house"]),
  );

  const setCondition = useMutation({
    mutationFn: async ({ roomId, condition }: { roomId: string; condition: RoomCondition }) => {
      const { error } = await supabase.from("rooms").update({ condition }).eq("id", roomId);
      if (error) throw new Error(error.message);
      await logAudit("room", roomId, `condition:${condition}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveRoom = useMutation({
    mutationFn: async ({ roomId, values }: { roomId: string; values: z.infer<typeof roomSchema> }) => {
      const { error } = await supabase.from("rooms").update(values).eq("id", roomId);
      if (error) throw new Error(error.message);
      await logAudit("room", roomId, "room:updated", { room_number: values.room_number });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingRoom(null);
      toast.success("Room details saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveCategory = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: z.infer<typeof categorySchema> }) => {
      const { error } = await supabase.from("room_types").update(values).eq("id", id);
      if (error) throw new Error(error.message);
      await logAudit("room_type", id, "room_type:updated", { name: values.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room_types"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditingCategory(null);
      toast.success("Room category updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createCategory = useMutation({
    mutationFn: async (values: z.infer<typeof categorySchema>) => {
      const { data, error } = await supabase.from("room_types").insert(values).select("id").single();
      if (error) throw new Error(error.message);
      await logAudit("room_type", data.id, "room_type:created", { name: values.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room_types"] });
      setCreatingCategory(false);
      toast.success("Room category added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const floors = [...new Set((rooms.data ?? []).map((room) => room.floor))].sort();

  return (
    <AppShell
      title="Rooms & inventory"
      subtitle="Housekeeping condition, occupancy and editable room specifications"
    >
      {rooms.isPending ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-5">
          {floors.map((floor) => (
            <Panel
              key={floor}
              title={`Floor ${floor}`}
              description={`${(rooms.data ?? []).filter((r) => r.floor === floor).length} rooms`}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(rooms.data ?? [])
                  .filter((room) => room.floor === floor)
                  .map((room) => (
                    <article key={room.id} className="rounded-md border border-border bg-surface-elevated p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display text-lg">Room {room.room_number}</p>
                          <p className="text-xs text-muted-foreground">{room.room_types?.name}</p>
                        </div>
                        <Badge tone={statusTone(room.condition)}>{titleCase(room.condition)}</Badge>
                      </div>
                      <p className="mt-3 text-sm">
                        {occupiedBy.get(room.id) ? (
                          <span className="text-foreground">Occupied · {occupiedBy.get(room.id)}</span>
                        ) : (
                          <span className="text-muted-foreground">Vacant</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currency(room.room_types?.base_rate ?? 0)} / night
                      </p>
                      {room.notes && <p className="mt-2 text-xs text-muted-foreground">{room.notes}</p>}
                      {!room.is_active && (
                        <p className="mt-2 text-xs text-muted-foreground">Not bookable</p>
                      )}
                      <select
                        className={`${inputClass} mt-3`}
                        value={room.condition}
                        onChange={(event) =>
                          setCondition.mutate({
                            roomId: room.id,
                            condition: event.target.value as RoomCondition,
                          })
                        }
                        aria-label={`Condition for room ${room.room_number}`}
                      >
                        {CONDITIONS.map((condition) => (
                          <option key={condition} value={condition}>
                            {titleCase(condition)}
                          </option>
                        ))}
                      </select>

                      {canEdit &&
                        (editingRoom === room.id ? (
                          <RoomForm
                            room={room}
                            roomTypes={roomTypes.data ?? []}
                            pending={saveRoom.isPending}
                            onCancel={() => setEditingRoom(null)}
                            onSubmit={(values) => saveRoom.mutate({ roomId: room.id, values })}
                          />
                        ) : (
                          <Button
                            className="mt-3"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRoom(room.id)}
                          >
                            <Pencil className="size-3.5" aria-hidden /> Edit details
                          </Button>
                        ))}
                    </article>
                  ))}
              </div>
            </Panel>
          ))}

          <Panel
            title="Room categories, specifications & services"
            description="Published rates, room specification and the services included with each category"
          >
            {canEdit && (
              <div className="mb-4">
                {creatingCategory ? (
                  <CategoryForm
                    initial={{}}
                    submitLabel="Create category"
                    pending={createCategory.isPending}
                    onCancel={() => setCreatingCategory(false)}
                    onSubmit={(values) => createCategory.mutate(values)}
                  />
                ) : (
                  <Button size="sm" onClick={() => setCreatingCategory(true)}>
                    <Plus className="size-3.5" aria-hidden /> Add category
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3">
              {(roomTypes.data ?? []).map((type) =>
                canEdit && editingCategory === type.id ? (
                  <CategoryForm
                    key={type.id}
                    initial={type}
                    submitLabel="Save category"
                    pending={saveCategory.isPending}
                    onCancel={() => setEditingCategory(null)}
                    onSubmit={(values) => saveCategory.mutate({ id: type.id, values })}
                  />
                ) : (
                  <article
                    key={type.id}
                    className="rounded-md border border-border bg-surface-elevated p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{type.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{type.description}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{currency(type.base_rate)} / night</p>
                        <p className="text-xs text-muted-foreground">Sleeps {type.max_occupancy}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {type.amenities.map((amenity) => (
                        <Badge key={amenity}>{amenity}</Badge>
                      ))}
                    </div>
                    {canEdit && (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCategory(type.id)}
                      >
                        <Pencil className="size-3.5" aria-hidden /> Edit specification & services
                      </Button>
                    )}
                  </article>
                ),
              )}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
