import { Instagram, Twitch, Youtube } from "lucide-react";
import { PLATFORM_META } from "@/lib/constants";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

function TikTokGlyph({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-hidden="true">
      <path
        d="M14 3.5v10.9a3.4 3.4 0 1 1-2.8-3.35"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.5c.5 2.5 2 3.9 4.5 4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  className,
  colored = true,
}: {
  platform: Platform;
  className?: string;
  colored?: boolean;
}) {
  const style = colored ? { color: PLATFORM_META[platform].color } : undefined;
  const cls = cn("h-3.5 w-3.5", className);
  if (platform === "youtube") return <Youtube className={cls} style={style} />;
  if (platform === "instagram") return <Instagram className={cls} style={style} />;
  if (platform === "twitch") return <Twitch className={cls} style={style} />;
  return <TikTokGlyph className={cls} style={style} />;
}

export function PlatformLabel({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", className)}>
      <PlatformIcon platform={platform} />
      {PLATFORM_META[platform].label}
    </span>
  );
}
