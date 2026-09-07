import { PageIntro } from "@/components/shared/page-intro";
import { DiscoverPanel } from "@/components/discover/discover-panel";
import { PlatformStatusRow } from "@/components/discover/platform-status";
import { getQuotaUsage } from "@/lib/db/runs";

export const metadata = { title: "Discover · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  return (
    <div className="space-y-5">
      <PageIntro titleKey="discover.title" descriptionKey="discover.subtitle">
        <PlatformStatusRow />
      </PageIntro>
      <DiscoverPanel initialQuota={getQuotaUsage()} />
    </div>
  );
}
