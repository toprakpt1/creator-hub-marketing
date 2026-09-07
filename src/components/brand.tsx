import { cn } from "@/lib/utils";

/**
 * Chest Blade mark — a chest lid with a blade through it, kept abstract enough
 * to sit in a business tool rather than a game site.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-7 w-7", className)}
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" fill="hsl(205 84% 45%)" fillOpacity="0.14" />
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="7.5"
        stroke="hsl(205 84% 45%)"
        strokeOpacity="0.45"
      />
      <path
        d="M8 19.5v-4.2A3.3 3.3 0 0 1 11.3 12h9.4a3.3 3.3 0 0 1 3.3 3.3v4.2a2.5 2.5 0 0 1-2.5 2.5H10.5A2.5 2.5 0 0 1 8 19.5Z"
        stroke="hsl(205 84% 38%)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.4 16.2h15.2" stroke="hsl(205 84% 38%)" strokeWidth="1.4" />
      <path
        d="M16 5.5v13"
        stroke="hsl(215 45% 22%)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13.6 8.4 16 5.6l2.4 2.8"
        stroke="hsl(215 45% 22%)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLockup({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight text-foreground">
            Chest Blade
          </div>
          <div className="text-[11px] text-muted-foreground">Creator Hub</div>
        </div>
      )}
    </div>
  );
}
