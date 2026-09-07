import { AppShell } from "@/components/layout/app-shell";
import { getCreatorStats } from "@/lib/db/creators";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const stats = getCreatorStats();

  // Only counts backed by real data appear as sidebar badges.
  const counts = {
    creators: stats.total,
    rising: stats.rising,
  };

  return <AppShell counts={counts}>{children}</AppShell>;
}
