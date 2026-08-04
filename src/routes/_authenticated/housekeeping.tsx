import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, EmptyState, Panel, SkeletonRows, statusTone } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";
import { titleCase } from "@/lib/format";
import { housekeepingQuery, logAudit } from "@/lib/hotel-data";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];
const COLUMNS: TaskStatus[] = ["pending", "in_progress", "completed", "blocked"];

export const Route = createFileRoute("/_authenticated/housekeeping")({
  head: () => ({
    meta: [
      { title: "Housekeeping Board — ReservalQ AI Hotel Management" },
      {
        name: "description",
        content: "Kanban board of cleaning, turndown and maintenance tasks prioritised against arrivals.",
      },
      { property: "og:title", content: "Housekeeping Board — ReservalQ AI Hotel Management" },
      { property: "og:description", content: "Prioritised housekeeping and maintenance task board." },
    ],
  }),
  component: HousekeepingPage,
});

function HousekeepingPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery(housekeepingQuery);

  const move = useMutation({
    mutationFn: async ({ id, status, roomId }: { id: string; status: TaskStatus; roomId: string }) => {
      const { error } = await supabase.from("housekeeping_tasks").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      if (status === "completed") {
        await supabase.from("rooms").update({ condition: "inspected" }).eq("id", roomId);
      }
      await logAudit("housekeeping_task", id, `status:${status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["housekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Task updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Housekeeping" subtitle="Task board driven by departures, arrivals and AI priorities">
      {tasks.isPending ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnTasks = (tasks.data ?? []).filter((task) => task.status === column);
            return (
              <Panel key={column} title={titleCase(column)} description={`${columnTasks.length} tasks`}>
                {columnTasks.length === 0 ? (
                  <EmptyState title="Empty" description="Nothing in this column." />
                ) : (
                  <ul className="space-y-3">
                    {columnTasks.map((task) => (
                      <li key={task.id} className="rounded-md border border-border bg-surface-elevated p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">Room {task.rooms?.room_number}</p>
                          <Badge tone={task.priority === 1 ? "danger" : statusTone(task.status)}>
                            P{task.priority}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{titleCase(task.task_type)}</p>
                        {task.notes && <p className="mt-2 text-sm">{task.notes}</p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {COLUMNS.filter((next) => next !== column).map((next) => (
                            <Button
                              key={next}
                              size="sm"
                              variant="outline"
                              onClick={() => move.mutate({ id: task.id, status: next, roomId: task.room_id })}
                            >
                              {titleCase(next)}
                            </Button>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}