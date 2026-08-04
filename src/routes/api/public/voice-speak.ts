import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/voice-speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Voice is not configured.", { status: 500 });

        const body = (await request.json()) as { text?: unknown };
        const text = typeof body.text === "string" ? body.text.trim().slice(0, 3000) : "";
        if (!text) return new Response("Nothing to speak.", { status: 400 });

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: "alloy",
            response_format: "mp3",
          }),
        });
        if (!response.ok) {
          return new Response(await response.text(), { status: response.status });
        }
        return new Response(response.body, { headers: { "Content-Type": "audio/mpeg" } });
      },
    },
  },
});
