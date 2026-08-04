import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BookingInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255).or(z.literal("")),
  phone: z.string().trim().max(40),
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(8),
  children: z.number().int().min(0).max(8),
  requests: z.string().trim().max(600).default(""),
});

export type PublicRoomType = {
  id: string;
  code: string;
  name: string;
  description: string;
  base_rate: number;
  max_occupancy: number;
  amenities: string[];
};

/** Public room catalogue for the guest booking screen. */
export const listPublicRoomTypes = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicRoomType[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("room_types")
      .select("id,code,name,description,base_rate,max_occupancy,amenities")
      .order("base_rate");
    return (data ?? []) as PublicRoomType[];
  },
);

/** Creates a pending booking request from an anonymous guest — staff confirm it. */
export const submitGuestBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BookingInput.parse(input))
  .handler(async ({ data }): Promise<{ reference: string; nights: number; total: number }> => {
    const checkIn = new Date(`${data.checkIn}T00:00:00Z`);
    const checkOut = new Date(`${data.checkOut}T00:00:00Z`);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
    if (nights < 1) throw new Error("Check-out must be at least one night after check-in.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roomType } = await supabaseAdmin
      .from("room_types")
      .select("id,base_rate,max_occupancy")
      .eq("id", data.roomTypeId)
      .maybeSingle();
    if (!roomType) throw new Error("That room type is no longer available.");
    if (data.adults + data.children > roomType.max_occupancy) {
      throw new Error(`This room sleeps up to ${roomType.max_occupancy} guests.`);
    }

    let guestId: string | null = null;
    if (data.email) {
      const { data: existing } = await supabaseAdmin
        .from("guests")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      guestId = existing?.id ?? null;
    }
    if (!guestId) {
      const { data: created, error } = await supabaseAdmin
        .from("guests")
        .insert({
          full_name: data.fullName,
          email: data.email || null,
          phone: data.phone || null,
          notes: "Created from the in-app guest booking form.",
        })
        .select("id")
        .single();
      if (error) throw new Error("We could not save your details. Please try again.");
      guestId = created.id;
    }

    const total = Number(roomType.base_rate) * nights;
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from("reservations")
      .insert({
        guest_id: guestId,
        room_type_id: data.roomTypeId,
        check_in: data.checkIn,
        check_out: data.checkOut,
        adults: data.adults,
        children: data.children,
        nightly_rate: roomType.base_rate,
        total_amount: total,
        balance_due: total,
        status: "pending",
        channel: "guest_app",
        special_requests: data.requests,
      })
      .select("reference")
      .single();
    if (reservationError) throw new Error("We could not create your booking request. Please try again.");

    await supabaseAdmin.from("audit_logs").insert({
      actor_label: "guest_app",
      entity: "reservation",
      action: "booking_requested",
      details: { reference: reservation.reference, nights, channel: "guest_app" },
    });

    return { reference: reservation.reference, nights, total };
  });
