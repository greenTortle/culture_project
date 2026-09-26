import { useState } from "react";
import { Info } from "lucide-react";

/**
 * Hover/focus help bubble.
 *
 * The trigger is deliberately sized to the icon glyph itself rather than to a
 * comfortable tap target: these sit inline next to slider labels, and a padded
 * button meant the bubble opened while the pointer was on its way to the track.
 * Open state is explicit rather than a CSS `peer-hover` rule so the only element
 * that can ever open it is the icon.
 *
 * The bubble is `pointer-events-none`, so it can overlap the control below
 * without swallowing clicks or trapping the pointer.
 */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex size-4 items-center justify-center rounded-full text-muted transition-colors hover:text-fg focus-visible:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label="About this setting"
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info className="size-3.5" strokeWidth={1.75} />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-6 z-50 w-64 -translate-x-1/2 rounded-md border border-border bg-raised px-3 py-2 text-xs font-normal leading-relaxed text-fg shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
