import { CreatorsWorkspace } from "@/components/creators/creators-workspace";
import { getCreatorStats, listCreators } from "@/lib/db/creators";

export const metadata = { title: "Creators · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function CreatorsPage() {
  const creators = listCreators();
  const stats = getCreatorStats();

  return (
    <CreatorsWorkspace
      creators={creators}
      stats={{
        total: stats.total,
        analyzed: stats.analyzed,
        rising: stats.rising,
        withEmail: stats.withEmail,
      }}
    />
  );
}
