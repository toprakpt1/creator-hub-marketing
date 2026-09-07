import { NextResponse } from "next/server";
import { addCreatorsToList, createCreatorList, listCreatorLists } from "@/lib/db/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ lists: listCreatorLists() });
}

/** POST — create a list, optionally seeded with creators. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const b = (body ?? {}) as { name?: string; description?: string; creatorIds?: string[] };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A list needs a name." }, { status: 400 });

  const list = createCreatorList(name, b.description?.trim() || null);
  if (Array.isArray(b.creatorIds) && b.creatorIds.length) {
    addCreatorsToList(list.id, b.creatorIds);
  }
  return NextResponse.json({ list });
}
