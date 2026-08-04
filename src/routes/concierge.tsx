import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, Volume2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Panel, inputClass } from "@/components/ui-kit";
import { sendGuestChatMessage, startGuestChat } from "@/lib/guest-chat.functions";
import { LANGUAGES } from "@/lib/languages";
import { VoiceRecorder, speak, transcribe } from "@/lib/voice";

export const Route = createFileRoute("/concierge")({
  head: () => ({
    meta: [
      { title: "Guest Concierge Chat — ReservalQ Hotel" },
      {
        name: "description",
        content:
          "Chat or talk with the ReservalQ concierge about rooms, rates and services in your own language. No email, no account, no sign-up required.",
      },
      { property: "og:title", content: "Guest Concierge Chat — ReservalQ Hotel" },
      {
        property: "og:description",
        content: "Voice or text concierge with a built-in translator — no account needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConciergePage,
});

const STORAGE_KEY = "reservalq_guest_session";
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
  const [language, setLanguage] = useState("English");
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const recorder = useRef<VoiceRecorder | null>(null);
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
          content: `Welcome${name.trim() ? `, ${name.trim()}` : ""}. I'm the ReservalQ concierge — ask me about rooms, rates or anything about your stay. You can type or talk to me in your own language.`,
        },
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ask = useMutation({
    mutationFn: async (message: string) => send({ data: { sessionId: sessionId!, message, language } }),
    onSuccess: (result) => {
      setTurns((current) => [...current, { role: "assistant", content: result.reply }]);
      if (voiceReplies) speak(result.reply).catch(() => undefined);
    },
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

  async function toggleRecording() {
    try {
      if (!recording) {
        const instance = new VoiceRecorder();
        await instance.start();
        recorder.current = instance;
        setRecording(true);
        return;
      }
      setRecording(false);
      const blob = await recorder.current!.stop();
      recorder.current = null;
      setTranscribing(true);
      const text = await transcribe(blob);
      setTranscribing(false);
      if (text.trim()) submit(text);
      else toast.error("I didn't catch that — please try again.");
    } catch (error) {
      setRecording(false);
      setTranscribing(false);
      toast.error(error instanceof Error ? error.message : "Microphone access failed.");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-shell)" }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg">
          <Sparkles className="size-5 text-primary" aria-hidden />
          Reserval<span className="brass-text">Q</span>
        </Link>
        <Link to="/book" className="text-sm text-primary underline-offset-4 hover:underline">
          Book a room
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <h1 className="font-display text-3xl">Guest concierge</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Type or talk — the concierge understands and replies in your language. No email or sign-up needed.
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
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
              <select
                className={`${inputClass} sm:w-72`}
                value={language}
                aria-label="Reply language"
                onChange={(event) => setLanguage(event.target.value)}
              >
                {LANGUAGES.map((option) => (
                  <option key={option.code} value={option.language}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant={voiceReplies ? "primary" : "outline"}
                onClick={() => setVoiceReplies((current) => !current)}
              >
                <Volume2 className="size-4" aria-hidden />
                {voiceReplies ? "Voice on" : "Voice off"}
              </Button>
            </div>

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
              {(ask.isPending || transcribing) && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {transcribing ? "Listening…" : "The concierge is typing…"}
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
              <Button
                type="button"
                variant={recording ? "danger" : "outline"}
                onClick={toggleRecording}
                disabled={transcribing || ask.isPending}
                aria-label={recording ? "Stop recording" : "Start voice message"}
              >
                {recording ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
              </Button>
              <input
                className={inputClass}
                value={input}
                maxLength={800}
                placeholder={recording ? "Recording… tap stop when done" : "Type your message…"}
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
