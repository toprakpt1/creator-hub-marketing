import { NextResponse } from "next/server";
import {
  addCreatorsToList,
  deleteCreatorList,
  getCreatorList,
  removeCreatorFromList,
  updateCreatorList,
} from "@/lib/db/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    addCreatorIds?: string[];
    removeCreatorId?: string;
  };

  if (Array.isArray(b.addCreatorIds) && b.addCreatorIds.length) {
    const added = addCreatorsToList(id, b.addCreatorIds);
    return NextResponse.json({ added, list: getCreatorList(id) });
  }
  if (b.removeCreatorId) {
    removeCreatorFromList(id, b.removeCreatorId);
    return NextResponse.json({ list: getCreatorList(id) });
  }
  if (typeof b.name === "string") {
    const list = updateCreatorList(id, b.name.trim(), b.description?.trim() ?? null);
    if (!list) return NextResponse.json({ error: "List not found." }, { status: 404 });
    return NextResponse.json({ list });
  }
  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deleteCreatorList(id)) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
