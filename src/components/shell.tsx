import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/poll", label: "Poll" },
  { to: "/weights", label: "Weights" },
  { to: "/lab", label: "Lab" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative block h-6 w-3" aria-hidden>
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-accent" />
              <span className="absolute left-0 top-1/2 h-px w-full bg-accent" />
            </span>
            <span className="font-display text-lg font-medium tracking-tight">Line</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors duration-150",
                    active ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 pb-16">{children}</div>
    </div>
  );
}
