import { NextResponse } from "next/server";
import { listAssetsForTemplate } from "@/lib/db/assets";
import { deleteTemplate, updateTemplate } from "@/lib/db/groups";
import { removeAssetFiles, removeUnreferencedAssets } from "@/lib/outreach/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    language?: string;
    subject?: string;
    body?: string;
  };
  const template = updateTemplate(id, b);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  // A save is the natural moment to drop uploads removed from the body.
  await removeUnreferencedAssets(id, template.body);
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Read the asset ids before the template delete cascades their rows away.
  const assets = listAssetsForTemplate(id);
  if (!deleteTemplate(id)) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  await removeAssetFiles(assets.map((asset) => asset.id));
  return NextResponse.json({ ok: true });
}
