import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type RoomType = {
  id: string;
  code: string;
  name: string;
  description: string;
  base_rate: number;
  max_occupancy: number;
  amenities: string[];
};

export type Room = {
  id: string;
  room_number: string;
  floor: number;
  condition: string;
  is_active: boolean;
  notes: string;
  room_type_id: string;
  room_types: Pick<RoomType, "code" | "name" | "base_rate"> | null;
};

export type Guest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  is_vip: boolean;
  loyalty_tier: string;
  notes: string;
};

export type Reservation = {
  id: string;
  reference: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  nightly_rate: number;
  total_amount: number;
  balance_due: number;
  status: string;
  channel: string;
  special_requests: string;
  guest_id: string;
  room_id: string | null;
  room_type_id: string;
  guests: Pick<Guest, "full_name" | "email" | "is_vip" | "loyalty_tier"> | null;
  rooms: { room_number: string } | null;
  room_types: { name: string; code: string } | null;
};

export type HousekeepingTask = {
  id: string;
  task_type: string;
  priority: number;
  status: string;
  notes: string;
  room_id: string;
  rooms: { room_number: string; floor: number } | null;
};

export type AiAction = {
  id: string;
  action_type: string;
  summary: string;
  reasoning: string;
  confidence: number;
  status: string;
  created_at: string;
};

/** Throws Supabase errors so route error boundaries and Query can surface them. */
function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const roomTypesQuery = queryOptions({
  queryKey: ["room_types"],
  queryFn: async () =>
    unwrap<RoomType[]>(await supabase.from("room_types").select("*").order("base_rate")),
});

export const roomsQuery = queryOptions({
  queryKey: ["rooms"],
  queryFn: async () =>
    unwrap<Room[]>(
      await supabase
        .from("rooms")
        .select("*, room_types(code,name,base_rate)")
        .order("room_number"),
    ),
});

export const guestsQuery = queryOptions({
  queryKey: ["guests"],
  queryFn: async () => unwrap<Guest[]>(await supabase.from("guests").select("*").order("full_name")),
});

export const reservationsQuery = queryOptions({
  queryKey: ["reservations"],
  queryFn: async () =>
    unwrap<Reservation[]>(
      await supabase
        .from("reservations")
        .select(
          "*, guests(full_name,email,is_vip,loyalty_tier), rooms(room_number), room_types(name,code)",
        )
        .order("check_in"),
    ),
});

export const housekeepingQuery = queryOptions({
  queryKey: ["housekeeping"],
  queryFn: async () =>
    unwrap<HousekeepingTask[]>(
      await supabase
        .from("housekeeping_tasks")
        .select("*, rooms(room_number,floor)")
        .order("priority"),
    ),
});

export const aiActionsQuery = queryOptions({
  queryKey: ["ai_actions"],
  queryFn: async () =>
    unwrap<AiAction[]>(
      await supabase.from("ai_actions").select("*").order("created_at", { ascending: false }),
    ),
});

/** Roles of the signed-in staff member; used to gate edit affordances (RLS still enforces). */
export const myRolesQuery = queryOptions({
  queryKey: ["my_roles"],
  queryFn: async (): Promise<string[]> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
    return (data ?? []).map((row) => row.role as string);
  },
});

/** Writes an audit trail entry; every mutating UI action calls this. */
export async function logAudit(
  entity: string,
  entityId: string | null,
  action: string,
  details: Record<string, string | number | boolean | null> = {},
) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    actor: data.user?.id ?? null,
    actor_label: data.user?.email ?? "system",
    entity,
    entity_id: entityId,
    action,
    details,
  });
}