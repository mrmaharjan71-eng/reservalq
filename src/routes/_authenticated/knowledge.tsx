import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, EmptyState, Field, Panel, SkeletonRows, inputClass } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({
    meta: [
      { title: "Concierge Data — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content:
          "Add and curate the hotel policies, amenities and local tips that ground every answer the ReservalQ guest concierge gives.",
      },
      { property: "og:title", content: "Concierge Data — ReservalQ AI Hotel Management" },
      {
        property: "og:description",
        content: "Train the guest concierge with your own hotel information.",
      },
    ],
  }),
  component: KnowledgePage,
});

type Entry = {
  id: string;
  title: string;
  category: string;
  content: string;
  is_active: boolean;
  updated_at: string;
};

const CATEGORIES = ["policies", "amenities", "dining", "transport", "local guide", "events", "other"];

function KnowledgePage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [content, setContent] = useState("");

  const entries = useQuery({
    queryKey: ["hotel_knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_knowledge")
        .select("id,title,category,content,is_active,updated_at")
        .order("category")
        .order("title");
      if (error) throw new Error(error.message);
      return (data ?? []) as Entry[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["hotel_knowledge"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hotel_knowledge")
        .insert({ title: title.trim(), category, content: content.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      toast.success("The concierge now knows this.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (entry: Entry) => {
      const { error } = await supabase
        .from("hotel_knowledge")
        .update({ is_active: !entry.is_active })
        .eq("id", entry.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hotel_knowledge").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Concierge data"
      subtitle="Everything here is fed to the guest concierge before it answers."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Add knowledge" description="Short, factual entries work best.">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim() || !content.trim()) return toast.error("Add a title and the details.");
              create.mutate();
            }}
          >
            <Field label="Title">
              <input
                className={inputClass}
                value={title}
                maxLength={120}
                placeholder="Check-in and check-out times"
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputClass}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Details">
              <textarea
                className={`${inputClass} min-h-32`}
                value={content}
                maxLength={4000}
                placeholder="Check-in from 14:00, check-out by 11:00. Early check-in subject to availability."
                onChange={(event) => setContent(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Add to concierge"}
            </Button>
          </form>
        </Panel>

        <Panel title="Knowledge base" description="Deactivate an entry to hide it from the concierge.">
          {entries.isLoading ? (
            <SkeletonRows rows={4} />
          ) : (entries.data ?? []).length === 0 ? (
            <EmptyState
              title="Nothing added yet"
              description="Add your policies, amenities and local tips so the concierge stops guessing."
            />
          ) : (
            <ul className="space-y-3">
              {(entries.data ?? []).map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-surface-elevated p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{entry.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{entry.category}</p>
                    </div>
                    <Badge tone={entry.is_active ? "success" : "neutral"}>
                      {entry.is_active ? "live" : "hidden"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{entry.content}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggle.mutate(entry)}>
                      {entry.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(entry.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
