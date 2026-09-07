import { PageIntro } from "@/components/shared/page-intro";
import { ListsGrid, type ListSummary } from "@/components/lists/list-cards";
import { getCreators } from "@/lib/db/creators";
import { listCreatorLists, listMemberIds } from "@/lib/db/groups";

export const metadata = { title: "Lists · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

/** Aggregates are computed from the members' real metrics. */
function summarize(memberIds: string[]): Omit<ListSummary, "list"> {
  const members = getCreators(memberIds);
  const avg = (pick: (c: (typeof members)[number]) => number | null) => {
    const values = members.map(pick).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };
  return {
    avgSubscribers: avg((c) => c.subscriberCount),
    avgViews: avg((c) => c.averageViews),
    avgScore: avg((c) => c.creatorScore),
    countries: Array.from(new Set(members.map((c) => c.country).filter(Boolean))) as string[],
    withEmail: members.filter((c) => c.email).length,
    rising: members.filter((c) => c.isRising).length,
  };
}

export default function ListsPage() {
  const summaries: ListSummary[] = listCreatorLists().map((list) => ({
    list,
    ...summarize(listMemberIds(list.id)),
  }));

  return (
    <div className="space-y-5">
      <PageIntro titleKey="lists.title" descriptionKey="lists.subtitle" />
      <ListsGrid summaries={summaries} />
    </div>
  );
}
