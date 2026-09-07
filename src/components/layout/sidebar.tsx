"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { MAIN_NAV } from "@/components/layout/nav-config";
import { UserMenu } from "@/components/layout/user-menu";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function SidebarNav({
  collapsed,
  onToggle,
  counts,
  onNavigate,
  showToggle = true,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  counts: Record<string, number>;
  onNavigate?: () => void;
  showToggle?: boolean;
}) {
  const pathname = usePathname();
  const t = useT();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link href="/dashboard" onClick={onNavigate} className="outline-none">
          <BrandLockup collapsed={collapsed} />
        </Link>
        {showToggle && !collapsed && onToggle && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={t("nav.collapseSidebar")}
            className="text-muted-foreground"
          >
            <ChevronsLeft />
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {MAIN_NAV.map((item) => {
          const active = isActive(item.href);
          const count = item.countKey ? counts[item.countKey] : undefined;
          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && (
                <>
                  <span className="truncate">{t(item.labelKey)}</span>
                  {count !== undefined && (
                    <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[11px] tabular text-muted-foreground">
                      {count}
                    </span>
                  )}
                </>
              )}
            </Link>
          );

          return collapsed ? (
            <SimpleTooltip key={item.href} label={t(item.labelKey)} side="right">
              {link}
            </SimpleTooltip>
          ) : (
            link
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-2">
        {collapsed && onToggle && showToggle && (
          <SimpleTooltip label={t("nav.expandSidebar")} side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggle}
              aria-label={t("nav.expandSidebar")}
              className="mx-auto flex text-muted-foreground"
            >
              <ChevronsRight />
            </Button>
          </SimpleTooltip>
        )}

        {(() => {
          const active = isActive("/settings");
          const link = (
            <Link
              href="/settings"
              onClick={onNavigate}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              <Settings
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && <span>{t("nav.settings")}</span>}
            </Link>
          );
          return collapsed ? (
            <SimpleTooltip label={t("nav.settings")} side="right">
              {link}
            </SimpleTooltip>
          ) : (
            link
          );
        })()}

        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
