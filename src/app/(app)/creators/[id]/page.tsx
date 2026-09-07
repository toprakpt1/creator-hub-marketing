import { notFound } from "next/navigation";
import { CreatorDetail } from "@/components/creators/creator-detail";
import { getCreatorById, listVideos } from "@/lib/db/creators";
import { campaignsForCreator, listsForCreator } from "@/lib/db/groups";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const creator = getCreatorById(id);
  return { title: creator ? `${creator.name} · Creator Hub` : "Creator · Creator Hub" };
}

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = getCreatorById(id);
  if (!creator) notFound();

  return (
    <CreatorDetail
      creator={creator}
      videos={listVideos(id)}
      lists={listsForCreator(id)}
      campaigns={campaignsForCreator(id)}
    />
  );
}
