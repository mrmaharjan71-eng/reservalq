import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
  language: z.string().trim().min(1).max(60).default("English"),
});

export type ManagerReply = {
  reply: string;
  proposals: { action_type: string; summary: string; reasoning: string; confidence: number }[];
};

const SYSTEM_PROMPT = `You are the AI Front Desk Manager for the Aurelia Hotel.
You work alongside human staff and operate under human supervision.

Rules:
- Reason over the live hotel snapshot you are given. Never invent rooms, guests or reservations.
- Always explain WHY you recommend something (occupancy, guest tier, revenue, housekeeping load, risk).
- You never silently mutate data. Anything that changes the hotel state must be returned as a proposal for a human to approve.
- Escalate to a human when data is missing or the guest situation is sensitive.
- Be concise and operational, like a senior front desk manager briefing a colleague.

Respond with JSON only, in this exact shape:
{"reply": "markdown-free plain text answer for staff",
 "proposals": [{"action_type": "room_assignment|upsell|housekeeping|risk|pricing|guest_comms",
                "summary": "one line action",
                "reasoning": "why, referencing the snapshot",
                "confidence": 0.0}]}
Return an empty proposals array when nothing should change.`;

export const askBookingManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<ManagerReply> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    const [roomsResult, typesResult, reservationsResult, tasksResult] = await Promise.all([
      supabase.from("rooms").select("room_number,floor,condition,is_active,room_types(name,code,base_rate)"),
      supabase.from("room_types").select("code,name,base_rate,max_occupancy,amenities"),
      supabase
        .from("reservations")
        .select(
          "reference,check_in,check_out,status,channel,adults,children,nightly_rate,balance_due,special_requests,guests(full_name,is_vip,loyalty_tier),rooms(room_number),room_types(name)",
        )
        .gte("check_out", today),
      supabase.from("housekeeping_tasks").select("task_type,priority,status,notes,rooms(room_number)"),
    ]);

    const snapshot = {
      today,
      rooms: roomsResult.data ?? [],
      room_types: typesResult.data ?? [],
      active_reservations: reservationsResult.data ?? [],
      housekeeping: tasksResult.data ?? [],
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: `Write the "reply" field entirely in ${data.language}. Keep guest names, room numbers, references and amounts unchanged. Proposal "summary" and "reasoning" fields must stay in English for the audit trail.`,
          },
          { role: "system", content: `Live hotel snapshot:\n${JSON.stringify(snapshot)}` },
          ...data.history,
          { role: "user", content: data.question },
        ],
      }),
    });

    if (response.status === 429) throw new Error("The AI manager is rate limited. Try again shortly.");
    if (response.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!response.ok) throw new Error(`AI request failed (${response.status}).`);

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";

    let parsed: ManagerReply;
    try {
      const candidate = JSON.parse(raw) as Partial<ManagerReply>;
      parsed = {
        reply: typeof candidate.reply === "string" ? candidate.reply : raw,
        proposals: Array.isArray(candidate.proposals) ? candidate.proposals.slice(0, 5) : [],
      };
    } catch {
      parsed = { reply: raw, proposals: [] };
    }

    if (parsed.proposals.length > 0) {
      await supabase.from("ai_actions").insert(
        parsed.proposals.map((proposal) => ({
          action_type: String(proposal.action_type ?? "guest_comms").slice(0, 40),
          summary: String(proposal.summary ?? "").slice(0, 300),
          reasoning: String(proposal.reasoning ?? "").slice(0, 2000),
          confidence: Math.min(0.999, Math.max(0, Number(proposal.confidence) || 0.7)),
        })),
      );
    }

    await supabase.from("audit_logs").insert({
      actor: userId,
      actor_label: "ai_front_desk_manager",
      entity: "ai_conversation",
      action: "asked",
      details: { question: data.question.slice(0, 300), proposals: parsed.proposals.length },
    });

    return parsed;
  });