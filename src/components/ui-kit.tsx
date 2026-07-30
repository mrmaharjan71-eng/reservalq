import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brass";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-accent/15 text-accent border-accent/30",
  brass: "bg-primary/15 text-primary border-primary/30",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "brass",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="panel p-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-2 font-display text-3xl", tone === "brass" ? "brass-text" : "text-foreground")}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground hover:brightness-110",
        variant === "outline" && "border border-border bg-transparent text-foreground hover:bg-secondary",
        variant === "ghost" && "text-muted-foreground hover:bg-secondary hover:text-foreground",
        variant === "danger" && "bg-destructive text-destructive-foreground hover:brightness-110",
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-md bg-secondary/60" />
      ))}
    </div>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "checked_in":
    case "completed":
    case "clean":
    case "approved":
    case "executed":
      return "success";
    case "pending":
    case "dirty":
    case "in_progress":
    case "proposed":
      return "warning";
    case "cancelled":
    case "no_show":
    case "out_of_order":
    case "blocked":
    case "rejected":
      return "danger";
    case "confirmed":
    case "inspected":
      return "info";
    default:
      return "neutral";
  }
}