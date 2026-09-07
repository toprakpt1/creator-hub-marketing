import { NextResponse } from "next/server";
import { addCreatorsToCampaign, createCampaign, listCampaigns } from "@/lib/db/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ campaigns: listCampaigns() });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    goal?: string;
    creatorIds?: string[];
  };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A campaign needs a name." }, { status: 400 });

  const campaign = createCampaign(name, b.goal?.trim() || null);
  if (Array.isArray(b.creatorIds) && b.creatorIds.length) {
    addCreatorsToCampaign(campaign.id, b.creatorIds);
  }
  return NextResponse.json({ campaign });
}
