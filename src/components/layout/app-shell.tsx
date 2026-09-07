"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/components/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "cb_hub_sidebar_collapsed";

export function AppShell({
  children,
  counts,
}: {
  children: React.ReactNode;
  counts: Record<string, number>;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, ready } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  const toggle = React.useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-60 border-r border-border p-4 lg:block">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[60px]" : "w-[236px]"
        )}
      >
        <div className="sticky top-0 h-screen">
          <SidebarNav collapsed={collapsed} onToggle={toggle} counts={counts} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[248px] p-0" hideClose>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav
            collapsed={false}
            counts={counts}
            showToggle={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

    </div>
  );
}
