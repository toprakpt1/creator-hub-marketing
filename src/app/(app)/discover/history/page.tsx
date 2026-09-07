import { PageIntro } from "@/components/shared/page-intro";
import { DiscoveryHistory } from "@/components/discover/discovery-history";
import { getQuotaUsage, listRuns } from "@/lib/db/runs";

export const metadata = { title: "Discovery History · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function DiscoveryHistoryPage() {
  return (
    <div className="space-y-5">
      <PageIntro titleKey="history.title" descriptionKey="history.subtitle" />
      <DiscoveryHistory runs={listRuns(100)} quota={getQuotaUsage()} />
    </div>
  );
}
