/** Live availability + revenue snapshot shared by the booking form, the booking API and the concierge. */

const BLOCKING_STATUSES = ["pending", "confirmed", "checked_in"] as const;

export type TypeAvailability = {
  room_type_id: string;
  code: string;
  name: string;
  base_rate: number;
  max_occupancy: number;
  total_rooms: number;
  booked_rooms: number;
  available_rooms: number;
};

export async function computeAvailability(checkIn: string, checkOut: string): Promise<TypeAvailability[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [typesResult, roomsResult, reservationsResult] = await Promise.all([
    supabaseAdmin.from("room_types").select("id,code,name,base_rate,max_occupancy").order("base_rate"),
    supabaseAdmin.from("rooms").select("id,room_type_id,is_active,condition"),
    supabaseAdmin
      .from("reservations")
      .select("room_type_id,check_in,check_out,status")
      .in("status", BLOCKING_STATUSES as unknown as string[])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn),
  ]);

  const rooms = roomsResult.data ?? [];
  const reservations = reservationsResult.data ?? [];

  return (typesResult.data ?? []).map((type) => {
    const total = rooms.filter(
      (room) => room.room_type_id === type.id && room.is_active && room.condition !== "out_of_order",
    ).length;
    const booked = reservations.filter((reservation) => reservation.room_type_id === type.id).length;
    return {
      room_type_id: type.id,
      code: type.code,
      name: type.name,
      base_rate: Number(type.base_rate),
      max_occupancy: type.max_occupancy,
      total_rooms: total,
      booked_rooms: booked,
      available_rooms: Math.max(0, total - booked),
    };
  });
}

/** Aggregate hotel state (no guest PII) used to ground the concierge. */
export async function loadHotelOperationsSnapshot() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [tonight, roomsResult, upcoming] = await Promise.all([
    computeAvailability(today, tomorrow),
    supabaseAdmin.from("rooms").select("room_number,floor,condition,is_active,notes,room_types(name,code)"),
    supabaseAdmin
      .from("reservations")
      .select("check_in,check_out,status,total_amount,room_types(name)")
      .gte("check_out", today)
      .lte("check_in", horizon),
  ]);

  const reservations = upcoming.data ?? [];
  const revenueOnBooks = reservations
    .filter((row) => row.status !== "cancelled" && row.status !== "no_show")
    .reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

  return {
    today,
    currency: "NPR",
    availability_tonight: tonight,
    occupancy_tonight_percent: (() => {
      const total = tonight.reduce((sum, row) => sum + row.total_rooms, 0);
      const booked = tonight.reduce((sum, row) => sum + row.booked_rooms, 0);
      return total ? Math.round((booked / total) * 100) : 0;
    })(),
    rooms: (roomsResult.data ?? []).map((room) => ({
      room_number: room.room_number,
      floor: room.floor,
      category: room.room_types?.name ?? null,
      bookable: room.is_active && room.condition !== "out_of_order",
      specification: room.notes,
    })),
    bookings_next_30_days: reservations.length,
    revenue_on_books_next_30_days: Math.round(revenueOnBooks),
  };
}
