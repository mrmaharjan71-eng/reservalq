import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/voice-transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Voice is not configured.", { status: 500 });

        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size === 0) {
          return new Response("No audio was received.", { status: 400 });
        }
        if (audio.size > 20 * 1024 * 1024) {
          return new Response("That recording is too long.", { status: 413 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", audio, "recording.wav");

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        if (!response.ok) {
          return new Response(await response.text(), { status: response.status });
        }
        const payload = (await response.json()) as { text?: string };
        return Response.json({ text: payload.text ?? "" });
      },
    },
  },
});
