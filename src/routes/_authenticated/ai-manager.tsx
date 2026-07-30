import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, EmptyState, Panel, SkeletonRows, inputClass, statusTone } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { titleCase } from "@/lib/format";
import { askBookingManager } from "@/lib/ai-manager.functions";
import { aiActionsQuery, logAudit } from "@/lib/hotel-data";
import type { Database } from "@/integrations/supabase/types";

type AiStatus = Database["public"]["Enums"]["ai_action_status"];
type ChatMessage = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/_authenticated/ai-manager")({
  head: () => ({
    meta: [
      { title: "AI Booking Manager — Aurelia AI Hotel Management" },
      {
        name: "description",
        content:
          "An AI front desk manager that reads live occupancy, recommends actions with reasoning, and waits for human approval.",
      },
      { property: "og:title", content: "AI Booking Manager — Aurelia AI Hotel Management" },
      {
        property: "og:description",
        content: "AI recommendations for rooms, upsells and risk — always under human approval.",
      },
    ],
  }),
  component: AiManagerPage,
});

const SUGGESTIONS = [
  "Which arrivals still need a room, and what would you assign?",
  "Where are we losing revenue tonight?",
  "Any no-show or overbooking risk in the next three days?",
  "What should housekeeping do first this morning?",
];

function AiManagerPage() {
  const queryClient = useQueryClient();
  const actions = useQuery(aiActionsQuery);
  const ask = useServerFn(askBookingManager);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (question: string) => ask({ data: { question, history: messages.slice(-8) } }),
    onSuccess: (result) => {
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
      if (result.proposals.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["ai_actions"] });
        toast.success(`${result.proposals.length} recommendation(s) queued for approval`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `I couldn't complete that: ${error.message}` },
      ]);
    },
  });

  function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || send.isPending) return;
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setInput("");
    send.mutate(trimmed);
  }

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AiStatus }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_actions")
        .update({ status, decided_by: userData.user?.id ?? null, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await logAudit("ai_action", id, `decision:${status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_actions"] });
      toast.success("Decision recorded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const proposals = (actions.data ?? []).filter((action) => action.status === "proposed");
  const decided = (actions.data ?? []).filter((action) => action.status !== "proposed");

  return (
    <AppShell
      title="AI Booking Manager"
      subtitle="Reads live hotel state, explains its reasoning, and never acts without approval"
    >
      <div className="grid gap-5 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3 flex flex-col"
          title="Ask the manager"
          description="Grounded in tonight's occupancy, reservations and housekeeping board"
        >
          <div className="min-h-[18rem] flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="space-y-3">
                <EmptyState
                  title="No conversation yet"
                  description="Ask an operational question — the answer is grounded in live data."
                />
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button key={suggestion} size="sm" variant="outline" onClick={() => submit(suggestion)}>
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm"
                    : "max-w-[90%] rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm whitespace-pre-wrap"
                }
              >
                {message.content}
              </div>
            ))}
            {send.isPending && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                The manager is reviewing the property…
              </p>
            )}
          </div>

          <form
            className="mt-4 flex gap-2 border-t border-border pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <input
              ref={inputRef}
              className={inputClass}
              value={input}
              maxLength={1000}
              placeholder="e.g. Who should we upgrade tonight?"
              onChange={(event) => setInput(event.target.value)}
              aria-label="Message the AI booking manager"
            />
            <Button type="submit" disabled={send.isPending || !input.trim()}>
              Send
            </Button>
          </form>
        </Panel>

        <div className="space-y-5 xl:col-span-2">
          <Panel title="Approval queue" description="Nothing is executed until a human approves">
            {actions.isPending ? (
              <SkeletonRows rows={3} />
            ) : proposals.length === 0 ? (
              <EmptyState title="Queue clear" description="No recommendations awaiting a decision." />
            ) : (
              <ul className="space-y-3">
                {proposals.map((action) => (
                  <li key={action.id} className="rounded-md border border-border bg-surface-elevated p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="info">{titleCase(action.action_type)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(Number(action.confidence) * 100)}% confidence
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{action.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.reasoning}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => decide.mutate({ id: action.id, status: "approved" })}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => decide.mutate({ id: action.id, status: "rejected" })}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Decision history" description="Audit trail of human decisions">
            {decided.length === 0 ? (
              <EmptyState title="No decisions yet" description="Approvals and rejections appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {decided.slice(0, 8).map((action) => (
                  <li key={action.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{action.summary}</span>
                    <Badge tone={statusTone(action.status)}>{titleCase(action.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}