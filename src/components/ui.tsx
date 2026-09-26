import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "warn";
}) {
  const styles = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    ghost: "bg-transparent text-fg hover:bg-raised",
    outline: "border border-border bg-transparent text-fg hover:bg-raised",
    warn: "bg-warn text-warn-fg hover:opacity-90",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-opacity duration-150 disabled:opacity-40",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-md border border-border bg-raised px-3 text-sm text-fg outline-none ring-accent/40 focus:ring-2",
        props.className,
      )}
    />
  );
}

export function FillerBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-filler px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-filler-fg">
      Filler weight
    </span>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-5 md:p-6", className)}>
      {children}
    </section>
  );
}
