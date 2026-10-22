import { NextResponse } from "next/server";
import { readAssetFile } from "@/lib/outreach/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves an uploaded template image to the panel preview. Sends never use this
 * URL — the image travels inside the message as a CID part instead.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await readAssetFile(id);
  if (!found) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(found.buffer), {
    headers: {
      "Content-Type": found.asset.mime,
      "Content-Length": String(found.buffer.length),
      // The id is a UUID and never reused, so the file is immutable.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
