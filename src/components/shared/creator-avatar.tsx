import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { avatarTint, initials } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-xl",
} as const;

/**
 * Real YouTube channel avatar with an initials fallback, so a broken or
 * missing thumbnail never leaves a hole in the table.
 */
export function CreatorAvatar({
  name,
  seed,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  seed: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const tint = avatarTint(seed);
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {imageUrl && <AvatarImage src={imageUrl} alt="" />}
      <AvatarFallback
        className="font-semibold"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function CreatorIdentity({
  creator,
  href,
  size = "md",
  showPlatform = true,
  className,
}: {
  creator: {
    id: string;
    name: string;
    handle?: string | null;
    thumbnailUrl?: string | null;
    platform?: Platform;
  };
  href?: string;
  size?: "sm" | "md";
  showPlatform?: boolean;
  className?: string;
}) {
  const body = (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <CreatorAvatar
        name={creator.name}
        seed={creator.id}
        imageUrl={creator.thumbnailUrl}
        size={size}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">{creator.name}</span>
          {showPlatform && (
            <PlatformIcon
              platform={creator.platform ?? "youtube"}
              className="h-3 w-3 shrink-0"
            />
          )}
        </div>
        {creator.handle && (
          <div className="truncate text-xs text-muted-foreground">{creator.handle}</div>
        )}
      </div>
    </div>
  );

  if (!href) return body;
  return (
    <Link
      href={href}
      className="block rounded-md outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      {body}
    </Link>
  );
}
