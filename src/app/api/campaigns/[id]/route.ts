import { NextResponse } from "next/server";
import {
  addCreatorsToCampaign,
  deleteCampaign,
  getCampaign,
  updateCampaignStatus,
} from "@/lib/db/groups";
import type { CampaignStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "completed"];

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as {
    status?: CampaignStatus;
    addCreatorIds?: string[];
  };

  if (Array.isArray(b.addCreatorIds) && b.addCreatorIds.length) {
    const added = addCreatorsToCampaign(id, b.addCreatorIds);
    return NextResponse.json({ added, campaign: getCampaign(id) });
  }
  if (b.status) {
    if (!STATUSES.includes(b.status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const campaign = updateCampaignStatus(id, b.status);
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ campaign });
  }
  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deleteCampaign(id)) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
