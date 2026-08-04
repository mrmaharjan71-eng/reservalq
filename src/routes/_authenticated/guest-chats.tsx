import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, Panel, SkeletonRows } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guest-chats")({
  head: () => ({
    meta: [
      { title: "Guest Chats — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content:
          "Admin-only transcripts of every anonymous guest conversation with the ReservalQ concierge assistant.",
      },
      { property: "og:title", content: "Guest Chats — ReservalQ AI Hotel Management" },
      {
        property: "og:description",
        content: "Read stored guest concierge conversations. Visible to hotel admins only.",
      },
    ],
  }),
  component: GuestChatsPage,
});

type Session = {
  id: string;
  guest_label: string;
  reference: string;
  last_message_at: string;
  created_at: string;
};

function GuestChatsPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: ["guest_chat_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_chat_sessions")
        .select("id,guest_label,reference,last_message_at,created_at")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as Session[];
    },
  });

  const messages = useQuery({
    queryKey: ["guest_chat_messages", activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_chat_messages")
        .select("id,role,content,created_at")
        .eq("session_id", activeId!)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const list = sessions.data ?? [];

  return (
    <AppShell
      title="Guest chats"
      subtitle="Stored concierge conversations from guests using the app without an account — admins only"
    >
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel className="lg:col-span-2" title="Conversations" description="Newest activity first">
          {sessions.isPending ? (
            <SkeletonRows rows={4} />
          ) : sessions.isError ? (
            <EmptyState
              title="Not available"
              description="Only admins and front desk managers can read guest transcripts."
            />
          ) : list.length === 0 ? (
            <EmptyState title="No guest chats yet" description="Conversations appear here as guests write in." />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((session) => (
                <li key={session.id}>
                  <button
                    onClick={() => setActiveId(session.id)}
                    className={`flex w-full items-center justify-between gap-3 px-1 py-3 text-left text-sm ${
                      activeId === session.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="truncate font-medium">{session.guest_label || "Guest"}</span>
                    <span className="shrink-0 text-xs">
                      {new Date(session.last_message_at).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-3" title="Transcript" description="Full conversation history">
          {!activeId ? (
            <EmptyState title="Select a conversation" description="Pick a guest on the left to read the chat." />
          ) : messages.isPending ? (
            <SkeletonRows rows={5} />
          ) : (messages.data ?? []).length === 0 ? (
            <EmptyState title="Empty" description="No messages stored for this conversation." />
          ) : (
            <ul className="space-y-3">
              {(messages.data ?? []).map((message) => (
                <li key={message.id} className="rounded-md border border-border bg-surface-elevated p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={message.role === "guest" ? "info" : "brass"}>
                      {message.role === "guest" ? "Guest" : "Concierge"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{message.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
