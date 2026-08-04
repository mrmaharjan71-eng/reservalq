import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge, Panel, SkeletonRows, inputClass, statusTone } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { currency, titleCase } from "@/lib/format";
import { logAudit, reservationsQuery, roomTypesQuery, roomsQuery } from "@/lib/hotel-data";
import type { Database } from "@/integrations/supabase/types";

type RoomCondition = Database["public"]["Enums"]["room_condition"];
const CONDITIONS: RoomCondition[] = ["clean", "dirty", "inspected", "out_of_order"];

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms & Inventory — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content: "Room inventory by floor with live cleaning status, occupancy and rate plan detail.",
      },
      { property: "og:title", content: "Rooms & Inventory — ReservalQ AI Hotel Management" },
      { property: "og:description", content: "Live room status board across every floor of the hotel." },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const queryClient = useQueryClient();
  const rooms = useQuery(roomsQuery);
  const roomTypes = useQuery(roomTypesQuery);
  const reservations = useQuery(reservationsQuery);

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

  const floors = [...new Set((rooms.data ?? []).map((room) => room.floor))].sort();

  return (
    <AppShell title="Rooms & inventory" subtitle="Housekeeping condition and occupancy across every floor">
      {rooms.isPending ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="space-y-5">
          {floors.map((floor) => (
            <Panel key={floor} title={`Floor ${floor}`} description={`${(rooms.data ?? []).filter((r) => r.floor === floor).length} rooms`}>
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
                    </article>
                  ))}
              </div>
            </Panel>
          ))}

          <Panel title="Rate plan" description="Published base rates by room category">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium">Base rate</th>
                    <th className="pb-3 font-medium">Max occupancy</th>
                    <th className="pb-3 font-medium">Amenities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(roomTypes.data ?? []).map((type) => (
                    <tr key={type.id}>
                      <td className="py-3">
                        <p className="font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </td>
                      <td className="py-3">{currency(type.base_rate)}</td>
                      <td className="py-3">{type.max_occupancy}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {type.amenities.map((amenity) => (
                            <Badge key={amenity}>{amenity}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}