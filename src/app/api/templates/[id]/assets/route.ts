import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/db/groups";
import { AssetError, saveUploadedAsset } from "@/lib/outreach/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Uploads one image for a template. The body references it as `asset:<id>`. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getTemplate(id)) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No image was attached." }, { status: 400 });
  }

  try {
    const asset = await saveUploadedAsset(id, file as File);
    return NextResponse.json({ asset });
  } catch (e) {
    if (e instanceof AssetError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error("[templates] image upload failed", e);
    return NextResponse.json({ error: "Could not save the image." }, { status: 500 });
  }
}
