import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Panel, inputClass } from "@/components/ui-kit";
import { sendGuestChatMessage, startGuestChat } from "@/lib/guest-chat.functions";

export const Route = createFileRoute("/concierge")({
  head: () => ({
    meta: [
      { title: "Guest Concierge Chat — Aurelia Hotel" },
      {
        name: "description",
        content:
          "Chat with the Aurelia Hotel concierge about rooms, rates and services. No email, no account, no sign-up required.",
      },
      { property: "og:title", content: "Guest Concierge Chat — Aurelia Hotel" },
      {
        property: "og:description",
        content: "Ask about rooms, rates and hotel services instantly — no account needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConciergePage,
});

const STORAGE_KEY = "aurelia_guest_session";
const PROMPTS = [
  "What rooms do you have and what do they cost?",
  "Do you have family rooms for two adults and a child?",
  "What time is check-in and check-out?",
  "Can someone call me back about a booking?",
];

type Turn = { role: "guest" | "assistant"; content: string };

function ConciergePage() {
  const start = useServerFn(startGuestChat);
  const send = useServerFn(sendGuestChatMessage);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  const open = useMutation({
    mutationFn: async () => start({ data: { guestLabel: name.trim(), reference: "" } }),
    onSuccess: (result) => {
      window.localStorage.setItem(STORAGE_KEY, result.sessionId);
      setSessionId(result.sessionId);
      setTurns([
        {
          role: "assistant",
          content: `Welcome${name.trim() ? `, ${name.trim()}` : ""}. I'm the Aurelia concierge — ask me about rooms, rates or anything about your stay.`,
        },
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ask = useMutation({
    mutationFn: async (message: string) => send({ data: { sessionId: sessionId!, message } }),
    onSuccess: (result) => setTurns((current) => [...current, { role: "assistant", content: result.reply }]),
    onError: (error: Error) => {
      toast.error(error.message);
      setTurns((current) => [...current, { role: "assistant", content: error.message }]);
    },
  });

  function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || !sessionId || ask.isPending) return;
    setTurns((current) => [...current, { role: "guest", content: trimmed }]);
    setInput("");
    ask.mutate(trimmed);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-shell)" }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Aurelia <span className="brass-text">Hotel</span>
        </Link>
        <span className="text-xs text-muted-foreground">No account needed</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="font-display text-3xl">Guest concierge</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Ask anything about rooms, rates or your stay. No email or sign-up — your conversation is kept privately
          for the hotel team.
        </p>

        {!sessionId ? (
          <Panel title="Start chatting" description="Give a first name if you like — it is optional.">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                open.mutate();
              }}
            >
              <input
                className={`${inputClass} sm:w-64`}
                value={name}
                maxLength={60}
                placeholder="Your name (optional)"
                aria-label="Your name (optional)"
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" disabled={open.isPending}>
                {open.isPending ? "Opening…" : "Start chat"}
              </Button>
            </form>
          </Panel>
        ) : (
          <Panel className="flex flex-col">
            <div className="min-h-[20rem] flex-1 space-y-3 overflow-y-auto pr-1">
              {turns.map((turn, index) => (
                <div
                  key={index}
                  className={
                    turn.role === "guest"
                      ? "ml-auto max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm"
                      : "max-w-[90%] rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm whitespace-pre-wrap"
                  }
                >
                  {turn.content}
                </div>
              ))}
              {ask.isPending && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  The concierge is typing…
                </p>
              )}
              <div ref={endRef} />
            </div>

            {turns.length <= 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {PROMPTS.map((prompt) => (
                  <Button key={prompt} size="sm" variant="outline" onClick={() => submit(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
            )}

            <form
              className="mt-4 flex gap-2 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit(input);
              }}
            >
              <input
                className={inputClass}
                value={input}
                maxLength={800}
                placeholder="Type your message…"
                aria-label="Message the concierge"
                onChange={(event) => setInput(event.target.value)}
              />
              <Button type="submit" disabled={ask.isPending || !input.trim()}>
                Send
              </Button>
            </form>
          </Panel>
        )}
      </main>
    </div>
  );
}
