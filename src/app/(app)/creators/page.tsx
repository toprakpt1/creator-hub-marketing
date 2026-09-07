import { PageIntro, T } from "@/components/shared/page-intro";
import { CreatorsExplorer } from "@/components/creators/creators-explorer";
import { getCreatorStats, listCreators } from "@/lib/db/creators";
import { fullNumber } from "@/lib/format";

export const metadata = { title: "Creators · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function CreatorsPage() {
  const creators = listCreators();
  const stats = getCreatorStats();

  return (
    <div className="space-y-5">
      <PageIntro titleKey="creators.title" descriptionKey="creators.subtitle">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span><T k="creators.statInWorkspace" vars={{ count: stats.total }} /></span>
          <span><T k="creators.statAnalyzed" vars={{ count: stats.analyzed }} /></span>
          <span><T k="creators.statRising" vars={{ count: stats.rising }} /></span>
          <span><T k="creators.statWithContact" vars={{ count: stats.withEmail }} /></span>
        </div>
      </PageIntro>

      <CreatorsExplorer creators={creators} />
    </div>
  );
}
