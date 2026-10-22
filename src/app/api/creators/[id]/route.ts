import { NextResponse } from "next/server";
import {
  deleteCreator,
  getCreatorById,
  listVideos,
  updateCreatorEmail,
  updateCreatorStatus,
} from "@/lib/db/creators";
import type { CreatorStatus, EmailSource, EmailStatus } from "@/lib/types";
import { isEmail } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_SOURCES: EmailSource[] = [
  "none",
  "manual",
  "youtube_public",
  "website",
  "instagram",
  "tiktok",
  "hunter",
  "other",
];

const STATUSES: CreatorStatus[] = [
  "new",
  "reviewing",
  "qualified",
  "shortlisted",
  "ready_to_contact",
  "contacted",
  "replied",
  "interested",
  "accepted",
  "content_published",
  "not_interested",
  "rejected",
];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const creator = getCreatorById(id);
  if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  return NextResponse.json({ creator, videos: listVideos(id) });
}

/** PATCH — manual email entry and status changes. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  if ("status" in b) {
    const status = b.status as CreatorStatus;
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const creator = updateCreatorStatus(id, status);
    if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    return NextResponse.json({ creator });
  }

  if ("email" in b) {
    const raw = b.email;
    const email = typeof raw === "string" && raw.trim() ? raw.trim() : null;

    if (email && !isEmail(email)) {
      return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
    }

    const source = EMAIL_SOURCES.includes(b.emailSource as EmailSource)
      ? (b.emailSource as EmailSource)
      : email
        ? "manual"
        : "none";
    const status: EmailStatus = email ? "manual" : "not_checked";

    const creator = updateCreatorEmail(id, email, source, status);
    if (!creator) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    return NextResponse.json({ creator });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const removed = deleteCreator(id);
  if (!removed) return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
