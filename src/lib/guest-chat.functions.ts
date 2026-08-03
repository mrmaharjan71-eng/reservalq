import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { GUEST_SYSTEM_PROMPT, loadHotelCatalogue } from "./guest-chat.server";

const StartInput = z.object({
  guestLabel: z.string().trim().max(60).default(""),
  reference: z.string().trim().max(40).default(""),
});

const SendInput = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(800),
});

export type GuestChatTurn = { role: "guest" | "assistant"; content: string };

/** Creates an anonymous guest chat session — no email, no account. */
export const startGuestChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data }): Promise<{ sessionId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("guest_chat_sessions")
      .insert({ guest_label: data.guestLabel || "Guest", reference: data.reference })
      .select("id")
      .single();
    if (error) throw new Error("Could not start the chat. Please try again.");
    return { sessionId: session.id };
  });

/** Stores the guest message, answers with the concierge model, stores the reply. */
export const sendGuestChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("The concierge is offline right now.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("guest_chat_sessions")
      .select("id")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("This conversation has expired. Please start a new chat.");

    const { data: history } = await supabaseAdmin
      .from("guest_chat_messages")
      .select("role,content")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(16);

    await supabaseAdmin
      .from("guest_chat_messages")
      .insert({ session_id: data.sessionId, role: "guest", content: data.message });

    const catalogue = await loadHotelCatalogue();
    const priorTurns = (history ?? [])
      .slice()
      .reverse()
      .map((row) => ({
        role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: row.content,
      }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: GUEST_SYSTEM_PROMPT },
          { role: "system", content: `Hotel catalogue (rates in NPR):\n${JSON.stringify(catalogue)}` },
          ...priorTurns,
          { role: "user", content: data.message },
        ],
      }),
    });

    if (response.status === 429) throw new Error("The concierge is busy. Please try again in a moment.");
    if (response.status === 402) throw new Error("The concierge is temporarily unavailable.");
    if (!response.ok) throw new Error("The concierge could not answer right now.");

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const reply =
      payload.choices?.[0]?.message?.content?.trim() ||
      "I'll pass this to the front desk team and they will reply here shortly.";

    await supabaseAdmin.from("guest_chat_messages").insert({
      session_id: data.sessionId,
      role: "assistant",
      content: reply,
    });
    await supabaseAdmin
      .from("guest_chat_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.sessionId);

    return { reply };
  });
