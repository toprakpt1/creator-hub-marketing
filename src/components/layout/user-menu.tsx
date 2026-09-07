"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronsUpDown, LifeBuoy, LogOut, Settings, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/components/providers";
import { useT } from "@/lib/i18n/provider";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const t = useT();

  const name = user?.name ?? "Demo User";
  const email = user?.email ?? "demo@chestblade.com";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{email}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel>{t("user.signedInAs")}</DropdownMenuLabel>
        <div className="px-2 pb-2 text-[13px]">
          <div className="font-medium text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound />
            {t("user.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            {t("user.workspaceSettings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            toast(t("user.support"), { description: t("user.supportBody") })
          }
        >
          <LifeBuoy />
          {t("user.support")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            signOut();
            toast.success(t("user.signedOut"));
            router.push("/login");
          }}
        >
          <LogOut />
          {t("user.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
