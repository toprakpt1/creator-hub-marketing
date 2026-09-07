import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { T } from "@/components/shared/page-intro";
import { CreatorsExplorer } from "@/components/creators/creators-explorer";
import { getCreators } from "@/lib/db/creators";
import { getCreatorList, listMemberIds } from "@/lib/db/groups";
import { Compact, Num, UpdatedAgo } from "@/components/shared/time";
import { compactNumber, fullNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = getCreatorList(id);
  return { title: list ? `${list.name} · Lists` : "List · Creator Hub" };
}

function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
    </Card>
  );
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = getCreatorList(id);
  if (!list) notFound();

  const members = getCreators(listMemberIds(id));
  const avg = (pick: (c: (typeof members)[number]) => number | null) => {
    const values = members.map(pick).filter((v): v is number => v !== null);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  };

  const avgSubs = avg((c) => c.subscriberCount);
  const avgViews = avg((c) => c.averageViews);
  const avgScore = avg((c) => c.creatorScore);

  return (
    <div className="space-y-5">
      <Link
        href="/lists"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <T k="lists.backToLists" />
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: list.color }}
              aria-hidden
            />
            {list.name}
          </span>
        }
        description={list.description ?? undefined}
      >
        <p className="text-xs text-muted-foreground">
          <UpdatedAgo iso={list.updatedAt} />
        </p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={<T k="lists.detailCreators" />} value={<Num value={members.length} />} />
        <Stat
          label={<T k="lists.statAvgSubs" />}
          value={<Compact value={avgSubs} />}
        />
        <Stat
          label={<T k="lists.statAvgViews" />}
          value={<Compact value={avgViews} />}
        />
        <Stat label={<T k="lists.statAvgScore" />} value={avgScore === null ? "—" : String(avgScore)} />
        <Stat
          label={<T k="lists.detailWithEmail" />}
          value={String(members.filter((c) => c.email).length)}
        />
      </div>

      <CreatorsExplorer creators={members} />
    </div>
  );
}
