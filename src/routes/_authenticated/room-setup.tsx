import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, Field, Panel, SkeletonRows, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { currency } from "@/lib/format";
import { logAudit, myRolesQuery, roomTypesQuery, roomsQuery } from "@/lib/hotel-data";

const EDIT_ROLES = ["owner", "admin", "front_desk_manager"];

const serviceSchema = z.string().trim().min(1).max(40);
const categorySchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(400),
  base_rate: z.number().min(0).max(10_000_000),
  max_occupancy: z.number().int().min(1).max(10),
  amenities: z.array(serviceSchema).max(40),
});
const roomSchema = z.object({
  room_number: z.string().trim().min(1).max(12),
  floor: z.number().int().min(0).max(120),
  room_type_id: z.string().uuid("Choose a room category"),
  is_active: z.boolean(),
  notes: z.string().trim().max(400),
});

export const Route = createFileRoute("/_authenticated/room-setup")({
  head: () => ({
    meta: [
      { title: "Room Setup — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content:
          "Add hotel room categories, rates, services and individual rooms. Everything entered here powers guest booking availability and the AI concierge.",
      },
      { property: "og:title", content: "Room Setup — ReservalQ AI Hotel Management" },
      {
        property: "og:description",
        content: "Owner and manager workspace for uploading full hotel room details.",
      },
    ],
  }),
  component: RoomSetupPage,
});

function ServiceEditor({ values, onChange }: { values: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const parsed = serviceSchema.safeParse(draft);
    if (!parsed.success) return;
    if (!values.includes(parsed.data)) onChange([...values, parsed.data]);
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
        {values.length === 0 && <span className="text-xs text-muted-foreground">No services yet.</span>}
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

function RoomSetupPage() {
  const queryClient = useQueryClient();
  const rooms = useQuery(roomsQuery);
  const roomTypes = useQuery(roomTypesQuery);
  const roles = useQuery(myRolesQuery);
  const canEdit = (roles.data ?? []).some((role) => EDIT_ROLES.includes(role));

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("0");
  const [occupancy, setOccupancy] = useState("2");
  const [amenities, setAmenities] = useState<string[]>([]);

  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState("1");
  const [typeId, setTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [bookable, setBookable] = useState(true);

  const createCategory = useMutation({
    mutationFn: async (values: z.infer<typeof categorySchema>) => {
      const { data, error } = await supabase.from("room_types").insert(values).select("id").single();
      if (error) throw new Error(error.message);
      await logAudit("room_type", data.id, "room_type:created", { name: values.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["room_types"] });
      setCode("");
      setName("");
      setDescription("");
      setRate("0");
      setOccupancy("2");
      setAmenities([]);
      toast.success("Room category added — guests can now book it");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createRoom = useMutation({
    mutationFn: async (values: z.infer<typeof roomSchema>) => {
      const { data, error } = await supabase.from("rooms").insert(values).select("id").single();
      if (error) throw new Error(error.message);
      await logAudit("room", data.id, "room:created", { room_number: values.room_number });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setRoomNumber("");
      setNotes("");
      toast.success("Room added to inventory");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRoom = useMutation({
    mutationFn: async (roomId: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", roomId);
      if (error) throw new Error(error.message);
      await logAudit("room", roomId, "room:deleted");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Room removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!canEdit) {
    return (
      <AppShell title="Room setup" subtitle="Owner and manager access only">
        <Panel title="Restricted">
          <p className="text-sm text-muted-foreground">
            Only the owner, administrators and front desk managers can upload hotel room details.
          </p>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Room setup"
      subtitle="Upload every room category, rate, service and physical room — this data drives booking availability and the AI concierge"
    >
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Add a room category"
          description="Specification, nightly rate, occupancy and the services included"
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = categorySchema.safeParse({
                code,
                name,
                description,
                base_rate: Number(rate),
                max_occupancy: Number(occupancy),
                amenities,
              });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Check the category details.");
                return;
              }
              createCategory.mutate(parsed.data);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category code">
                <input
                  className={inputClass}
                  value={code}
                  maxLength={20}
                  required
                  placeholder="DLX"
                  onChange={(event) => setCode(event.target.value)}
                />
              </Field>
              <Field label="Category name">
                <input
                  className={inputClass}
                  value={name}
                  maxLength={80}
                  required
                  placeholder="Deluxe King"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Base rate per night (NPR)">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
              </Field>
              <Field label="Max occupancy">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={10}
                  value={occupancy}
                  onChange={(event) => setOccupancy(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Specification">
              <textarea
                className={`${inputClass} min-h-20`}
                value={description}
                maxLength={400}
                placeholder="Bed configuration, size, view, in-room facilities…"
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field label="Services & amenities">
              <ServiceEditor values={amenities} onChange={setAmenities} />
            </Field>
            <Button type="submit" disabled={createCategory.isPending}>
              <Plus className="size-3.5" aria-hidden />
              {createCategory.isPending ? "Saving…" : "Add category"}
            </Button>
          </form>
        </Panel>

        <Panel title="Add a room" description="Each physical room counts towards live booking availability">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = roomSchema.safeParse({
                room_number: roomNumber,
                floor: Number(floor),
                room_type_id: typeId,
                is_active: bookable,
                notes,
              });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Check the room details.");
                return;
              }
              createRoom.mutate(parsed.data);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Room number">
                <input
                  className={inputClass}
                  value={roomNumber}
                  maxLength={12}
                  required
                  placeholder="204"
                  onChange={(event) => setRoomNumber(event.target.value)}
                />
              </Field>
              <Field label="Floor">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={floor}
                  onChange={(event) => setFloor(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                className={inputClass}
                value={typeId}
                required
                onChange={(event) => setTypeId(event.target.value)}
              >
                <option value="">Select a category…</option>
                {(roomTypes.data ?? []).map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} · {currency(type.base_rate)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room specification notes">
              <textarea
                className={`${inputClass} min-h-16`}
                value={notes}
                maxLength={400}
                placeholder="Corner unit, garden view, accessible bathroom…"
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bookable}
                onChange={(event) => setBookable(event.target.checked)}
              />
              Bookable by guests
            </label>
            <Button type="submit" disabled={createRoom.isPending}>
              <Plus className="size-3.5" aria-hidden />
              {createRoom.isPending ? "Saving…" : "Add room"}
            </Button>
          </form>
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title="Current inventory"
        description="Rooms the booking engine and concierge can offer"
      >
        {rooms.isPending ? (
          <SkeletonRows rows={4} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(rooms.data ?? []).map((room) => (
              <article key={room.id} className="rounded-md border border-border bg-surface-elevated p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg">Room {room.room_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Floor {room.floor} · {room.room_types?.name}
                    </p>
                  </div>
                  <Badge tone={room.is_active ? "success" : "neutral"}>
                    {room.is_active ? "Bookable" : "Off market"}
                  </Badge>
                </div>
                {room.notes && <p className="mt-2 text-xs text-muted-foreground">{room.notes}</p>}
                <Button
                  className="mt-3"
                  size="sm"
                  variant="ghost"
                  disabled={removeRoom.isPending}
                  onClick={() => removeRoom.mutate(room.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden /> Remove
                </Button>
              </article>
            ))}
            {(rooms.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No rooms yet — add your first room above.</p>
            )}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
